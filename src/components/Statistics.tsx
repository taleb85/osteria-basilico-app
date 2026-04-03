import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  addWeeks,
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
import {
  loadPeriodConfig,
  getPeriodDateRange,
  prevPeriodConfig,
  nextPeriodConfig,
  currentPeriodConfig,
  type PeriodConfig,
} from '../utils/periodConfig';
import { formatMinutesToHoursAndMinutes } from '../utils/timeCalculations';
import { getNetShiftMinutes } from '../utils/breakRules';
import { getResolvedStartEndForHours } from '../utils/shiftResolvedClockTimes';
import {
  isManagementRole,
  isPurelyManagementRole,
  canViewAllTeamHours,
} from '../utils/permissions';
import { isUiWidgetVisible } from '../utils/uiScreenWidgets';
import { isFeatureEnabled } from '../utils/enabledFeatures';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, FileDown, Filter, ChevronDown, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import DatePickerField from './DatePickerField';
import { CenteredModalPortal } from './ui/CenteredModalPortal';
import { exportAttendancePdfFromGrid } from '../utils/timesheetPdfFromRange';
import { translateDepartmentValue } from '../utils/departmentLabels';
import { getDeptColor, getDepartments, deptMatchesFilterKey } from '../utils/departments';

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
type StatsTab = 'current_week' | 'period';

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
    departmentsRevision,
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

  /** Ruoli gestionali (admin/manager/assistant_manager/capo): filtro libero.
   *  Staff operativo: vincolato al reparto del proprio profilo. */
  const isAdmin = currentUser ? isManagementRole(currentUser.role) : false;
  const lockedDept = (!isAdmin && currentUser?.department) ? currentUser.department : null;

  const initialPeriod = getInitialPeriodRange();
  const [statsTab, setStatsTab] = useState<StatsTab>('period');
  /**
   * Offset di navigazione contestuale:
   * - tab 'current_week': offset in settimane (0 = settimana corrente)
   * - tab 'period': offset in periodi (0 = periodo salvato)
   */
  const [navOffset, setNavOffset] = useState(0);
  const [dateStart, setDateStart] = useState<string>(initialPeriod.start);
  const [dateEnd, setDateEnd]     = useState<string>(initialPeriod.end);
  const [deptFilter, setDeptFilter] = useState<string>(() => currentUser?.department ?? lockedDept ?? 'all');
  const [showDeptMenu, setShowDeptMenu] = useState(false);

  /** Calcola le date in base al tab attivo e all'offset. */
  const getDatesForRange = useCallback((tab: StatsTab, offset: number): { start: string; end: string } => {
    const today = new Date();
    if (tab === 'current_week') {
      const base = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), offset);
      return {
        start: toDateOnly(base),
        end: toDateOnly(endOfWeek(base, { weekStartsOn: 1 })),
      };
    }
    // tab === 'period': naviga per periodi rispetto al periodo salvato
    let cfg: PeriodConfig = loadPeriodConfig();
    if (offset > 0) for (let i = 0; i < offset; i++) cfg = nextPeriodConfig(cfg);
    else if (offset < 0) for (let i = 0; i > offset; i--) cfg = prevPeriodConfig(cfg);
    const r = getPeriodDateRange(cfg);
    return { start: r.startDate, end: r.endDate };
  }, []);

  // Riallinea il filtro quando cambia il reparto del profilo o il login
  useEffect(() => {
    if (lockedDept) setDeptFilter(lockedDept);
    else if (!isAdmin) setDeptFilter('all');
  }, [lockedDept, isAdmin]);

  // Aggiorna le date quando cambia il tab o l'offset
  useEffect(() => {
    const { start, end } = getDatesForRange(statsTab, navOffset);
    setDateStart(start);
    setDateEnd(end);
  }, [statsTab, navOffset, getDatesForRange]);

  // Quando il periodo viene salvato in Impostazioni, ricarica le date correnti
  useEffect(() => {
    const handler = () => {
      const { start, end } = getDatesForRange(statsTab, navOffset);
      setDateStart(start);
      setDateEnd(end);
    };
    window.addEventListener('osteria_period_updated', handler);
    return () => window.removeEventListener('osteria_period_updated', handler);
  }, [statsTab, navOffset, getDatesForRange]);

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

  /** Minuti per utente per giorno (YYYY-MM-DD): stessa logica di minutesByUserByWeek, chiave diversa. */
  const minutesByUserByDay = useMemo(() => {
    const byUser: Record<string, Record<string, number>> = {};
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
        if (ps && pe && ps !== pe) { start = ps; end = pe; } else { continue; }
      }
      const u = users.find((x) => x.id === s.user_id);
      const mins = getNetShiftMinutes(s, start, end, u ?? undefined, breakRules, breakComputeOpts);
      const dayKey = s.date.slice(0, 10);
      if (!byUser[s.user_id]) byUser[s.user_id] = {};
      byUser[s.user_id][dayKey] = (byUser[s.user_id][dayKey] ?? 0) + mins;
    }
    return byUser;
  }, [shifts, punchRecords, rangeStart, rangeEnd, users, breakRules, breakComputeOpts]);

  const displayUsers = useMemo(() => {
    if (!currentUser) return [];

    // Staff: vede solo se stesso
    if (!canViewAllTeamHours(currentUser)) {
      return users.filter(u => u.id === currentUser.id);
    }

    // Gestione: tutti gli utenti attivi eccetto admin (profilo impostazioni puro).
    return users
      .filter((u) => {
        if (u.status !== 'active') return false;
        if (isPurelyManagementRole(u.role)) return false;
        return true;
      })
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [users, currentUser, shifts]);

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

  // Reparti dalla configurazione (rispetta nascosti e ordine), filtrati a quelli con almeno un utente attivo
  const departments = useMemo(() => {
    const usedValues = new Set(users.map(u => u.department).filter(Boolean) as string[]);
    return getDepartments().filter(d => usedValues.has(d.value));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, departmentsRevision]);

  const filteredUsers = useMemo(() => {
    if (deptFilter === 'all') return displayUsers;
    return displayUsers.filter(u => deptMatchesFilterKey(u.department, deptFilter));
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
        {/* ── Toolbar 4-tab (tutti gli utenti) ──────────────────────── */}
        {true && (
          <>
            <div className="ui-toolbar-page-band ui-toolbar-page-band-presences !h-auto !max-h-none min-h-0 flex-row flex-nowrap items-center justify-between gap-1.5 overflow-x-auto relative z-[1000] mb-5">
              <div className="flex min-h-0 min-w-0 flex-1 flex-row flex-nowrap items-center justify-start gap-1.5 overflow-visible relative z-[1001]">
                <div className="ui-toolbar-row-tight min-w-0 shrink-0 md:gap-1.5">
                  {/* Toolbar navigazione */}
                  <div className="ui-toolbar-group md:scale-90 md:origin-left">
                    {/* Prec. — naviga per settimana o per periodo in base al tab attivo */}
                    <button
                      type="button"
                      onClick={() => setNavOffset(o => o - 1)}
                      className="ui-toolbar-tab !px-2 !text-[10px] shrink-0 text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800/80 disabled:opacity-30"
                      aria-label={statsTab === 'current_week' ? 'Settimana precedente' : 'Periodo precedente'}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                      <span className="hidden sm:inline">Prec.</span>
                    </button>

                    {/* Tab Settimana: seleziona vista settimanale */}
                    <button
                      type="button"
                      onClick={() => { setStatsTab('current_week'); setNavOffset(0); }}
                      className={`ui-toolbar-tab !px-2.5 !text-[10px] shrink-0 ${
                        statsTab === 'current_week'
                          ? 'bg-accent text-white font-extrabold'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800/80'
                      }`}
                    >
                      Settimana
                    </button>

                    {/* Mese: seleziona vista periodo e resetta a 0 */}
                    <button
                      type="button"
                      onClick={() => { setStatsTab('period'); setNavOffset(0); }}
                      className={`ui-toolbar-tab !px-2.5 !text-[10px] shrink-0 ${
                        statsTab === 'period' && navOffset === 0
                          ? 'bg-accent text-white font-extrabold'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800/80'
                      }`}
                    >
                      Mese
                    </button>

                    {/* Pros. — naviga per settimana o per periodo */}
                    <button
                      type="button"
                      onClick={() => setNavOffset(o => o + 1)}
                      className="ui-toolbar-tab !px-2 !text-[10px] shrink-0 text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800/80 disabled:opacity-30"
                      aria-label={statsTab === 'current_week' ? 'Settimana successiva' : 'Periodo successivo'}
                    >
                      <span className="hidden sm:inline">Pros.</span>
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>

                  {/* Chip date range */}
                  <div
                    className="ui-toolbar-chip shrink-0 max-w-full min-w-0 cursor-default select-none font-bold !px-2 !h-8 !text-[10px]"
                    role="status"
                  >
                    <Calendar className="hidden sm:block h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-neutral-400" aria-hidden />
                    <span className="min-w-0 truncate tabular-nums">
                      {statsTab === 'current_week' ? (
                        <>
                          <span className="text-slate-400 dark:text-neutral-500">S.{getISOWeek(rangeStart)}&nbsp;</span>
                          {format(rangeStart, 'dd/MM', { locale: statsLoc })}
                          <span className="text-slate-400 dark:text-neutral-500"> → {format(rangeEnd, 'dd/MM', { locale: statsLoc })}</span>
                        </>
                      ) : (
                        <>
                          {format(rangeStart, 'dd/MM', { locale: statsLoc })}
                          <span className="text-slate-400 dark:text-neutral-500"> → </span>
                          {format(rangeEnd, 'dd/MM/yy', { locale: statsLoc })}
                        </>
                      )}
                    </span>
                  </div>
                </div>

              </div>

              {/* PDF + Filtro reparto — lato destro */}
              <div className="flex justify-end md:contents">
                <div className="relative md:ml-auto flex items-center gap-1">
                  {showManagementStatsChrome && isFeatureEnabled(currentUser, 'export_pdf') && (
                    <div className="ui-toolbar-group md:scale-90 md:origin-left">
                      <button
                        type="button"
                        onClick={() => void handleExportStatsPdf()}
                        className="ui-toolbar-tab !px-2 !text-[10px] shrink-0 text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800/80"
                        title={t.download_pdf}
                        aria-label={t.download_pdf}
                      >
                        <FileDown className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="hidden sm:inline">{t.download_pdf}</span>
                      </button>
                    </div>
                  )}
                  {isAdmin && departments.length > 0 && (
                  <div className="relative">
                    <div className="ui-toolbar-group md:scale-90 md:origin-left">
                    <button
                      type="button"
                      onClick={() => setShowDeptMenu(prev => !prev)}
                      className={`ui-toolbar-tab !px-2 !text-[10px] shrink-0 ${
                        showDeptMenu ? 'bg-accent/8 text-accent dark:text-accent-light' : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800/80'
                      } ${deptFilter !== 'all' ? 'font-extrabold' : ''}`}
                    >
                      <Filter className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                      <span className="max-w-[80px] truncate">
                        {deptFilter === 'all' ? 'Reparti' : translateDepartmentValue(deptFilter, effectiveLanguage)}
                      </span>
                      <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${showDeptMenu ? 'rotate-180' : ''}`} />
                    </button>
                    </div>

                    <AnimatePresence>
                      {showDeptMenu && (
                        <>
                          {/* Desktop Dropdown */}
                          <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            className="hidden lg:block absolute right-0 top-full z-[9999] mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-neutral-900"
                            style={{ isolation: 'isolate' }}
                          >
                            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 border-b border-slate-100 dark:border-white/10 mb-1">
                              {t.department_filter_label}
                            </div>
                            <button type="button" onClick={() => { setDeptFilter('all'); setShowDeptMenu(false); }}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-all ${deptFilter === 'all' ? 'bg-accent text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-white/5'}`}>
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                                <Check className={`h-3 w-3 ${deptFilter === 'all' ? 'text-white' : 'text-accent'}`} strokeWidth={3} />
                              </div>
                              <span className="flex-1 truncate">Tutti i reparti</span>
                              {deptFilter === 'all' && <Check className="h-3 w-3 text-white/90" strokeWidth={3} />}
                            </button>
                            <div className="my-1 h-px bg-slate-100 dark:bg-white/5" />
                            {departments.map((d) => (
                              <button key={d.value} type="button" onClick={() => { setDeptFilter(d.value); setShowDeptMenu(false); }}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-all ${deptFilter === d.value ? 'bg-accent text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-white/5'}`}>
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                                  <span className={`h-2.5 w-2.5 rounded-full shadow-sm ${deptFilter === d.value ? 'bg-white' : ''}`}
                                    style={deptFilter !== d.value ? { backgroundColor: d.color ?? getDeptColor(d.value) } : {}} />
                                </div>
                                <span className="flex-1 truncate">{translateDepartmentValue(d.value, effectiveLanguage)}</span>
                                {deptFilter === d.value && <Check className="h-3 w-3 text-white/90" strokeWidth={3} />}
                              </button>
                            ))}
                          </motion.div>

                          {/* Mobile Modal */}
                          <div className="lg:hidden">
                            <CenteredModalPortal open={showDeptMenu} onClose={() => setShowDeptMenu(false)} maxWidthClass="max-w-[280px]" panelClassName="p-1" disableBackdropClose>
                              <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 dark:border-white/10 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">{t.department_filter_label}</span>
                                <button type="button" onClick={() => setShowDeptMenu(false)} className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-neutral-200" aria-label="Chiudi">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <button type="button" onClick={() => { setDeptFilter('all'); setShowDeptMenu(false); }}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-all ${deptFilter === 'all' ? 'bg-accent text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-white/5'}`}>
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                                  <Check className={`h-3 w-3 ${deptFilter === 'all' ? 'text-white' : 'text-accent'}`} strokeWidth={3} />
                                </div>
                                <span className="flex-1 truncate">Tutti i reparti</span>
                                {deptFilter === 'all' && <Check className="h-3 w-3 text-white/90" strokeWidth={3} />}
                              </button>
                              <div className="my-1 h-px bg-slate-100 dark:bg-white/5" />
                              {departments.map((d) => (
                                <button key={d.value} type="button" onClick={() => { setDeptFilter(d.value); setShowDeptMenu(false); }}
                                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-all ${deptFilter === d.value ? 'bg-accent text-white shadow-md' : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-white/5'}`}>
                                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                                    <span className={`h-2.5 w-2.5 rounded-full shadow-sm ${deptFilter === d.value ? 'bg-white' : ''}`}
                                      style={deptFilter !== d.value ? { backgroundColor: d.color ?? getDeptColor(d.value) } : {}} />
                                  </div>
                                  <span className="flex-1 truncate">{translateDepartmentValue(d.value, effectiveLanguage)}</span>
                                  {deptFilter === d.value && <Check className="h-3 w-3 text-white/90" strokeWidth={3} />}
                                </button>
                              ))}
                            </CenteredModalPortal>
                          </div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                  )}
                </div>
              </div>
             </div>
          </>
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
        {!showManagementStatsChrome && (
          <div className="mb-8 md:mb-6">
            <div className="surface-glass overflow-hidden border-l-4 border-l-accent border border-accent/20 dark:border-accent/15 bg-accent/5 dark:bg-accent/10">
              <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
                <p className="text-xs font-bold uppercase tracking-widest text-accent dark:text-accent-light">
                  {t.stats_your_hours_in_range}
                </p>
                <p className="text-2xl font-bold tabular-nums text-accent-dark dark:text-accent-light">
                  {staffRangeTotalMins > 0 ? formatMinutesToHoursAndMinutes(staffRangeTotalMins) : '–'}
                </p>
              </div>
              {staffRangeTotalMins === 0 ? (
                <div className="border-t border-accent/10 dark:border-accent/15 flex flex-col items-center gap-3 p-8 pb-12 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 dark:bg-accent/20">
                    <Calendar className="h-5 w-5 text-accent/50 dark:text-accent-light/50" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100">{t.stats_no_data}</p>
                  <p className="max-w-xs text-xs leading-relaxed text-slate-500 dark:text-neutral-300">{t.stats_no_confirmed_shifts_period}</p>
                </div>
              ) : (
                <div className="border-t border-accent/15 dark:border-accent/20">
                  {weeksInRange.map((w) => {
                    const weekMins = minutesByUserByWeek[currentUser.id]?.[w.key] ?? 0;
                    const clampedStart = w.start < rangeStart ? rangeStart : w.start;
                    const clampedEnd   = w.end   > rangeEnd   ? rangeEnd   : w.end;
                    const weekDays = eachDayOfInterval({ start: clampedStart, end: clampedEnd });
                    return (
                      <div key={`staff-${w.key}`} className="border-b border-accent/10 last:border-0 dark:border-accent/15">
                        {/* Mobile: layout fisso senza scroll */}
                        <div className="sm:hidden px-3 py-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-accent/60 dark:text-accent-light/50">
                              {format(clampedStart, 'dd/MM')} → {format(clampedEnd, 'dd/MM')}
                            </span>
                            <span className={`text-sm font-extrabold tabular-nums ${weekMins > 0 ? 'text-accent-dark dark:text-accent-light' : 'text-accent/25 dark:text-accent-light/20'}`}>
                              {weekMins > 0 ? formatMinutesToHoursAndMinutes(weekMins) : '—'}
                            </span>
                          </div>
                          <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${weekDays.length}, 1fr)` }}>
                            {weekDays.map((day) => {
                              const dayKey = format(day, 'yyyy-MM-dd');
                              const mins = minutesByUserByDay[currentUser.id]?.[dayKey] ?? 0;
                              return (
                                <div key={dayKey} className="flex flex-col items-center py-1.5">
                                  <span className="block text-[8px] font-bold uppercase text-accent/40 dark:text-accent-light/35 leading-none mb-0.5">
                                    {format(day, 'EEE', { locale: statsLoc }).slice(0, 3)}
                                  </span>
                                  <span className="block text-[8px] text-accent/30 dark:text-accent-light/25 tabular-nums leading-none mb-1">
                                    {format(day, 'dd')}
                                  </span>
                                  {mins > 0 ? (
                                    <span className="text-[11px] font-bold text-accent-dark dark:text-accent-light tabular-nums leading-none">
                                      {formatMinutesToHoursAndMinutes(mins)}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-accent/20 dark:text-accent-light/20 leading-none">—</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* Desktop: tabella scrollabile */}
                        <div className="hidden sm:block overflow-x-auto [-webkit-overflow-scrolling:touch]">
                          <table className="w-full border-collapse" style={{ minWidth: `${weekDays.length * 60 + 120}px` }}>
                            <thead>
                              <tr>
                                <th className="py-2 pl-5 pr-2 text-left text-[9px] font-bold uppercase tracking-wider text-accent/50 dark:text-accent-light/40">
                                  {w.label}
                                </th>
                                {weekDays.map((day) => (
                                  <th key={format(day, 'yyyy-MM-dd')} className="px-2 py-2 text-center min-w-[60px]">
                                    <span className="block text-[9px] font-bold uppercase tracking-wider text-accent/50 dark:text-accent-light/40">
                                      {format(day, 'EEE', { locale: statsLoc })}
                                    </span>
                                    <span className="block text-[9px] font-semibold text-accent/40 dark:text-accent-light/30 tabular-nums">
                                      {format(day, 'dd/MM')}
                                    </span>
                                  </th>
                                ))}
                                <th className="py-2 pl-2 pr-5 text-right text-[9px] font-bold uppercase tracking-wider text-accent/50 dark:text-accent-light/40 min-w-[60px]">
                                  Tot.
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {/* Colonna label settimana (allineata con l'header) */}
                                <td />
                                {weekDays.map((day) => {
                                  const dayKey = format(day, 'yyyy-MM-dd');
                                  const mins = minutesByUserByDay[currentUser.id]?.[dayKey] ?? 0;
                                  return (
                                    <td key={dayKey} className="px-2 py-2.5 text-right tabular-nums">
                                      {mins > 0 ? (
                                        <span className="text-[13px] font-bold text-accent-dark dark:text-accent-light">
                                          {formatMinutesToHoursAndMinutes(mins)}
                                        </span>
                                      ) : (
                                        <span className="text-[13px] font-normal text-accent/20 dark:text-accent-light/20">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="py-2.5 pl-2 pr-5 text-right tabular-nums">
                                  <span className={`text-[13px] font-extrabold ${weekMins > 0 ? 'text-accent-dark dark:text-accent-light' : 'text-accent/20 dark:text-accent-light/20'}`}>
                                    {weekMins > 0 ? formatMinutesToHoursAndMinutes(weekMins) : '—'}
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {uiW('stats.table') && displayUsers.length > 1 && (
          <div className="mb-6 space-y-4">
            {showManagementStatsChrome && (
              <div className="surface-glass overflow-hidden border-l-4 border-l-accent border border-accent/20 dark:border-accent/15 bg-accent/5 dark:bg-accent/10">
                {/* Intestazione totale */}
                <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-accent dark:text-accent-light">
                    {tv.stats_mgmt_personal_hours_period ?? t.stats_your_hours_in_range}
                  </p>
                  <p className="text-2xl font-bold tabular-nums text-accent-dark dark:text-accent-light">
                    {mgmtPersonalTotalMins > 0 ? formatMinutesToHoursAndMinutes(mgmtPersonalTotalMins) : '–'}
                  </p>
                </div>
                {/* Griglia giornaliera per settimana */}
                {mgmtPersonalTotalMins > 0 && (
                  <div className="border-t border-accent/15 dark:border-accent/20">
                    {weeksInRange.map((w) => {
                      const weekMins = minutesByUserByWeek[currentUser.id]?.[w.key] ?? 0;
                      const clampedStart = w.start < rangeStart ? rangeStart : w.start;
                      const clampedEnd   = w.end   > rangeEnd   ? rangeEnd   : w.end;
                      const weekDays = eachDayOfInterval({ start: clampedStart, end: clampedEnd });
                      return (
                        <div key={`self-${w.key}`} className="border-b border-accent/10 last:border-0 dark:border-accent/15">
                          {/* ── Mobile: layout fisso senza scroll ── */}
                          <div className="sm:hidden px-3 py-2">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[9px] font-bold uppercase tracking-wide text-accent/60 dark:text-accent-light/50">
                                {format(clampedStart, 'dd/MM')} → {format(clampedEnd, 'dd/MM')}
                              </span>
                              <span className={`text-sm font-extrabold tabular-nums ${weekMins > 0 ? 'text-accent-dark dark:text-accent-light' : 'text-accent/25 dark:text-accent-light/20'}`}>
                                {weekMins > 0 ? formatMinutesToHoursAndMinutes(weekMins) : '—'}
                              </span>
                            </div>
                            <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${weekDays.length}, 1fr)` }}>
                              {weekDays.map((day) => {
                                const dayKey = format(day, 'yyyy-MM-dd');
                                const mins = minutesByUserByDay[currentUser.id]?.[dayKey] ?? 0;
                                return (
                                  <div key={dayKey} className="flex flex-col items-center py-1.5 rounded">
                                    <span className="block text-[8px] font-bold uppercase text-accent/40 dark:text-accent-light/35 leading-none mb-0.5">
                                      {format(day, 'EEE', { locale: statsLoc }).slice(0, 3)}
                                    </span>
                                    <span className="block text-[8px] text-accent/30 dark:text-accent-light/25 tabular-nums leading-none mb-1">
                                      {format(day, 'dd')}
                                    </span>
                                    {mins > 0 ? (
                                      <span className="text-[11px] font-bold text-accent-dark dark:text-accent-light tabular-nums leading-none">
                                        {formatMinutesToHoursAndMinutes(mins)}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-accent/20 dark:text-accent-light/20 leading-none">—</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {/* ── Desktop: tabella scrollabile ── */}
                          <div className="hidden sm:block overflow-x-auto [-webkit-overflow-scrolling:touch]">
                            <table className="w-full border-collapse table-fixed" style={{ minWidth: `${weekDays.length * 72 + 130}px` }}>
                              <colgroup>
                                <col style={{ width: '120px' }} />
                                {weekDays.map((day) => (
                                  <col key={format(day, 'yyyy-MM-dd')} style={{ width: '72px' }} />
                                ))}
                                <col style={{ width: '72px' }} />
                              </colgroup>
                              <thead>
                                <tr>
                                  <th className="py-2 pl-5 pr-2 text-left text-[9px] font-bold uppercase tracking-wider text-accent/50 dark:text-accent-light/40">
                                    {w.label}
                                  </th>
                                  {weekDays.map((day) => (
                                    <th key={format(day, 'yyyy-MM-dd')} className="py-2 pr-3 text-right">
                                      <span className="block text-[9px] font-bold uppercase tracking-wider text-accent/50 dark:text-accent-light/40">
                                        {format(day, 'EEE', { locale: statsLoc })}
                                      </span>
                                      <span className="block text-[9px] font-semibold text-accent/40 dark:text-accent-light/30 tabular-nums">
                                        {format(day, 'dd/MM')}
                                      </span>
                                    </th>
                                  ))}
                                  <th className="py-2 pr-5 text-right text-[9px] font-bold uppercase tracking-wider text-accent/50 dark:text-accent-light/40">
                                    Tot.
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  {/* Colonna label settimana (allineata con l'header) */}
                                  <td />
                                  {weekDays.map((day) => {
                                    const dayKey = format(day, 'yyyy-MM-dd');
                                    const mins = minutesByUserByDay[currentUser.id]?.[dayKey] ?? 0;
                                    return (
                                      <td key={dayKey} className="py-2.5 pr-3 text-right tabular-nums">
                                        {mins > 0 ? (
                                          <span className="text-[13px] font-bold text-accent-dark dark:text-accent-light">
                                            {formatMinutesToHoursAndMinutes(mins)}
                                          </span>
                                        ) : (
                                          <span className="text-[13px] font-normal text-accent/20 dark:text-accent-light/20">—</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="py-2.5 pr-5 text-right tabular-nums">
                                    <span className={`text-[13px] font-extrabold ${weekMins > 0 ? 'text-accent-dark dark:text-accent-light' : 'text-accent/20 dark:text-accent-light/20'}`}>
                                      {weekMins > 0 ? formatMinutesToHoursAndMinutes(weekMins) : '—'}
                                    </span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {showManagementStatsChrome && (
              <div className="surface-glass border-l-4 border-l-[#0052FF] border border-[#0052FF]/20 dark:border-[#0052FF]/18 bg-[#0052FF]/6 dark:bg-[#0052FF]/10 p-5 sm:p-6">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#0052FF] dark:text-[#00D1FF]">
                  {deptFilter === 'all' ? (tv.stats_team_hours_period ?? t.stats_total) : `TOTALE ${translateDepartmentValue(deptFilter, effectiveLanguage).toUpperCase()}`}
                </p>
                <p className="text-3xl font-bold tabular-nums text-[#0052FF] dark:text-[#00D1FF]/80">
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
                // Giorni della settimana ritagliati sul range selezionato
                const clampedStart = w.start < rangeStart ? rangeStart : w.start;
                const clampedEnd   = w.end   > rangeEnd   ? rangeEnd   : w.end;
                const weekDays = eachDayOfInterval({ start: clampedStart, end: clampedEnd });
                return (
                  <div key={w.key} className="overflow-hidden rounded-2xl border border-[#0052FF]/20 dark:border-[#0052FF]/18 bg-gradient-to-br from-[#0052FF]/6 via-white to-white dark:from-[#0052FF]/10 dark:via-neutral-900 dark:to-neutral-900 shadow-sm">
                    {/* Intestazione settimana */}
                    <div className="px-4 py-2.5 sm:px-5 border-b border-[#0052FF]/15 dark:border-[#0052FF]/18 bg-[#0052FF]/80/8 dark:bg-[#0052FF]/8 flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#0052FF] dark:text-[#00D1FF]">{w.label}</p>
                      {showManagementStatsChrome && weekTotal > 0 && (
                        <span className="tabular-nums text-sm font-extrabold text-[#0052FF] dark:text-[#00D1FF]">
                          {formatMinutesToHoursAndMinutes(weekTotal)}
                        </span>
                      )}
                    </div>
                    {/* ── Mobile: layout compatto senza scroll ── */}
                    <div className="sm:hidden px-3 pb-3 pt-1 space-y-1.5">
                      {/* Header giorni (fisso per tutte le righe) */}
                      <div className="flex items-center gap-1">
                        <div className="w-[72px] shrink-0" />
                        <div className="grid flex-1 gap-0" style={{ gridTemplateColumns: `repeat(${weekDays.length}, 1fr)` }}>
                          {weekDays.map((day) => (
                            <div key={format(day, 'yyyy-MM-dd')} className="flex flex-col items-center">
                              <span className="text-[7px] font-bold uppercase text-[#0052FF] dark:text-[#00D1FF] leading-none">
                                {format(day, 'EEE', { locale: statsLoc }).slice(0, 3)}
                              </span>
                              <span className="text-[7px] text-[#0052FF]/45 dark:text-[#0052FF]/80 tabular-nums leading-none mt-0.5">
                                {format(day, 'dd')}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="w-[44px] shrink-0 text-right text-[7px] font-bold uppercase text-[#0052FF]/45 dark:text-[#0052FF]">Tot.</div>
                      </div>
                      {/* Righe utenti */}
                      {filteredUsers.map((u, i) => {
                        const userWeekTotal = minutesByUserByWeek[u.id]?.[w.key] ?? 0;
                        const rowBg = i % 2 === 0 ? 'bg-[#0052FF]/5 dark:bg-[#0052FF]/5' : '';
                        return (
                          <div key={u.id} className={`flex items-center gap-1 rounded-lg py-1.5 ${rowBg}`}>
                            <div className="w-[72px] shrink-0 pl-1">
                              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:text-neutral-200 truncate">
                                {(u.first_name ?? '').trim() || '—'}
                              </span>
                              {deptFilter === 'all' && u.department && (
                                <span className="block text-[8px] font-bold text-slate-400 dark:text-neutral-500 uppercase leading-none truncate mt-0.5">
                                  {translateDepartmentValue(u.department, effectiveLanguage)}
                                </span>
                              )}
                            </div>
                            <div className="grid flex-1 gap-0" style={{ gridTemplateColumns: `repeat(${weekDays.length}, 1fr)` }}>
                              {weekDays.map((day) => {
                                const dayKey = format(day, 'yyyy-MM-dd');
                                const mins = minutesByUserByDay[u.id]?.[dayKey] ?? 0;
                                return (
                                  <div key={dayKey} className="flex items-center justify-center">
                                    {mins > 0 ? (
                                      <span className="text-[10px] font-bold text-[#0052FF] dark:text-[#00D1FF]/80 tabular-nums">
                                        {formatMinutesToHoursAndMinutes(mins)}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-300 dark:text-neutral-700">—</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="w-[44px] shrink-0 text-right pr-1">
                              <span className={`text-[11px] font-extrabold tabular-nums ${userWeekTotal > 0 ? 'text-[#0052FF] dark:text-[#00D1FF]' : 'text-slate-300 dark:text-neutral-700'}`}>
                                {userWeekTotal > 0 ? formatMinutesToHoursAndMinutes(userWeekTotal) : '—'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {/* Footer totali giornalieri su mobile */}
                      {showManagementStatsChrome && weekTotal > 0 && (
                        <div className="flex items-center gap-1 pt-1 border-t border-[#0052FF]/15 dark:border-[#0052FF]/18 mt-1 bg-[#0052FF]/6 dark:bg-[#0052FF]/10 rounded-lg">
                          <div className="w-[72px] shrink-0 pl-1 text-[9px] font-bold uppercase tracking-wide text-[#0052FF] dark:text-[#00D1FF]">
                            {t.stats_total}
                          </div>
                          <div className="grid flex-1 gap-0" style={{ gridTemplateColumns: `repeat(${weekDays.length}, 1fr)` }}>
                            {weekDays.map((day) => {
                              const dayKey = format(day, 'yyyy-MM-dd');
                              const dayTotal = filteredUsers.reduce(
                                (sum, u) => sum + (minutesByUserByDay[u.id]?.[dayKey] ?? 0),
                                0
                              );
                              return (
                                <div key={dayKey} className="flex items-center justify-center">
                                  {dayTotal > 0 ? (
                                    <span className="text-[10px] font-bold text-[#0052FF] dark:text-[#00D1FF] tabular-nums">
                                      {formatMinutesToHoursAndMinutes(dayTotal)}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-300 dark:text-neutral-700">—</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="w-[44px] shrink-0 text-right pr-1">
                            <span className="text-[11px] font-extrabold text-[#0052FF] dark:text-[#00D1FF] tabular-nums">
                              {formatMinutesToHoursAndMinutes(weekTotal)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* ── Desktop: tabella scrollabile ── */}
                    <div className="hidden sm:block overflow-x-auto [-webkit-overflow-scrolling:touch]">
                      <table className="w-full border-collapse table-fixed" style={{ minWidth: `${weekDays.length * 72 + 140}px` }}>
                        <colgroup>
                          <col style={{ width: '130px' }} />
                          {weekDays.map((day) => (
                            <col key={format(day, 'yyyy-MM-dd')} style={{ width: '72px' }} />
                          ))}
                          <col style={{ width: '72px' }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-[#0052FF]/6 dark:bg-[#0052FF]/7">
                            <th className="sticky left-0 z-10 bg-[#0052FF]/7 dark:bg-[#0052FF]/12 backdrop-blur-sm py-2 pl-5 pr-3 text-left text-[9px] font-bold uppercase tracking-wider text-[#0052FF] dark:text-[#0052FF]">
                              {tv.department_filter_label ?? 'Nome'}
                            </th>
                            {weekDays.map((day) => (
                              <th key={format(day, 'yyyy-MM-dd')} className="py-2 pr-3 text-right">
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-[#0052FF] dark:text-[#00D1FF]">
                                  {format(day, 'EEE', { locale: statsLoc })}
                                </span>
                                <span className="block text-[9px] font-semibold text-[#00D1FF]/70 dark:text-[#0052FF] tabular-nums">
                                  {format(day, 'dd/MM')}
                                </span>
                              </th>
                            ))}
                            <th className="py-2 pr-5 text-right text-[9px] font-bold uppercase tracking-wider text-[#00D1FF]/70 dark:text-[#0052FF]">
                              Tot.
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.map((u, i) => {
                            const userWeekTotal = minutesByUserByWeek[u.id]?.[w.key] ?? 0;
                            const rowBg = i % 2 === 0 ? 'bg-[#0052FF]/5 dark:bg-[#0052FF]/5' : '';
                            return (
                              <tr key={u.id} className={rowBg}>
                                <td className={`sticky left-0 z-10 backdrop-blur-sm py-2.5 pl-5 pr-3 ${i % 2 === 0 ? 'bg-[#0052FF]/5 dark:bg-[#0052FF]/7' : 'bg-white dark:bg-neutral-900'}`}>
                                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-800 dark:text-neutral-100 truncate">
                                    {(u.first_name ?? '').trim() || '—'}
                                  </span>
                                  {deptFilter === 'all' && u.department && (
                                    <span className="block text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider truncate">
                                      {translateDepartmentValue(u.department, effectiveLanguage)}
                                    </span>
                                  )}
                                </td>
                                {weekDays.map((day) => {
                                  const dayKey = format(day, 'yyyy-MM-dd');
                                  const mins = minutesByUserByDay[u.id]?.[dayKey] ?? 0;
                                  return (
                                    <td key={dayKey} className="py-2.5 pr-3 text-right tabular-nums">
                                      {mins > 0 ? (
                                        <span className="text-[13px] font-bold text-[#0052FF] dark:text-[#00D1FF]/80">
                                          {formatMinutesToHoursAndMinutes(mins)}
                                        </span>
                                      ) : (
                                        <span className="text-[13px] font-normal text-slate-300 dark:text-neutral-700">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="py-2.5 pr-5 text-right tabular-nums">
                                  <span className={`text-[13px] font-extrabold ${userWeekTotal > 0 ? 'text-[#0052FF] dark:text-[#00D1FF]' : 'text-slate-300 dark:text-neutral-700'}`}>
                                    {userWeekTotal > 0 ? formatMinutesToHoursAndMinutes(userWeekTotal) : '—'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {showManagementStatsChrome && (
                          <tfoot>
                            <tr className="border-t border-[#0052FF]/15 dark:border-[#0052FF]/18 bg-[#0052FF]/6 dark:bg-[#0052FF]/10">
                              <td className="sticky left-0 z-10 bg-[#0052FF]/7 dark:bg-[#0052FF]/12 py-2.5 pl-5 pr-3 text-[9px] font-bold uppercase tracking-wider text-[#0052FF] dark:text-[#00D1FF]">
                                {t.stats_total}
                              </td>
                              {weekDays.map((day) => {
                                const dayKey = format(day, 'yyyy-MM-dd');
                                const dayTotal = filteredUsers.reduce(
                                  (sum, u) => sum + (minutesByUserByDay[u.id]?.[dayKey] ?? 0),
                                  0
                                );
                                return (
                                  <td key={dayKey} className="py-2.5 pr-3 text-right tabular-nums">
                                    {dayTotal > 0 ? (
                                      <span className="text-[13px] font-bold text-[#0052FF] dark:text-[#00D1FF]">
                                        {formatMinutesToHoursAndMinutes(dayTotal)}
                                      </span>
                                    ) : (
                                      <span className="text-[13px] font-normal text-slate-300 dark:text-neutral-700">—</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="py-2.5 pr-5 text-right tabular-nums">
                                <span className="text-[13px] font-extrabold text-[#0052FF] dark:text-[#00D1FF]">
                                  {weekTotal > 0 ? formatMinutesToHoursAndMinutes(weekTotal) : '—'}
                                </span>
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </motion.div>
    </div>
  );
}
