import { useState, useMemo, useEffect, useRef } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  subMonths,
  format,
  isWithinInterval,
  eachWeekOfInterval,
  getISOWeek,
  getISOWeekYear,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import type { Language } from '../types';
import { getTranslations } from '../utils/translations';
import { loadPeriodConfig, getPeriodDateRange } from '../utils/periodConfig';
import { formatMinutesToHoursAndMinutes } from '../utils/timeCalculations';
import { getNetShiftMinutes } from '../utils/breakRules';
import { isPurelyManagementRole, isUserVisibleOnTeamSchedule } from '../utils/permissions';
import { isUiWidgetVisible } from '../utils/uiScreenWidgets';
import { isFeatureEnabled } from '../utils/enabledFeatures';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileDown, Calendar,
  CheckCircle2, AlertCircle, TrendingUp,
  ChevronDown,
} from 'lucide-react';
import jsPDF from 'jspdf';
import DatePickerField from './DatePickerField';

function toDateOnly(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function formatEurAmount(amount: number, lang: Language): string {
  const loc = lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : 'it-IT';
  return new Intl.NumberFormat(loc, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

type WeekKey = string; // "2026-W10"
type Preset = 'period' | 'current_week' | 'current_month' | 'prev_month' | 'custom';

function getInitialPeriodRange(): { start: string; end: string } {
  const { startDate, endDate } = getPeriodDateRange(loadPeriodConfig());
  return { start: startDate, end: endDate };
}

export default function Statistics() {
  const { users, shifts, currentUser, effectiveLanguage, breakRules, featureFlags } = useApp();
  const t = getTranslations(effectiveLanguage);
  const breakComputeOpts = useMemo(
    () => ({ autoBreaksFeatureEnabled: featureFlags['auto_breaks'] !== false }),
    [featureFlags]
  );
  /** Vista “gestione” completa solo se ruolo gestionale e matrice `view_stats` attiva. */
  const isManagementRoleUser = currentUser
    ? ['admin', 'proprietario', 'manager', 'assistant_manager'].includes(currentUser.role)
    : false;
  const showManagementStatsChrome =
    currentUser && isManagementRoleUser && isFeatureEnabled(currentUser, 'view_stats');
  const showEstimatedCostWidget =
    !!currentUser && isFeatureEnabled(currentUser, 'view_estimated_cost');

  const initialPeriod = getInitialPeriodRange();
  const [preset, setPreset]     = useState<Preset>('period');
  const [dateStart, setDateStart] = useState<string>(initialPeriod.start);
  const [dateEnd, setDateEnd]     = useState<string>(initialPeriod.end);
  const [activeWidget, setActiveWidget] = useState<'approved' | 'pending' | null>(null);
  const dateStartInputRef = useRef<HTMLButtonElement>(null);

  // Sync date range when preset changes
  useEffect(() => {
    const n = new Date();
    if (preset === 'period') {
      const { startDate, endDate } = getPeriodDateRange(loadPeriodConfig());
      setDateStart(startDate);
      setDateEnd(endDate);
    } else if (preset === 'current_month') {
      setDateStart(toDateOnly(startOfMonth(n)));
      setDateEnd(toDateOnly(endOfMonth(n)));
    } else if (preset === 'prev_month') {
      const prev = subMonths(n, 1);
      setDateStart(toDateOnly(startOfMonth(prev)));
      setDateEnd(toDateOnly(endOfMonth(prev)));
    } else if (preset === 'current_week') {
      setDateStart(toDateOnly(startOfWeek(n, { weekStartsOn: 1 })));
      setDateEnd(toDateOnly(endOfWeek(n, { weekStartsOn: 1 })));
    }
  }, [preset]);

  // Aggiorna range quando il periodo viene salvato in Presenze
  useEffect(() => {
    const handler = () => {
      if (preset === 'period') {
        const { startDate, endDate } = getPeriodDateRange(loadPeriodConfig());
        setDateStart(startDate);
        setDateEnd(endDate);
      }
    };
    window.addEventListener('osteria_period_updated', handler);
    return () => window.removeEventListener('osteria_period_updated', handler);
  }, [preset]);

  const rangeStart = useMemo(() => {
    const s = new Date(dateStart);
    const e = new Date(dateEnd);
    return startOfDay(s <= e ? s : e);
  }, [dateStart, dateEnd]);
  const rangeEnd = useMemo(() => {
    const s = new Date(dateStart);
    const e = new Date(dateEnd);
    return endOfDay(s <= e ? e : s);
  }, [dateStart, dateEnd]);

  /** Settimane incluse nell'intervallo (chiave: "YYYY-Www") */
  const weeksInRange = useMemo(() => {
    const weeks = eachWeekOfInterval(
      { start: rangeStart, end: rangeEnd },
      { weekStartsOn: 1 }
    );
    return weeks.map((d) => {
      const w = getISOWeek(d);
      const y = getISOWeekYear(d);
      const weekStart = startOfWeek(d, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(d, { weekStartsOn: 1 });
      const label = `${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`;
      return { key: `${y}-W${String(w).padStart(2, '0')}` as WeekKey, start: weekStart, end: weekEnd, label };
    });
  }, [rangeStart, rangeEnd]);

  /** Minuti confermati per utente per settimana (solo turni confirmed) */
  const minutesByUserByWeek = useMemo(() => {
    const byUser: Record<string, Record<WeekKey, number>> = {};
    const rangeShifts = shifts.filter(
      (s) =>
        (s.approval_status === 'confirmed' || s.approval_status === 'approved') &&
        isWithinInterval(new Date(s.date), { start: rangeStart, end: rangeEnd })
    );
    for (const s of rangeShifts) {
      const end = (s.end_time || '').trim().slice(0, 5);
      const start = (s.start_time || '').trim().slice(0, 5);
      if (!start || !end || start === end) continue;
      const u = users.find((x) => x.id === s.user_id);
      const mins = getNetShiftMinutes(s, start, end, u ?? undefined, breakRules, breakComputeOpts);
      const d = new Date(s.date);
      const w = getISOWeek(d);
      const y = getISOWeekYear(d);
      const weekKey = `${y}-W${String(w).padStart(2, '0')}` as WeekKey;
      if (!byUser[s.user_id]) byUser[s.user_id] = {} as Record<WeekKey, number>;
      byUser[s.user_id][weekKey] = (byUser[s.user_id][weekKey] ?? 0) + mins;
    }
    return byUser;
  }, [shifts, rangeStart, rangeEnd, users, breakRules, breakComputeOpts]);

  const displayUsers = useMemo(() => {
    if (!currentUser) return [];
    return users
      .filter((u) => {
        if (u.status !== 'active' || isPurelyManagementRole(u.role)) return false;
        if (!showManagementStatsChrome) return u.id === currentUser.id;
        if (u.id === currentUser.id) return true;
        return isUserVisibleOnTeamSchedule(u);
      })
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [users, currentUser, showManagementStatsChrome]);

  const totalMinutesAll = useMemo(() => {
    return displayUsers.reduce((sum, u) => {
      const byWeek = minutesByUserByWeek[u.id] ?? {};
      return sum + Object.values(byWeek).reduce((a, b) => a + b, 0);
    }, 0);
  }, [displayUsers, minutesByUserByWeek]);

  // ── Widget: ore approvate nel periodo ───────────────────────────────
  const approvedMins = useMemo(() => {
    return shifts
      .filter(
        (s) =>
          s.approval_status === 'approved' &&
          isWithinInterval(new Date(s.date), { start: rangeStart, end: rangeEnd })
      )
      .reduce((sum, s) => {
        const start = (s.start_time || '').trim().slice(0, 5);
        const end   = (s.end_time   || '').trim().slice(0, 5);
        if (!start || !end || start === end) return sum;
        const u = users.find((x) => x.id === s.user_id);
        return sum + getNetShiftMinutes(s, start, end, u ?? undefined, breakRules, breakComputeOpts);
      }, 0);
  }, [shifts, rangeStart, rangeEnd, users, breakRules, breakComputeOpts]);

  // ── Widget: turni in attesa (confermati ma non ancora approvati) ────
  const pendingShifts = useMemo(() => {
    return shifts
      .filter(
        (s) =>
          s.approval_status === 'confirmed' &&
          isWithinInterval(new Date(s.date), { start: rangeStart, end: rangeEnd })
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [shifts, rangeStart, rangeEnd]);
  const pendingCount = pendingShifts.length;

  // ── Widget: turni approvati nel periodo ─────────────────────────────
  const approvedShifts = useMemo(() => {
    return shifts
      .filter(
        (s) =>
          s.approval_status === 'approved' &&
          isWithinInterval(new Date(s.date), { start: rangeStart, end: rangeEnd })
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [shifts, rangeStart, rangeEnd]);

  /** Costo stimato: somma (ore nette × €/h) su turni approvati; tariffa da profilo dipendente */
  const estimatedCostStats = useMemo(() => {
    let totalEur = 0;
    let shiftsWithRate = 0;
    let shiftsWithoutRate = 0;
    for (const s of approvedShifts) {
      const start = (s.start_time || '').trim().slice(0, 5);
      const end = (s.end_time || '').trim().slice(0, 5);
      if (!start || !end || start === end) continue;
      const u = users.find((x) => x.id === s.user_id);
      const mins = getNetShiftMinutes(s, start, end, u ?? undefined, breakRules, breakComputeOpts);
      const raw = u?.hourly_rate_eur;
      const rate = typeof raw === 'string' ? parseFloat(raw) : raw;
      if (rate != null && Number.isFinite(rate) && rate >= 0) {
        totalEur += (mins / 60) * rate;
        shiftsWithRate += 1;
      } else {
        shiftsWithoutRate += 1;
      }
    }
    return { totalEur, shiftsWithRate, shiftsWithoutRate };
  }, [approvedShifts, users, breakRules, breakComputeOpts]);

  const hasDataInRange = totalMinutesAll > 0;

  if (!currentUser) return null;

  const generatePDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;
    const col1 = margin;
    let y = 20;

    doc.setFont('times', 'bold');
    doc.setFontSize(20);
    doc.text('Osteria Basilico', col1, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(80);
    y += 8;
    doc.text(
      `Report Ore: dal ${format(rangeStart, 'dd/MM/yyyy', { locale: it })} al ${format(rangeEnd, 'dd/MM/yyyy', { locale: it })}`,
      col1,
      y
    );
    doc.text(`Generato il ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageW - margin, y, { align: 'right' });
    doc.setTextColor(0);
    y += 10;
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    const colWidth = (pageW - margin * 2 - 50) / Math.max(weeksInRange.length, 1);
    const nameColW = 50;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y - 4, pageW - margin * 2, 6, 'F');
    doc.text('Dipendente', col1, y);
    let x = col1 + nameColW;
    weeksInRange.forEach((w) => {
      doc.text(w.label, x + colWidth / 2, y, { align: 'center' });
      x += colWidth;
    });
    doc.text('Totale', pageW - margin, y, { align: 'right' });
    y += 6;
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');

    displayUsers.forEach((u) => {
      const byWeek = minutesByUserByWeek[u.id] ?? {};
      const totalMins = Object.values(byWeek).reduce((a, b) => a + b, 0);
      if (totalMins === 0) return;
      const name = (u.first_name ?? '').trim().toUpperCase() || u.email;

      if (y > 265) {
        doc.addPage();
        y = 20;
      }
      doc.setFont('helvetica', 'bold');
      doc.text(name, col1, y);
      doc.setFont('helvetica', 'normal');
      x = col1 + nameColW;
      weeksInRange.forEach((w) => {
        const mins = byWeek[w.key] ?? 0;
        doc.text(mins > 0 ? formatMinutesToHoursAndMinutes(mins) : '–', x + colWidth / 2, y, { align: 'center' });
        x += colWidth;
      });
      doc.text(formatMinutesToHoursAndMinutes(totalMins), pageW - margin, y, { align: 'right' });
      y += 5;
    });

    y += 4;
    doc.setDrawColor(180);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Totale', col1, y);
    x = col1 + nameColW;
    weeksInRange.forEach((w) => {
      const weekTotal = displayUsers.reduce(
        (s, u) => s + (minutesByUserByWeek[u.id]?.[w.key] ?? 0),
        0
      );
      doc.text(weekTotal > 0 ? formatMinutesToHoursAndMinutes(weekTotal) : '–', x + colWidth / 2, y, { align: 'center' });
      x += colWidth;
    });
    doc.text(formatMinutesToHoursAndMinutes(totalMinutesAll), pageW - margin, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text('Osteria Basilico — Report generato automaticamente', pageW / 2, 285, { align: 'center' });
    doc.save(`report_${format(rangeStart, 'yyyy-MM-dd')}_${format(rangeEnd, 'yyyy-MM-dd')}.pdf`);
  };


  // ── Preset labels ────────────────────────────────────────────────────────
  const PRESETS: { key: Preset; label: string }[] = [
    { key: 'period',       label: (t as { stats_preset_period?: string }).stats_preset_period ?? 'Periodo Presenze' },
    { key: 'current_week',  label: t.stats_preset_current_week },
    { key: 'current_month', label: t.stats_preset_current_month },
    { key: 'prev_month',    label: t.stats_preset_prev_month },
    { key: 'custom',        label: t.stats_preset_custom },
  ];

  if (!currentUser) return null;
  const uiW = (key: string) => isUiWidgetVisible(currentUser, key);

  return (
    <div className="pb-content pt-6 w-full max-w-full font-sans min-h-full">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* ── Filtro Temporale + PDF ───────────────────────────────────── */}
        {showManagementStatsChrome && uiW('stats.mgmt_filters') && (
          <div className="ui-toolbar-page-band">
            <div className="ui-toolbar-page-band-inner">
              <div className="ui-toolbar-row-tight min-w-0">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setPreset(p.key);
                      if (p.key === 'custom') {
                        requestAnimationFrame(() => {
                          dateStartInputRef.current?.focus();
                          dateStartInputRef.current?.click();
                        });
                      }
                    }}
                    className={`ui-toolbar-pill transition-all ${
                      preset === p.key
                        ? 'border-accent bg-accent text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {p.key === 'custom' && <Calendar className="h-3 w-3 shrink-0" />}
                    {p.label}
                  </button>
                ))}
              </div>
              {/* Date picker (sempre visibili, ma prominenti solo in custom) */}
              <div className={`ui-toolbar-row shrink-0 transition-opacity ${preset !== 'custom' ? 'pointer-events-none opacity-50' : ''}`}>
                <DatePickerField
                  ref={dateStartInputRef}
                  value={dateStart}
                  max={dateEnd}
                  allowClear={false}
                  onChange={(v) => { setDateStart(v); setPreset('custom'); }}
                  aria-label={t.stats_date_range}
                />
                <span className="inline-flex h-[22px] shrink-0 items-center text-[13px] font-medium leading-none text-slate-400">→</span>
                <DatePickerField
                  value={dateEnd}
                  min={dateStart}
                  allowClear={false}
                  onChange={(v) => { setDateEnd(v); setPreset('custom'); }}
                  aria-label={t.stats_date_range}
                />
              </div>
            </div>
            {isFeatureEnabled(currentUser, 'export_pdf') && (
              <button
                type="button"
                onClick={generatePDF}
                disabled={!hasDataInRange}
                className="ui-toolbar-accent shrink-0 self-center font-semibold uppercase tracking-wider sm:ml-auto disabled:hover:bg-accent"
              >
                <FileDown className="h-3 w-3 shrink-0" />
                {t.download_pdf}
              </button>
            )}
          </div>
        )}

        {/* ── 3 Widget cards (solo management) ───────────────────────── */}
        {showManagementStatsChrome && uiW('stats.mgmt_kpi_cards') && (
          <>
          <div
            className={`grid grid-cols-1 gap-4 mb-4 ${showEstimatedCostWidget ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
          >
            {/* Ore Totali Approvate */}
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              onClick={() => setActiveWidget(activeWidget === 'approved' ? null : 'approved')}
              className={`bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-4 text-left transition-all cursor-pointer hover:shadow-md ${
                activeWidget === 'approved' ? 'border-accent ring-2 ring-accent/20' : 'border-slate-200 hover:border-accent/40'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">{t.stats_approved_hours}</p>
                <p className="text-2xl font-bold text-slate-900 leading-none">
                  {approvedMins > 0 ? formatMinutesToHoursAndMinutes(approvedMins) : '—'}
                </p>
                <p className="text-xs text-slate-500 mt-1.5">{t.stats_approved_shifts_count.replace('{n}', String(approvedShifts.length))}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${activeWidget === 'approved' ? 'rotate-180 text-accent' : ''}`} />
            </motion.button>

            {/* Costo stimato — solo se permesso ruolo/template (es. contabilità) */}
            {showEstimatedCostWidget && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 ${
                estimatedCostStats.shiftsWithRate === 0 ? 'opacity-75' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-violet-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">{t.stats_estimated_cost}</p>
                {estimatedCostStats.shiftsWithRate + estimatedCostStats.shiftsWithoutRate === 0 ? (
                  <>
                    <p className="text-2xl font-bold text-slate-400 leading-none">—</p>
                    <p className="text-xs text-slate-500 mt-1.5">
                      {(t as { stats_no_approved_for_cost?: string }).stats_no_approved_for_cost ?? t.stats_no_approved_shifts}
                    </p>
                  </>
                ) : estimatedCostStats.shiftsWithRate === 0 ? (
                  <>
                    <p className="text-2xl font-bold text-slate-400 leading-none">—</p>
                    <p className="text-xs text-slate-500 mt-1.5">
                      {(t as { stats_hourly_rate_not_set?: string }).stats_hourly_rate_not_set ?? t.stats_base_salary_not_set}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-slate-900 leading-none tabular-nums">
                      {formatEurAmount(estimatedCostStats.totalEur, effectiveLanguage)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5">
                      {estimatedCostStats.shiftsWithoutRate > 0
                        ? (t as { stats_partial_hourly_rates?: string }).stats_partial_hourly_rates?.replace(
                            '{n}',
                            String(estimatedCostStats.shiftsWithoutRate)
                          ) ?? `${estimatedCostStats.shiftsWithoutRate} turni senza tariffa`
                        : (t as { stats_cost_from_rates?: string }).stats_cost_from_rates ?? ''}
                    </p>
                  </>
                )}
              </div>
            </motion.div>
            )}

            {/* Turni in Attesa */}
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              onClick={() => setActiveWidget(activeWidget === 'pending' ? null : 'pending')}
              className={`bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-4 text-left transition-all cursor-pointer hover:shadow-md ${
                activeWidget === 'pending'
                  ? 'border-amber-400 ring-2 ring-amber-200'
                  : pendingCount > 0 ? 'border-amber-200 hover:border-amber-400' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                pendingCount > 0 ? 'bg-amber-50' : 'bg-slate-50'
              }`}>
                <AlertCircle className={`w-5 h-5 ${pendingCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">{t.stats_pending_shifts}</p>
                <p className={`text-2xl font-bold leading-none ${pendingCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                  {pendingCount}
                </p>
                <p className="text-xs text-slate-500 mt-1.5">{t.stats_confirmed_not_approved}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${activeWidget === 'pending' ? 'rotate-180 text-amber-500' : ''}`} />
            </motion.button>
          </div>
          </>
        )}

          {/* ── Detail panel espandibile ─────────────────────────────────── */}
          {showManagementStatsChrome && uiW('stats.detail_panels') && (
          <AnimatePresence>
            {activeWidget === 'approved' && (
              <motion.div
                key="approved-panel"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mb-4"
              >
                <div className="bg-accent/5 border border-accent/20 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-accent/10">
                    <CheckCircle2 className="w-4 h-4 text-accent" />
                    <span className="text-sm font-semibold text-accent-dark">{t.stats_approved_shifts_in_period}</span>
                    <span className="ml-auto text-xs text-accent-dark bg-accent/10 px-2 py-0.5 rounded-full font-bold">{approvedShifts.length}</span>
                  </div>
                  {approvedShifts.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-400 text-center">{t.stats_no_approved_shifts}</p>
                  ) : (
                    <div className="divide-y divide-accent/10 max-h-[320px] overflow-y-auto">
                      {approvedShifts.map((s) => {
                        const u = users.find((x) => x.id === s.user_id);
                        const mins = getNetShiftMinutes(s, (s.start_time||'').slice(0,5), (s.end_time||'').slice(0,5), u ?? undefined, breakRules, breakComputeOpts);
                        return (
                          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/5 transition-colors">
                            <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
                              <span className="text-[11px] font-bold text-accent">{(u?.first_name?.[0] ?? '?').toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{u?.first_name ?? '—'} {u?.last_name ?? ''}</p>
                              <p className="text-[11px] text-slate-400">{format(new Date(s.date), 'EEE d MMM', { locale: it })} · {(s.start_time||'').slice(0,5)} – {(s.end_time||'').slice(0,5)}</p>
                            </div>
                            <span className="text-xs font-bold text-accent tabular-nums">{formatMinutesToHoursAndMinutes(mins)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeWidget === 'pending' && (
              <motion.div
                key="pending-panel"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mb-4"
              >
                <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-100">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-semibold text-amber-800">{t.stats_shifts_awaiting_approval}</span>
                    <span className="ml-auto text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-bold border border-amber-200">{pendingCount}</span>
                  </div>
                  {pendingShifts.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-400 text-center">{t.stats_no_pending_shifts}</p>
                  ) : (
                    <div className="divide-y divide-amber-100 max-h-[320px] overflow-y-auto">
                      {pendingShifts.map((s) => {
                        const u = users.find((x) => x.id === s.user_id);
                        const mins = getNetShiftMinutes(s, (s.start_time||'').slice(0,5), (s.end_time||'').slice(0,5), u ?? undefined, breakRules, breakComputeOpts);
                        return (
                          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/80 transition-colors">
                            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-[11px] font-bold text-amber-700">{(u?.first_name?.[0] ?? '?').toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{u?.first_name ?? '—'} {u?.last_name ?? ''}</p>
                              <p className="text-[11px] text-slate-400">{format(new Date(s.date), 'EEE d MMM', { locale: it })} · {(s.start_time||'').slice(0,5)} – {(s.end_time||'').slice(0,5)}</p>
                            </div>
                            <span className="text-xs font-bold text-amber-600 tabular-nums">{formatMinutesToHoursAndMinutes(mins)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          )}


        {/* ── Sezione ore (staff o gestionale senza view_stats) ──────── */}
        {!showManagementStatsChrome && uiW('stats.table') && (
          <div className="ui-toolbar-row mb-5 w-full">
            <div className="inline-flex h-[22px] shrink-0 items-center gap-2">
              <Calendar className="h-3 w-3 shrink-0 text-slate-600" />
              <span className="text-[13px] font-semibold leading-none text-slate-900">{t.stats_date_range}</span>
            </div>
            <DatePickerField
              value={dateStart}
              max={dateEnd}
              allowClear={false}
              onChange={setDateStart}
              aria-label={t.stats_date_range}
            />
            <span className="inline-flex h-[22px] shrink-0 items-center text-[13px] font-medium leading-none text-slate-400">→</span>
            <DatePickerField
              value={dateEnd}
              min={dateStart}
              allowClear={false}
              onChange={setDateEnd}
              aria-label={t.stats_date_range}
            />
          </div>
        )}

        {/* ── Tabella dettaglio ore per settimana ─────────────────────── */}
        {uiW('stats.table') && (
        <div className="card-factorial !p-0 mb-6 overflow-hidden">
          <div className="overflow-x-auto-safe p-5 sm:p-6">
          <table className="w-full border-collapse min-w-[400px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="pl-5 pr-4 py-3 text-left text-slate-600 text-xs uppercase tracking-widest font-medium min-w-[120px] border-r border-slate-200">
                  {t.employee}
                </th>
                {weeksInRange.map((w) => (
                  <th
                    key={w.key}
                    className="px-3 py-3 text-center text-slate-600 text-xs uppercase tracking-widest font-medium whitespace-nowrap border-r border-slate-200"
                  >
                    {w.label}
                  </th>
                ))}
                <th className="pl-4 pr-5 py-3 text-center text-slate-900 text-xs uppercase tracking-widest font-bold min-w-[80px] bg-slate-50 border-l border-slate-200">
                  {t.total_hours}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayUsers.map((u) => {
                const byWeek = minutesByUserByWeek[u.id] ?? {};
                const totalMins = Object.values(byWeek).reduce((a, b) => a + b, 0);
                return (
                  <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="pl-5 pr-4 py-3 text-left border-r border-slate-100">
                      <span className="text-slate-900 font-semibold text-sm uppercase">
                        {u.first_name ?? ''}
                      </span>
                    </td>
                    {weeksInRange.map((w) => (
                      <td key={w.key} className="px-3 py-3 text-center text-slate-900 text-xs border-r border-slate-100">
                        {(byWeek[w.key] ?? 0) > 0 ? formatMinutesToHoursAndMinutes(byWeek[w.key] ?? 0) : '–'}
                      </td>
                    ))}
                    <td className="pl-4 pr-5 py-3 text-center text-slate-900 font-semibold text-sm bg-slate-50/50 border-l border-slate-100">
                      {formatMinutesToHoursAndMinutes(totalMins)}
                    </td>
                  </tr>
                );
              })}
              {/* Empty state — nessun dato nel periodo */}
              {!hasDataInRange && (
                <tr>
                  <td colSpan={weeksInRange.length + 2} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-slate-600 font-semibold text-sm">{t.stats_no_data}</p>
                      <p className="text-slate-400 text-xs">{t.stats_no_confirmed_shifts_period}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/50 border-t border-slate-200">
                <td className="pl-5 pr-4 py-3 text-slate-600 font-semibold text-sm border-r border-slate-100">{t.stats_total}</td>
                {weeksInRange.map((w) => {
                  const weekTotal = displayUsers.reduce(
                    (s, u) => s + (minutesByUserByWeek[u.id]?.[w.key] ?? 0),
                    0
                  );
                  return (
                    <td key={w.key} className="px-3 py-3 text-center text-slate-900 font-semibold text-xs border-r border-slate-100">
                      {weekTotal > 0 ? formatMinutesToHoursAndMinutes(weekTotal) : '–'}
                    </td>
                  );
                })}
                <td className="pl-4 pr-5 py-3 text-center text-slate-900 font-semibold text-sm bg-slate-50 border-l border-slate-100">
                  {formatMinutesToHoursAndMinutes(totalMinutesAll)}
                </td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>
        )}

        {!showManagementStatsChrome && uiW('stats.staff_summary') && (
          <div className="card-factorial p-5 sm:p-6">
            <p className="text-slate-600 text-xs uppercase tracking-widest font-medium mb-2">
              {t.stats_your_hours_in_range}
            </p>
            <p className="text-slate-900 text-2xl font-semibold">
              {formatMinutesToHoursAndMinutes(
                Object.values(minutesByUserByWeek[currentUser.id] ?? {}).reduce((a, b) => a + b, 0)
              )}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
