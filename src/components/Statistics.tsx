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
  parseISO,
  isSameDay,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { getTranslations, getDateLocale, formatTrans } from '../utils/translations';
import { getPayrollPaymentDateForCalendarMonth } from '../utils/payrollSchedule';
import { loadPeriodConfig, getPeriodDateRange } from '../utils/periodConfig';
import { formatMinutesToHoursAndMinutes } from '../utils/timeCalculations';
import { getNetShiftMinutes } from '../utils/breakRules';
import { getResolvedStartEndForHours } from '../utils/shiftResolvedClockTimes';
import { isManagementRole, isPurelyManagementRole, isUserVisibleOnTeamSchedule } from '../utils/permissions';
import { isUiWidgetVisible } from '../utils/uiScreenWidgets';
import { isFeatureEnabled } from '../utils/enabledFeatures';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import DatePickerField from './DatePickerField';
import { HorizontalScrollArea } from './HorizontalScrollArea';

function toDateOnly(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

type WeekKey = string; // "2026-W10"
type Preset = 'period' | 'current_week' | 'current_month' | 'prev_month' | 'custom';

function getInitialPeriodRange(): { start: string; end: string } {
  const { startDate, endDate } = getPeriodDateRange(loadPeriodConfig());
  return { start: startDate, end: endDate };
}

export default function Statistics() {
  const { users, shifts, currentUser, effectiveLanguage, breakRules, featureFlags, punchRecords } = useApp();
  const t = getTranslations(effectiveLanguage);
  const breakComputeOpts = useMemo(
    () => ({ autoBreaksFeatureEnabled: featureFlags['auto_breaks'] !== false }),
    [featureFlags]
  );
  /** Vista “gestione” completa solo se ruolo gestionale e matrice `view_stats` attiva. */
  const isManagementRoleUser = currentUser ? isManagementRole(currentUser.role) : false;
  const showManagementStatsChrome =
    currentUser && isManagementRoleUser && isFeatureEnabled(currentUser, 'view_stats');

  const initialPeriod = getInitialPeriodRange();
  const [preset, setPreset]     = useState<Preset>('period');
  const [dateStart, setDateStart] = useState<string>(initialPeriod.start);
  const [dateEnd, setDateEnd]     = useState<string>(initialPeriod.end);
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

  /** Mese civile intero selezionato → data pagamento stipendi (lun dopo ultima dom. sett. completa nel mese). */
  const payrollForCalendarMonth = useMemo(() => {
    try {
      const s = parseISO(dateStart);
      const e = parseISO(dateEnd);
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
      if (!isSameDay(s, startOfMonth(s)) || !isSameDay(e, endOfMonth(s))) return null;
      return { payDate: getPayrollPaymentDateForCalendarMonth(s) };
    } catch {
      return null;
    }
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
      const { start, end } = getResolvedStartEndForHours(s, punchRecords);
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
  }, [shifts, punchRecords, rangeStart, rangeEnd, users, breakRules, breakComputeOpts]);

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

  const hasDataInRange = totalMinutesAll > 0;

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
  const statsLoc = getDateLocale(effectiveLanguage) ?? it;
  const tv = t as Record<string, string>;

  return (
    <div className="pb-content pt-6 w-full max-w-full font-sans min-h-full">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {uiW('stats.title') && (
          <div className="mb-5 px-1 sm:px-0">
            <h1 className="text-slate-900 font-bold text-xl sm:text-2xl tracking-tight">{t.stats_title}</h1>
          </div>
        )}

        {/* ── Filtro Temporale (gestione + view_stats) ───────────────── */}
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
          </div>
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

        {showManagementStatsChrome && payrollForCalendarMonth && uiW('stats.table') && (
          <div className="mb-4 rounded-2xl border border-accent/25 bg-accent/5 px-4 py-3.5 text-sm">
            <p className="font-bold text-slate-900">{tv.stats_payroll_title ?? 'Pagamento stipendi'}</p>
            <p className="text-slate-600 mt-1 text-xs leading-snug max-w-2xl">
              {tv.stats_payroll_hint}
            </p>
            <p className="mt-2 font-semibold text-accent-dark">
              {formatTrans(tv.stats_payroll_date_line ?? 'Data prevista: {date}', {
                date: format(payrollForCalendarMonth.payDate, 'EEEE d MMMM yyyy', { locale: statsLoc }),
              })}
            </p>
          </div>
        )}

        {/* ── Tabella dettaglio ore per settimana ─────────────────────── */}
        {uiW('stats.table') && (
        <div className="card-factorial !p-0 mb-6 overflow-hidden">
          <HorizontalScrollArea
            variant="overlay"
            remeasureKey={`${dateStart}-${dateEnd}-${weeksInRange.length}`}
            ariaLabelPrev={t.table_h_scroll_prev}
            ariaLabelNext={t.table_h_scroll_next}
            scrollClassName="overflow-x-auto-safe p-5 sm:p-6"
          >
          <table className="w-full border-collapse min-w-[400px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky left-0 z-10 bg-slate-50 pl-5 pr-4 py-3 text-left text-slate-600 text-xs uppercase tracking-widest font-medium min-w-[120px] border-r border-slate-200">
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
              {displayUsers.map((u, rowIdx) => {
                const byWeek = minutesByUserByWeek[u.id] ?? {};
                const totalMins = Object.values(byWeek).reduce((a, b) => a + b, 0);
                return (
                  <tr
                    key={u.id}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                  >
                    <td className="sticky left-0 z-10 bg-inherit pl-5 pr-4 py-3 text-left border-r border-slate-100">
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
            {showManagementStatsChrome && (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="sticky left-0 z-10 bg-slate-50 pl-5 pr-4 py-3 text-slate-600 font-semibold text-sm border-r border-slate-100">
                  {t.stats_total}
                </td>
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
            )}
          </table>
          </HorizontalScrollArea>
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
