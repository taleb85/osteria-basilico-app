import { useState, useMemo, useEffect, useCallback } from 'react';
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
  parse,
  isSameDay,
  eachDayOfInterval,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { getTranslations, getDateLocale, formatTrans } from '../utils/translations';
import { getPayrollPaymentDateForCalendarMonth } from '../utils/payrollSchedule';
import { loadPeriodConfig, getPeriodDateRange } from '../utils/periodConfig';
import { formatMinutesToHoursAndMinutes } from '../utils/timeCalculations';
import { getNetShiftMinutes } from '../utils/breakRules';
import { getResolvedStartEndForHours } from '../utils/shiftResolvedClockTimes';
import {
  isManagementRole,
  isPurelyManagementRole,
  isUserVisibleOnTeamSchedule,
  canViewAllTeamHours,
} from '../utils/permissions';
import { isUiWidgetVisible } from '../utils/uiScreenWidgets';
import { isFeatureEnabled } from '../utils/enabledFeatures';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, FileDown, Filter, ChevronDown, Check } from 'lucide-react';
import DatePickerField from './DatePickerField';
import { CenteredModalPortal } from './ui/CenteredModalPortal';
import { exportAttendancePdfFromGrid } from '../utils/timesheetPdfFromRange';
import { translateDepartmentValue } from '../utils/departmentLabels';
import { getDeptColor, getDepartments } from '../utils/departments';

function toDateOnly(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function formatStatsChipDate(iso: string, locale: typeof it): string {
  const d = parseISO(iso.slice(0, 10));
  return Number.isNaN(d.getTime()) ? '—' : format(d, 'dd/MM/yy', { locale });
}

/** `YYYY-MM-DD` a mezzanotte locale — evita settimane ISO sbagliate con `new Date('YYYY-MM-DD')` (UTC). */
function parseShiftLocalDate(ymd: string): Date {
  const raw = (ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(NaN);
  return parse(raw, 'yyyy-MM-dd', new Date());
}

type WeekKey = string; // "2026-W10"
type Preset = 'period' | 'current_week' | 'current_month' | 'prev_month' | 'custom';

function getInitialPeriodRange(): { start: string; end: string } {
  const { startDate, endDate } = getPeriodDateRange(loadPeriodConfig());
  return { start: startDate, end: endDate };
}

export default function Statistics() {
  const {
    users,
    shifts,
    currentUser,
    effectiveLanguage,
    breakRules,
    featureFlags,
    punchRecords,
    showSuccess,
    showError,
  } = useApp();
  const t = getTranslations(effectiveLanguage);
  const breakComputeOpts = useMemo(
    () => ({ autoBreaksFeatureEnabled: featureFlags['auto_breaks'] !== false }),
    [featureFlags]
  );
  /** Vista gestione team: ruolo gestionale, `view_stats` e (admin o `can_view_total_hours`). */
  const isManagementRoleUser = currentUser ? isManagementRole(currentUser.role) : false;
  const showManagementStatsChrome =
    currentUser &&
    isManagementRoleUser &&
    isFeatureEnabled(currentUser, 'view_stats') &&
    canViewAllTeamHours(currentUser);

  const initialPeriod = getInitialPeriodRange();
  const [preset, setPreset]     = useState<Preset>('period');
  const [dateStart, setDateStart] = useState<string>(initialPeriod.start);
  const [dateEnd, setDateEnd]     = useState<string>(initialPeriod.end);
  /** Staff: date manuali → non sovrascrivere su `osteria_period_updated` finché non si riallinea. */
  const [staffRangeCustom, setStaffRangeCustom] = useState(false);
  const [mgmtRangeModalOpen, setMgmtRangeModalOpen] = useState(false);
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [showDeptMenu, setShowDeptMenu] = useState(false);

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

  // Aggiorna range quando il periodo viene salvato in Presenze (gestione: solo preset «periodo»; staff: sempre salvo date custom)
  useEffect(() => {
    const handler = () => {
      const { startDate, endDate } = getPeriodDateRange(loadPeriodConfig());
      if (!showManagementStatsChrome) {
        if (staffRangeCustom) return;
        setDateStart(startDate);
        setDateEnd(endDate);
        return;
      }
      if (preset === 'period') {
        setDateStart(startDate);
        setDateEnd(endDate);
      }
    };
    window.addEventListener('osteria_period_updated', handler);
    return () => window.removeEventListener('osteria_period_updated', handler);
  }, [preset, showManagementStatsChrome, staffRangeCustom]);

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

  const statsWeekDaysForPdf = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd]
  );

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

  /**
   * Minuti per utente per settimana: turni confermati o approvati, ore da orari congelati / timbrature / pianificato.
   * Date turno parse-ate in locale (stesso calendario delle card settimana).
   */
  const minutesByUserByWeek = useMemo(() => {
    const byUser: Record<string, Record<WeekKey, number>> = {};
    const rangeShifts = shifts.filter((s) => {
      if (s.approval_status === 'absent') return false;
      if (s.approval_status !== 'confirmed' && s.approval_status !== 'approved') return false;
      const sd = parseShiftLocalDate(s.date);
      if (Number.isNaN(sd.getTime())) return false;
      return isWithinInterval(sd, { start: rangeStart, end: rangeEnd });
    });
    for (const s of rangeShifts) {
      let { start, end } = getResolvedStartEndForHours(s, punchRecords);
      if (!start || !end || start === end) {
        const ps = (s.start_time || '').slice(0, 5);
        const pe = (s.end_time || '').slice(0, 5);
        if (ps && pe && ps !== pe) {
          start = ps;
          end = pe;
        } else {
          continue;
        }
      }
      const u = users.find((x) => x.id === s.user_id);
      const mins = getNetShiftMinutes(s, start, end, u ?? undefined, breakRules, breakComputeOpts);
      const d = parseShiftLocalDate(s.date);
      if (Number.isNaN(d.getTime())) continue;
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
    
    // Se l'utente non può vedere tutti gli orari del team, mostra solo se stesso
    if (!canViewAllTeamHours(currentUser)) {
      return users.filter(u => u.id === currentUser.id);
    }

    return users
      .filter((u) => {
        if (u.status !== 'active' || isPurelyManagementRole(u.role)) {
          // Se l'admin ha turni nel sistema, deve comunque comparire nelle statistiche per il calcolo totale.
          const hasShifts = shifts.some((s) => s.user_id === u.id);
          if (u.status === 'active' && isPurelyManagementRole(u.role) && hasShifts) return true;
          return false;
        }
        if (!showManagementStatsChrome) return u.id === currentUser.id;
        if (u.id === currentUser.id) return true;
        return isUserVisibleOnTeamSchedule(u, shifts);
      })
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [users, currentUser, showManagementStatsChrome]);

  const statsLocForPdf = getDateLocale(effectiveLanguage) ?? it;
  const handleExportStatsPdf = useCallback(() => {
    if (!currentUser || !isFeatureEnabled(currentUser, 'export_pdf')) return;
    try {
      const result = exportAttendancePdfFromGrid({
        weekDays: statsWeekDaysForPdf,
        visibleUsers: displayUsers,
        shifts,
        punchRecords,
        breakRules,
        breakComputeOpts,
        locale: statsLocForPdf,
        t: t as Record<string, string>,
        formatTrans,
        fmtHM: formatMinutesToHoursAndMinutes,
        onlyConfirmedOrApproved: true,
      });
      if (result === 'no_days' || result === 'no_users') {
        showError?.((t as { ts_pdf_no_data?: string }).ts_pdf_no_data ?? 'Nessun dato da esportare');
        return;
      }
      showSuccess?.((t as { mod_pdf_export?: string }).mod_pdf_export ?? 'PDF presenze esportato');
    } catch (e) {
      showError?.(e instanceof Error ? e.message : 'Export PDF non riuscito');
    }
  }, [
    currentUser,
    statsWeekDaysForPdf,
    displayUsers,
    shifts,
    punchRecords,
    breakRules,
    breakComputeOpts,
    statsLocForPdf,
    t,
    showSuccess,
    showError,
  ]);

  const totalMinutesAll = useMemo(() => {
    return displayUsers.reduce((sum, u) => {
      const byWeek = minutesByUserByWeek[u.id] ?? {};
      return sum + Object.values(byWeek).reduce((a, b) => a + b, 0);
    }, 0);
  }, [displayUsers, minutesByUserByWeek]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    users.forEach(u => {
      if (u.department) set.add(u.department);
    });
    return Array.from(set).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (deptFilter === 'all') return displayUsers;
    
    const filterLc = deptFilter.toLowerCase();
    return displayUsers.filter(u => {
      const d = (u.department || '').toLowerCase();
      // Se il filtro è "sala_bar", includi utenti con reparto "sala_bar", "sala" o "bar"
      if (filterLc === 'sala_bar') {
        return d === 'sala_bar' || d === 'sala' || d === 'bar';
      }
      return d === filterLc;
    });
  }, [displayUsers, deptFilter]);

  const totalMinutesFiltered = useMemo(() => {
    return filteredUsers.reduce((sum, u) => {
      const byWeek = minutesByUserByWeek[u.id] ?? {};
      return sum + Object.values(byWeek).reduce((a, b) => a + b, 0);
    }, 0);
  }, [filteredUsers, minutesByUserByWeek]);

  /** Ore dell’utente connesso nel range (anche se non compare nella lista team, es. admin). */
  const mgmtPersonalTotalMins = useMemo(() => {
    if (!currentUser) return 0;
    const byWeek = minutesByUserByWeek[currentUser.id] ?? {};
    return Object.values(byWeek).reduce((a, b) => a + b, 0);
  }, [currentUser, minutesByUserByWeek]);

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
  const staffSelfId = displayUsers[0]?.id ?? currentUser.id;
  const staffRangeTotalMins = Object.values(minutesByUserByWeek[currentUser.id] ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="pb-content pt-6 w-full max-w-full font-sans">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* ── Filtro Temporale (gestione + view_stats) ───────────────── */}
        {showManagementStatsChrome && uiW('stats.mgmt_filters') && (
          <>
            <div className="ui-toolbar-page-band">
              <div className="ui-toolbar-page-band-inner">
                <div className="ui-toolbar-row-tight min-w-0 flex-wrap items-center gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setPreset(p.key);
                        if (p.key === 'custom') setMgmtRangeModalOpen(true);
                      }}
                      className={`ui-toolbar-pill transition-all ${
                        p.key === 'custom' ? '!hidden lg:!flex ' : ''
                      }${
                        preset === p.key
                          ? 'border-accent bg-accent text-white'
                          : 'border-slate-200/90 bg-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-50/90 dark:border-white/10 dark:text-neutral-200 dark:hover:border-white/15 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      {p.key === 'custom' && <Calendar className="h-3 w-3 shrink-0" aria-hidden />}
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMgmtRangeModalOpen(true)}
                    className="ui-toolbar-chip max-w-full text-slate-700 hover:border-slate-300 hover:bg-slate-50/90 dark:text-neutral-200 dark:hover:bg-white/[0.06]"
                    aria-label={t.stats_date_range}
                    title={t.stats_date_range}
                  >
                    <Calendar className="h-3 w-3 shrink-0 text-slate-500 dark:text-neutral-300" aria-hidden />
                    <span className="min-w-0 truncate tabular-nums text-[12px] font-semibold sm:text-[13px]">
                      {formatStatsChipDate(dateStart, statsLoc)} → {formatStatsChipDate(dateEnd, statsLoc)}
                    </span>
                  </button>
                  {isFeatureEnabled(currentUser, 'export_pdf') && (
                    <button
                      type="button"
                      onClick={() => void handleExportStatsPdf()}
                      className="ui-toolbar-chip !hidden shrink-0 border-slate-200 text-slate-600 hover:bg-slate-50/90 dark:border-white/10 dark:text-neutral-200 dark:hover:bg-white/[0.06] lg:!inline-flex"
                      title={t.download_pdf}
                      aria-label={t.download_pdf}
                    >
                      <FileDown className="h-3 w-3 shrink-0" aria-hidden />
                      <span className="hidden min-[380px]:inline">{t.download_pdf}</span>
                    </button>
                  )}
                  {departments.length > 0 && (
                    <div className="relative ml-auto">
                      <button
                        type="button"
                        onClick={() => setShowDeptMenu(prev => !prev)}
                        className={`ui-toolbar-chip !h-[22px] shrink-0 text-slate-600 dark:text-neutral-300 hover:bg-slate-50/90 dark:hover:bg-white/[0.06] ${
                          showDeptMenu ? 'border-accent/35 bg-accent/8 ring-1 ring-accent/15' : ''
                        } ${deptFilter !== 'all' ? 'border-accent/25 bg-accent/5 dark:bg-accent/10' : ''}`}
                      >
                        <Filter className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                        <span className="text-[11px] font-bold">
                          {deptFilter === 'all' ? 'Tutti i reparti' : translateDepartmentValue(deptFilter, effectiveLanguage)}
                        </span>
                        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${showDeptMenu ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {showDeptMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            className="absolute left-0 sm:right-0 sm:left-auto top-full z-[9999] mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-neutral-900"
                            style={{ isolation: 'isolate' }}
                          >
                            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 border-b border-slate-100 dark:border-white/10 mb-1">
                              {t.department_filter_label}
                            </div>
                            <button
                              type="button"
                              onClick={() => { setDeptFilter('all'); setShowDeptMenu(false); }}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-all ${
                                deptFilter === 'all' 
                                  ? 'bg-accent text-white shadow-md' 
                                  : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-white/5'
                              }`}
                            >
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                                <Check className={`h-3 w-3 ${deptFilter === 'all' ? 'text-white' : 'text-accent'}`} strokeWidth={3} />
                              </div>
                              <span className="flex-1 truncate">Tutti i reparti</span>
                              {deptFilter === 'all' && <Check className="h-3 w-3 text-white/90" strokeWidth={3} />}
                            </button>

                            <div className="my-1 h-px bg-slate-100 dark:bg-white/5" />

                            {departments.map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => { setDeptFilter(d); setShowDeptMenu(false); }}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-all ${
                                  deptFilter === d 
                                    ? 'bg-accent text-white shadow-md' 
                                    : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-white/5'
                                }`}
                              >
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full shadow-sm ${deptFilter === d ? 'bg-white' : ''}`}
                                    style={deptFilter !== d ? { backgroundColor: getDeptColor(d) } : {}}
                                  />
                                </div>
                                <span className="flex-1 truncate">{translateDepartmentValue(d, effectiveLanguage)}</span>
                                {deptFilter === d && <Check className="h-3 w-3 text-white/90" strokeWidth={3} />}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {mgmtRangeModalOpen && (
              <CenteredModalPortal
                open
                onClose={() => setMgmtRangeModalOpen(false)}
                backdropAriaLabel={tv.close ?? 'Chiudi'}
                ariaLabel={t.stats_date_range}
                maxWidthClass="max-w-md"
                maxHeightClass="max-h-[min(90dvh,720px)]"
                panelClassName="py-2 sm:p-4"
              >
                <div className="px-3 sm:px-4">
                  <h3 className="mb-4 border-b border-slate-100 pb-3 text-base font-bold text-slate-900 dark:text-neutral-100">
                    {t.stats_date_range}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <DatePickerField
                      value={dateStart}
                      max={dateEnd}
                      allowClear={false}
                      onChange={(v) => {
                        setDateStart(v);
                        setPreset('custom');
                      }}
                      aria-label={tv.stats_aria_date_start ?? t.stats_date_range}
                    />
                    <span
                      className="inline-flex h-[22px] shrink-0 items-center text-[13px] font-medium leading-none text-slate-400 dark:text-neutral-400"
                      aria-hidden
                    >
                      →
                    </span>
                    <DatePickerField
                      value={dateEnd}
                      min={dateStart}
                      allowClear={false}
                      onChange={(v) => {
                        setDateEnd(v);
                        setPreset('custom');
                      }}
                      aria-label={tv.stats_aria_date_end ?? t.stats_date_range}
                    />
                  </div>
                </div>
                <div className="px-3 pb-1 pt-2 sm:px-4">
                  <button
                    type="button"
                    onClick={() => setMgmtRangeModalOpen(false)}
                    className="w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-accent-hover"
                  >
                    {tv.close ?? 'Chiudi'}
                  </button>
                </div>
              </CenteredModalPortal>
            )}
          </>
        )}

        {/* ── Sezione ore (staff o gestionale senza view_stats) ──────── */}
        {!showManagementStatsChrome && uiW('stats.table') && (
          <div className="mb-5 flex w-full min-w-0 flex-nowrap items-center justify-start gap-1.5 overflow-x-auto pb-0.5 smooth-touch [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="sr-only">{t.stats_date_range}</span>
            <DatePickerField
              compact
              value={dateStart}
              max={dateEnd}
              allowClear={false}
              onChange={(v) => {
                setStaffRangeCustom(true);
                setDateStart(v);
              }}
              aria-label={tv.stats_aria_date_start}
            />
            <span className="inline-flex h-[22px] shrink-0 items-center text-[13px] font-semibold leading-none text-slate-400 dark:text-neutral-400" aria-hidden>
              →
            </span>
            <DatePickerField
              compact
              value={dateEnd}
              min={dateStart}
              allowClear={false}
              onChange={(v) => {
                setStaffRangeCustom(true);
                setDateEnd(v);
              }}
              aria-label={tv.stats_aria_date_end}
            />
            {staffRangeCustom ? (
              <button
                type="button"
                onClick={() => {
                  setStaffRangeCustom(false);
                  const { startDate, endDate } = getPeriodDateRange(loadPeriodConfig());
                  setDateStart(startDate);
                  setDateEnd(endDate);
                }}
                className="shrink-0 rounded-lg border border-accent/30 bg-accent/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-dark transition-colors hover:bg-accent/10 sm:text-[11px]"
              >
                {tv.stats_align_timesheet_period ?? 'Periodo presenze'}
              </button>
            ) : null}
          </div>
        )}

        {showManagementStatsChrome && payrollForCalendarMonth && uiW('stats.table') && (
          <div className="mb-4 rounded-2xl border border-accent/25 bg-accent/5 px-4 py-3.5 text-sm dark:border-accent/35 dark:bg-accent/10">
            <p className="font-bold text-slate-900 dark:text-neutral-100">
              {tv.stats_payroll_title ?? 'Pagamento stipendi'}
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-snug text-slate-600 dark:text-neutral-300">
              {tv.stats_payroll_hint}
            </p>
            <p className="mt-2 font-semibold text-accent-dark dark:text-accent-light">
              {formatTrans(tv.stats_payroll_date_line ?? 'Data prevista: {date}', {
                date: format(payrollForCalendarMonth.payDate, 'EEEE d MMMM yyyy', { locale: statsLoc }),
              })}
            </p>
          </div>
        )}

        {/* ── Tabella ore: solo card (stesso stile “Le tue ore nell’intervallo…”), niente scroll orizzontale ─ */}
        {uiW('stats.table') && displayUsers.length <= 1 && (
          <div className="mb-8 space-y-4 md:mb-6">
            <div className="surface-glass p-5 sm:p-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-slate-600">
                {t.stats_your_hours_in_range}
              </p>
              <p className="text-2xl font-semibold tabular-nums text-slate-900">
                {formatMinutesToHoursAndMinutes(staffRangeTotalMins)}
              </p>
            </div>
            {!hasDataInRange ? (
              <div className="surface-glass flex flex-col items-center gap-3 p-8 pb-16 text-center sm:p-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-neutral-800">
                  <Calendar className="h-6 w-6 text-slate-300 dark:text-neutral-500" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100">{t.stats_no_data}</p>
                <p className="max-w-xs text-xs leading-relaxed text-slate-500 dark:text-neutral-300">{t.stats_no_confirmed_shifts_period}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-neutral-400">
                  {tv.stats_week_by_week_heading ?? tv.stats_week_tabs_legend}
                </p>
                {weeksInRange.map((w) => {
                  const wMins = minutesByUserByWeek[currentUser.id]?.[w.key] ?? 0;
                  return (
                    <div key={w.key} className="surface-glass p-5 sm:p-6">
                      <p className="mb-2 text-xs font-medium uppercase tracking-widest text-slate-600">
                        {w.label}
                      </p>
                      <p className="text-2xl font-semibold tabular-nums text-slate-900">
                        {wMins > 0 ? formatMinutesToHoursAndMinutes(wMins) : '–'}
                      </p>
                      {wMins === 0 && (
                        <p className="mt-3 text-xs text-slate-500 dark:text-neutral-300">{tv.stats_week_no_hours}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {uiW('stats.table') && displayUsers.length > 1 && (
          <div className="mb-6 space-y-4">
            {showManagementStatsChrome && (
              <div className="surface-glass border border-slate-200/80 p-5 sm:p-6 dark:border-white/10">
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-slate-600 dark:text-neutral-400">
                  {tv.stats_mgmt_personal_hours_period ?? t.stats_your_hours_in_range}
                </p>
                <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-neutral-50">
                  {mgmtPersonalTotalMins > 0 ? formatMinutesToHoursAndMinutes(mgmtPersonalTotalMins) : '–'}
                </p>
                {mgmtPersonalTotalMins > 0 && (
                  <>
                    <p className="mb-3 mt-5 border-t border-slate-200 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:border-white/10 dark:text-neutral-400">
                      {tv.stats_week_by_week_heading ?? tv.stats_week_tabs_legend}
                    </p>
                    <ul className="space-y-2.5">
                      {weeksInRange.map((w) => {
                        const m = minutesByUserByWeek[currentUser.id]?.[w.key] ?? 0;
                        return (
                          <li
                            key={`mgmt-self-${w.key}`}
                            className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0 dark:border-white/10"
                          >
                            <span className="text-sm font-medium text-slate-700 dark:text-neutral-200">{w.label}</span>
                            <span className="shrink-0 text-base font-semibold tabular-nums text-slate-900 dark:text-neutral-50">
                              {m > 0 ? formatMinutesToHoursAndMinutes(m) : '–'}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            )}
            {showManagementStatsChrome && (
              <div className="surface-glass p-5 sm:p-6">
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-slate-600">
                  {deptFilter === 'all' ? (tv.stats_team_hours_period ?? t.stats_total) : `TOTALE ${translateDepartmentValue(deptFilter, effectiveLanguage).toUpperCase()}`}
                </p>
                <p className="text-2xl font-semibold tabular-nums text-slate-900">
                  {formatMinutesToHoursAndMinutes(totalMinutesFiltered)}
                </p>
              </div>
            )}
            {!hasDataInRange ? (
              <div className="surface-glass flex flex-col items-center gap-3 p-8 text-center sm:p-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-neutral-800">
                  <Calendar className="h-6 w-6 text-slate-300 dark:text-neutral-500" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100">{t.stats_no_data}</p>
                <p className="max-w-xs text-xs text-slate-500 dark:text-neutral-300">{t.stats_no_confirmed_shifts_period}</p>
              </div>
            ) : (
              weeksInRange.map((w) => {
                const weekTotal = filteredUsers.reduce(
                  (s, u) => s + (minutesByUserByWeek[u.id]?.[w.key] ?? 0),
                  0
                );
                return (
                  <div key={w.key} className="surface-glass p-5 sm:p-6">
                    <p className="mb-4 text-xs font-medium uppercase tracking-widest text-slate-600 dark:text-neutral-400">{w.label}</p>
                    <ul className="space-y-3">
                      {filteredUsers.map((u) => {
                        const m = minutesByUserByWeek[u.id]?.[w.key] ?? 0;
                        return (
                          <li key={u.id} className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-white/10">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-neutral-100">
                                {(u.first_name ?? '').trim() || '—'}
                              </span>
                              {deptFilter === 'all' && u.department && (
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                  {translateDepartmentValue(u.department, effectiveLanguage)}
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 text-lg font-semibold tabular-nums text-slate-900 dark:text-neutral-50">
                              {m > 0 ? formatMinutesToHoursAndMinutes(m) : '–'}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {showManagementStatsChrome && (
                      <div className="mt-4 flex items-baseline justify-between border-t border-slate-200 pt-4 text-sm font-bold text-slate-800 dark:border-white/10 dark:text-neutral-100">
                        <span>{t.stats_total}</span>
                        <span className="tabular-nums text-lg text-accent-dark">
                          {weekTotal > 0 ? formatMinutesToHoursAndMinutes(weekTotal) : '–'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {!showManagementStatsChrome && uiW('stats.staff_summary') && !uiW('stats.table') && (
          <div className="surface-glass p-5 sm:p-6">
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
