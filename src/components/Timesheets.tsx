import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  format,
  addDays,
  parseISO,
  isToday,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isValid,
} from 'date-fns';
import { it } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Check, AlertTriangle, X,
  Clock, History, FileEdit, ShieldAlert, LogOut, Lock, Unlock,
  Users, UserCheck, AlertCircle, ArrowRight, Calendar, Moon,
  ChevronDown, FileDown, UserX,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getTranslations, getDateLocale, formatTrans } from '../utils/translations';
import { calculateShiftMinutesGross, formatMinutesToHoursAndMinutes } from '../utils/timeCalculations';
import { getBreakMinutesForShift, getNetShiftMinutes } from '../utils/breakRules';
import {
  isPurelyManagementRole,
  isUserVisibleOnTeamSchedule,
  canOperateTeamSchedule,
  canApproveShiftActions,
  findFreezeVerifierByPin,
} from '../utils/permissions';
import { isFeatureEnabled } from '../utils/enabledFeatures';
import { isUiWidgetVisible } from '../utils/uiScreenWidgets';
import { getShiftHistory, type HistoryEntry } from '../utils/scheduleHistory';
import { safeFormatDate } from '../utils/safeDateFormat';
import { database } from '../lib/database';
import { TimeInputField } from './ui/TimeInputField';
import {
  loadPeriodConfig,
  savePeriodConfig as persistPeriodConfig,
  getPeriodStartDate,
  getPeriodEndDate,
  PERIOD_STORAGE_KEY,
  dispatchPeriodConfigUpdated,
  type PeriodConfig,
} from '../utils/periodConfig';
import { saveTimesheetPeriodToSupabase } from '../utils/timesheetPeriodSupabase';
import type { PunchAuditEntry, PunchRecord, PunchRecordSource, Shift } from '../types';
import { getResolvedStartEndForHours, shiftPastPlannedEndWithoutClockIn } from '../utils/shiftResolvedClockTimes';
import { HorizontalScrollArea } from './HorizontalScrollArea';
import DatePickerField from './DatePickerField';
import TimesheetManagementKpiBlock from './TimesheetManagementKpiBlock';
import { CenteredModalPortal } from './ui/CenteredModalPortal';
import { getPayrollPaymentDateForCalendarMonth } from '../utils/payrollSchedule';
import { exportAttendancePdfFromGrid } from '../utils/timesheetPdfFromRange';
import { isShiftPayrollFrozen, shiftCanBeFrozenFromTimesheet } from '../utils/timesheetFreezeCriteria';

// ── Helpers ─────────────────────────────────────────────────────────────────

function toMinutesFromMidnight(hhmm: string): number {
  const [h, m] = (hhmm || '00:00').slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fmtHM(mins: number): string {
  if (mins === 0) return '0h';
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  const sign = mins < 0 ? '−' : '';
  return m > 0 ? `${sign}${h}h${m.toString().padStart(2, '0')}` : `${sign}${h}h`;
}

/** Formatta un valore audit: se è un ISO timestamp lo converte in dd/MM HH:mm, altrimenti lo restituisce as-is */
function fmtAuditValue(v: string | null | undefined): string {
  if (!v) return '—';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    try {
      const d = new Date(v);
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return v; }
  }
  return v;
}

function punchTimeHHMM(ts: string | null | undefined): string | null {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return null; }
}

function punchSourceLabel(
  source: PunchRecordSource | null | undefined,
  t: ReturnType<typeof getTranslations>
): string {
  if (source === 'manual') return t.ts_punch_source_manual;
  if (source === 'manager') return t.ts_punch_source_manager;
  if (source === 'kiosk') return t.ts_punch_source_kiosk;
  return t.ts_punch_source_legacy;
}

/** Stesso criterio della griglia presenze (`timesheetData`) per l’IN. */
function findPunchInForShiftOnDate(
  shift: Shift,
  userId: string,
  dateStr: string,
  punchRecords: PunchRecord[]
): PunchRecord | undefined {
  const plannedStart = (shift.start_time || '').slice(0, 5);
  const shiftHour = parseInt(plannedStart.split(':')[0], 10);
  const isLunch = shiftHour < 16;
  return punchRecords.find((p) => {
    if (p.type !== 'in') return false;
    if (shift.id && p.shift_id) return p.shift_id === shift.id;
    if (p.user_id !== userId) return false;
    const pDate = new Date(p.timestamp);
    if (!isValid(pDate)) return false;
    if (format(pDate, 'yyyy-MM-dd') !== dateStr) return false;
    return isLunch ? pDate.getHours() < 16 : pDate.getHours() >= 16;
  });
}

/** Indice settimana nel periodo Presenze: sopravvive a uscite dalla pagina (stesso browser). */
function timesheetWeekStorageKey(startDate: string, numWeeks: 4 | 5): string {
  return `osteria_ts_weekIdx_${startDate}_${numWeeks}`;
}

function readStoredWeekIndex(startDate: string, numWeeks: 4 | 5): number {
  try {
    const raw = sessionStorage.getItem(timesheetWeekStorageKey(startDate, numWeeks));
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    const max = numWeeks - 1;
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, max);
  } catch {
    return 0;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ClosingShiftState {
  shiftId: string;
  punchInId: string;
  dateStr: string;
  plannedStart: string;
  plannedEnd: string;
  plannedMins: number;
  actualStart: string;
  employeeName: string;
}

interface ShiftRow {
  id: string;
  plannedStart: string;
  plannedEnd: string;
  plannedMins: number;
  breakMinutes: number;
  actualStart: string | null;
  actualEnd: string | null;
  actualEndFull?: string;
  actualMins: number;
  deltaMins: number;
  status: 'approved' | 'confirmed' | 'draft' | 'absent';
  punched: boolean;
  punchInId?: string;
  punchOutId?: string;
  punchInSource?: PunchRecordSource | null;
  punchOutSource?: PunchRecordSource | null;
  isLate: boolean;
  hasMissingOut: boolean;
  isCrossDay?: boolean;
  approved_by?: string;
  approved_at?: string;
}

interface DayData {
  dateStr: string;
  shifts: ShiftRow[];
  totalPlannedMins: number;
  totalActualMins: number;
  totalDeltaMins: number;
}

interface DrawerData {
  shift: ShiftRow;
  userId: string;
  employeeName: string;
  department?: string;
  dateStr: string;
  punchAuditEntries: PunchAuditEntry[];
  shiftEdits: HistoryEntry[];
}

function shiftRowPayrollFrozen(s: ShiftRow): boolean {
  return isShiftPayrollFrozen({
    approval_status: s.status,
    approved_at: s.approved_at ?? null,
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Timesheets() {
  const {
    users,
    shifts,
    punchRecords,
    currentUser,
    updateShift,
    approveShift,
    updatePunchRecord,
    addPunchRecord,
    deletePunchRecordsForShift,
    effectiveLanguage,
    showSuccess,
    showError,
    featureFlags,
    breakRules,
  } = useApp();
  const t = getTranslations(effectiveLanguage);
  const locale = getDateLocale(effectiveLanguage) ?? it;

  const formatAuditValue = useCallback((raw: string | undefined) => {
    if (raw == null || raw === '') return '—';
    if (raw.length >= 12 && (raw.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(raw))) {
      try {
        const d = parseISO(raw);
        if (!Number.isNaN(d.getTime())) return format(d, 'dd/MM HH:mm', { locale });
      } catch {
        /* ignore */
      }
    }
    return raw.length > 40 ? `${raw.slice(0, 37)}…` : raw;
  }, [locale]);

  const punchAuditFieldLabel = useCallback(
    (field: string) => {
      const tr = t as Record<string, string>;
      if (field === 'timestamp') return tr.ts_audit_field_timestamp || 'Entrata';
      if (field === 'calculated_time') return tr.ts_audit_field_calculated_time || 'Entrata (arrotondata)';
      if (field === 'clock_out_time') return tr.ts_audit_field_clock_out_time || 'Uscita';
      return field;
    },
    [t]
  );

  const canTeamTimesheetOps = currentUser ? canOperateTeamSchedule(currentUser) : false;
  const canTimesheetApprove = currentUser ? canApproveShiftActions(currentUser) : false;
  const uiW = (key: string) => (currentUser ? isUiWidgetVisible(currentUser, key) : false);

  const now = new Date();
  const initialConfig = loadPeriodConfig();
  /** Evita setWeekIndex(0) se loadPeriodConfig() coincide con il periodo già in memoria (es. rientro su Presenze). */
  const periodSyncRef = useRef<{ startDate: string; numWeeks: 4 | 5 } | null>(null);
  const [periodConfig, setPeriodConfig] = useState(initialConfig);
  const [periodStart, setPeriodStart] = useState<string>(initialConfig.startDate);
  const [periodNumWeeks, setPeriodNumWeeks] = useState<4 | 5>(initialConfig.numWeeks);
  const [periodSaved, setPeriodSaved] = useState(true);

  const handleSavePeriodConfig = () => {
    const cfg = { startDate: periodStart, numWeeks: periodNumWeeks };
    persistPeriodConfig(cfg);
    setPeriodConfig(cfg);
    setPeriodSaved(true);
    setWeekIndex(0);
    dispatchPeriodConfigUpdated();
    showSuccess?.(t.ts_period_saved);
    void saveTimesheetPeriodToSupabase(cfg).catch(() => {
      showError?.(t.ts_period_cloud_failed);
    });
  };

  /** Allinea stato UI al periodo salvato in localStorage (altri profili, altre schede, evento globale). */
  const applyPeriodFromStorage = useCallback(() => {
    const cfg = loadPeriodConfig();
    const prev = periodSyncRef.current;
    const configChanged =
      prev !== null && (prev.startDate !== cfg.startDate || prev.numWeeks !== cfg.numWeeks);
    periodSyncRef.current = { startDate: cfg.startDate, numWeeks: cfg.numWeeks };

    setPeriodConfig(cfg);
    setPeriodStart(cfg.startDate);
    setPeriodNumWeeks(cfg.numWeeks);
    setPeriodSaved(true);
    if (configChanged) setWeekIndex(0);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onCustom = () => applyPeriodFromStorage();
    const onStorage = (e: StorageEvent) => {
      if (e.key === PERIOD_STORAGE_KEY) applyPeriodFromStorage();
    };
    window.addEventListener('osteria_period_updated', onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('osteria_period_updated', onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, [applyPeriodFromStorage]);

  useEffect(() => {
    if (!currentUser?.id) return;
    applyPeriodFromStorage();
  }, [currentUser?.id, applyPeriodFromStorage]);

  type ViewMode = 'week' | 'month';
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekIndex, setWeekIndex] = useState(() =>
    readStoredWeekIndex(initialConfig.startDate, initialConfig.numWeeks)
  );

  /** Periodo effettivo in griglia: bozza (data/settimane) finché non si salva, altrimenti config persistita. */
  const displayPeriodConfig: PeriodConfig = useMemo(() => {
    if (periodSaved) return periodConfig;
    const startStr = periodStart.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr)) {
      return { startDate: periodConfig.startDate, numWeeks: periodNumWeeks };
    }
    const d = parseISO(startStr);
    if (Number.isNaN(d.getTime())) {
      return { startDate: periodConfig.startDate, numWeeks: periodNumWeeks };
    }
    return { startDate: startStr, numWeeks: periodNumWeeks };
  }, [periodSaved, periodConfig, periodStart, periodNumWeeks]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        timesheetWeekStorageKey(displayPeriodConfig.startDate, displayPeriodConfig.numWeeks),
        String(weekIndex)
      );
    } catch {
      /* ignore */
    }
  }, [displayPeriodConfig.startDate, displayPeriodConfig.numWeeks, weekIndex]);

  const periodStartDate = getPeriodStartDate(displayPeriodConfig);
  const periodEndDate = getPeriodEndDate(displayPeriodConfig);
  const allPeriodDays = (() => {
    try {
      const end = periodEndDate >= periodStartDate ? periodEndDate : addDays(periodStartDate, 6);
      return eachDayOfInterval({ start: periodStartDate, end });
    } catch {
      return eachDayOfInterval({ start: periodStartDate, end: addDays(periodStartDate, 6) });
    }
  })();

  /** Vista Mese: griglia lun–dom allineata al calcolo paghe (settimane intere sul periodo). */
  const calendarPaddedDays = useMemo(() => {
    const calStart = startOfWeek(periodStartDate, { weekStartsOn: 1 });
    const calEnd = endOfWeek(periodEndDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [periodStartDate, periodEndDate]);

  /** Settimana e mese: una sola paga evidenziata = quella del mese civile che contiene la **fine** del periodo (es. fine marzo → 30/03, non altri lunedì della griglia). */
  const weekViewPayrollDayStr = useMemo(
    () => format(getPayrollPaymentDateForCalendarMonth(periodEndDate), 'yyyy-MM-dd'),
    [periodEndDate]
  );

  /** Riferimento unico in toolbar vista mese: data pagamento per quel periodo. */
  const payrollStripForToolbar = useMemo(() => {
    const pay = getPayrollPaymentDateForCalendarMonth(periodEndDate);
    return format(pay, 'd MMM yyyy', { locale });
  }, [periodEndDate, locale]);

  const maxWeekIndex = displayPeriodConfig.numWeeks - 1;
  const [auditDetailShiftId, setAuditDetailShiftId] = useState<string | null>(null);
  const [approvingShiftId, setApprovingShiftId] = useState<string | null>(null);
  const [punchAudits, setPunchAudits] = useState<Record<string, PunchAuditEntry[]>>({});
  const [closingShift, setClosingShift] = useState<ClosingShiftState | null>(null);
  const [clockOutTime, setClockOutTime] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);
  const [drawerData, setDrawerData] = useState<DrawerData | null>(null);
  const [unlockModalShiftId, setUnlockModalShiftId] = useState<string | null>(null);
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [drawerEditStart, setDrawerEditStart] = useState('');
  const [drawerEditEnd, setDrawerEditEnd] = useState('');
  const [drawerEditSaving, setDrawerEditSaving] = useState(false);
  const [drawerEditOutDate, setDrawerEditOutDate] = useState('');
  const [drawerEditOutTime, setDrawerEditOutTime] = useState('');
  const [drawerEditOutSaving, setDrawerEditOutSaving] = useState(false);
  const [dayReview, setDayReview] = useState<{
    dateStr: string;
    items: Array<{ userId: string; employeeName: string; department?: string; shift: ShiftRow }>;
    currentIdx: number;
  } | null>(null);
  const [dayReviewIn, setDayReviewIn] = useState('');
  const [dayReviewOutDate, setDayReviewOutDate] = useState('');
  const [dayReviewOut, setDayReviewOut] = useState('');
  const [dayReviewSaving, setDayReviewSaving] = useState(false);

  const timesheetShiftDetailPanelRef = useRef<HTMLDivElement | null>(null);

  const [manualPunchIn, setManualPunchIn] = useState('');
  const [manualPunchOut, setManualPunchOut] = useState('');
  const [manualPunchOutDate, setManualPunchOutDate] = useState('');
  const [manualPunchSaving, setManualPunchSaving] = useState(false);
  const [drawerShiftEditsExpanded, setDrawerShiftEditsExpanded] = useState(true);

  const closeTimesheetShiftDrawer = useCallback(() => {
    setDrawerData(null);
  }, []);

  const [approvalConfirm, setApprovalConfirm] = useState<{
    shiftId: string;
    employeeName: string;
    dateStr: string;
    plannedStart: string;
    plannedEnd: string;
    plannedMins: number;
    actualStart: string | null;
    actualEnd: string | null;
    actualMins: number;
    deltaMins: number;
    /** true se mancano timbrature complete: in congelamento si usano orari pianificati / uscita prevista. */
    freezeUsesPlannedTimes: boolean;
  } | null>(null);
  const [approvalPin, setApprovalPin] = useState('');
  const [approvalPinError, setApprovalPinError] = useState('');

  const periodStartStr = format(periodStartDate, 'yyyy-MM-dd');
  const periodEndStr = format(periodEndDate, 'yyyy-MM-dd');
  const isDayInConfiguredPeriod = useCallback(
    (d: Date) => {
      const s = format(d, 'yyyy-MM-dd');
      return s >= periodStartStr && s <= periodEndStr;
    },
    [periodStartStr, periodEndStr]
  );

  const weekDays =
    viewMode === 'week'
      ? allPeriodDays.slice(weekIndex * 7, weekIndex * 7 + 7)
      : calendarPaddedDays;
  const weekStart = weekDays[0] ?? periodStartDate;
  const lastDay = weekDays[weekDays.length - 1] ?? periodEndDate;
  const weekStr = format(weekStart, 'yyyy-MM-dd');
  const weekEnd = format(addDays(lastDay, 1), 'yyyy-MM-dd');
  const todayStr = format(now, 'yyyy-MM-dd');

  const todayWeekIndexInPeriod = useMemo(() => {
    const idx = allPeriodDays.findIndex((d) => format(d, 'yyyy-MM-dd') === todayStr);
    if (idx < 0) return null;
    return Math.floor(idx / 7);
  }, [allPeriodDays, todayStr]);

  const goToToday = useCallback(() => {
    if (todayWeekIndexInPeriod == null) return;
    setViewMode('week');
    setWeekIndex(todayWeekIndexInPeriod);
  }, [todayWeekIndexInPeriod]);

  const isShowingTodayWeek =
    viewMode === 'week' &&
    todayWeekIndexInPeriod !== null &&
    weekIndex === todayWeekIndexInPeriod;

  const goPrevWeek = () => setWeekIndex((i) => Math.max(0, i - 1));
  const goNextWeek = () => setWeekIndex((i) => Math.min(maxWeekIndex, i + 1));

  useEffect(() => {
    setWeekIndex((i) => Math.min(i, maxWeekIndex));
  }, [maxWeekIndex]);

  useEffect(() => {
    if (approvalConfirm) {
      setApprovalPin('');
      setApprovalPinError('');
    }
  }, [approvalConfirm]);

  // Carica audit log per la settimana
  useEffect(() => {
    const weekPunchIds = punchRecords
      .filter((p) => {
        const d = p.timestamp ? new Date(p.timestamp) : null;
        if (!d) return false;
        const dateStr = format(d, 'yyyy-MM-dd');
        return dateStr >= weekStr && dateStr < weekEnd;
      })
      .map((p) => p.id);

    if (weekPunchIds.length === 0) { setPunchAudits({}); return; }

    database.punchAuditLog.getByPunchIds(weekPunchIds).then((entries) => {
      const grouped: Record<string, PunchAuditEntry[]> = {};
      for (const entry of entries) {
        if (!grouped[entry.punch_record_id]) grouped[entry.punch_record_id] = [];
        grouped[entry.punch_record_id].push(entry);
      }
      setPunchAudits(grouped);
    }).catch(() => { /* tabella non ancora creata */ });
  }, [punchRecords, weekStr, weekEnd]);

  const visibleUsers = useMemo(() => {
    const onSchedule = users.filter(isUserVisibleOnTeamSchedule);
    if (!canTeamTimesheetOps && currentUser) {
      const self = users.find((u) => u.id === currentUser.id);
      if (!self || self.status !== 'active' || isPurelyManagementRole(self.role)) return [];
      return [self].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    const self = currentUser
      ? users.find((u) => u.id === currentUser.id)
      : undefined;
    const needsSelf =
      self &&
      self.status === 'active' &&
      !isPurelyManagementRole(self.role) &&
      !onSchedule.some((u) => u.id === self.id);
    const merged = needsSelf ? [...onSchedule, self] : [...onSchedule];
    return merged.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [users, canTeamTimesheetOps, currentUser]);

  const weekShifts = useMemo(() =>
    shifts.filter((s) => s.date >= weekStr && s.date < weekEnd && !s.notes?.startsWith('__OPEN__')),
    [shifts, weekStr, weekEnd]
  );

  /** Allineato al Master Control `auto_breaks`; le regole pausa attive restano sempre prioritarie in getBreakMinutesForShift. */
  const breakComputeOpts = useMemo(
    () => ({ autoBreaksFeatureEnabled: featureFlags['auto_breaks'] !== false }),
    [featureFlags]
  );

  const timesheetData = useMemo(() => {
    const data: Record<string, Record<string, DayData>> = {};

    for (const user of visibleUsers) {
      data[user.id] = {};
      for (const day of weekDays) {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayShifts = weekShifts
          .filter((s) => s.user_id === user.id && s.date === dateStr)
          .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

        const shiftRows: ShiftRow[] = dayShifts.map((s) => {
          if (s.approval_status === 'absent') {
            const plannedStart = (s.start_time || '').slice(0, 5);
            const plannedEnd = (s.end_time || '').slice(0, 5);
            const grossPlanned = calculateShiftMinutesGross(plannedStart, plannedEnd);
            const breakMinutes = getBreakMinutesForShift(s, grossPlanned, user, breakRules, breakComputeOpts);
            const plannedMins = Math.max(0, grossPlanned - breakMinutes);
            return {
              id: s.id,
              plannedStart,
              plannedEnd,
              plannedMins,
              breakMinutes,
              actualStart: null,
              actualEnd: null,
              actualEndFull: undefined,
              actualMins: 0,
              deltaMins: -plannedMins,
              status: 'absent' as const,
              punched: false,
              isLate: false,
              hasMissingOut: false,
              isCrossDay: false,
              approved_by: s.approved_by ?? undefined,
              approved_at: s.approved_at ?? undefined,
            };
          }
          const plannedStart = (s.start_time || '').slice(0, 5);
          const plannedEnd = (s.end_time || '').slice(0, 5);
          const grossPlanned = calculateShiftMinutesGross(plannedStart, plannedEnd);
          const breakMinutes = getBreakMinutesForShift(s, grossPlanned, user, breakRules, breakComputeOpts);
          const plannedMins = Math.max(0, grossPlanned - breakMinutes);

          const shiftHour = parseInt(plannedStart.split(':')[0], 10);
          const isLunch = shiftHour < 16;

          const punchIn = punchRecords.find((p) => {
            if (p.type !== 'in') return false;
            if (s.id && p.shift_id) return p.shift_id === s.id;
            if (p.user_id !== user.id) return false;
            const pDate = new Date(p.timestamp);
            if (!isValid(pDate)) return false;
            if (format(pDate, 'yyyy-MM-dd') !== dateStr) return false;
            return isLunch ? pDate.getHours() < 16 : pDate.getHours() >= 16;
          });

          const punchOut = punchRecords.find((p) => {
            if (p.type !== 'out') return false;
            if (s.id && p.shift_id) return p.shift_id === s.id;
            if (p.user_id !== user.id) return false;
            const pDate = new Date(p.timestamp);
            if (!isValid(pDate)) return false;
            if (format(pDate, 'yyyy-MM-dd') !== dateStr) return false;
            return isLunch ? pDate.getHours() < 16 : pDate.getHours() >= 16;
          });

          const clockOutRaw = (punchIn as { clock_out_time?: string | null })?.clock_out_time ?? null;
          const punchActualStart = punchIn ? punchTimeHHMM(punchIn.calculated_time || punchIn.timestamp) : null;
          const actualEndFull = clockOutRaw ?? punchOut?.timestamp ?? undefined;
          const punchActualEnd = actualEndFull ? punchTimeHHMM(actualEndFull) : null;

          const frozen = !!(s.approved_at && s.approved_start_time && s.approved_end_time);
          let displayActualStart = punchActualStart;
          let displayActualEnd = punchActualEnd;
          let grossActualMins = 0;
          let actualEndFullForRow: string | undefined = actualEndFull;

          if (frozen) {
            const r = getResolvedStartEndForHours(s as Shift, punchRecords);
            displayActualStart = r.start;
            displayActualEnd = r.end;
            grossActualMins = calculateShiftMinutesGross(r.start, r.end);
            actualEndFullForRow = undefined;
          } else if (punchActualStart && punchActualEnd) {
            const startM = toMinutesFromMidnight(punchActualStart);
            const endM = toMinutesFromMidnight(punchActualEnd);
            const elapsedMs = actualEndFull && punchIn
              ? new Date(actualEndFull).getTime() - new Date(punchIn.calculated_time || punchIn.timestamp).getTime()
              : (endM >= startM ? endM - startM : endM + 1440 - startM) * 60_000;
            grossActualMins = Math.max(0, Math.round(elapsedMs / 60_000));
          }

          const actualEndDateRaw = actualEndFull ? new Date(actualEndFull) : null;
          const actualEndDate =
            actualEndDateRaw && isValid(actualEndDateRaw)
              ? format(actualEndDateRaw, 'yyyy-MM-dd')
              : dateStr;
          const isCrossDay = !frozen && !!actualEndFull && actualEndDate !== dateStr;
          const actualMins = Math.max(0, grossActualMins - breakMinutes);
          const deltaMins = actualMins - plannedMins;

          const isLate = !!(
            displayActualStart &&
            toMinutesFromMidnight(displayActualStart) > toMinutesFromMidnight(plannedStart) + 5
          );
          const hasMissingOut = frozen ? false : !!(punchIn && !punchActualEnd);

          return {
            id: s.id,
            plannedStart,
            plannedEnd,
            plannedMins,
            breakMinutes,
            actualStart: displayActualStart,
            actualEnd: displayActualEnd,
            actualEndFull: actualEndFullForRow,
            actualMins,
            deltaMins,
            status: s.approval_status,
            punched: !!punchIn,
            punchInId: punchIn?.id,
            punchOutId: punchOut?.id,
            punchInSource: punchIn?.source ?? null,
            punchOutSource: punchOut?.source ?? null,
            isLate,
            hasMissingOut,
            isCrossDay,
            approved_by: s.approved_by ?? undefined,
            approved_at: s.approved_at ?? undefined,
          };
        });

        const totalPlannedMins = shiftRows.reduce((a, r) => a + r.plannedMins, 0);
        const totalActualMins = shiftRows.reduce((a, r) => a + r.actualMins, 0);
        const totalDeltaMins = totalActualMins - totalPlannedMins;

        data[user.id][dateStr] = { dateStr, shifts: shiftRows, totalPlannedMins, totalActualMins, totalDeltaMins };
      }
    }
    return data;
  }, [visibleUsers, weekDays, weekShifts, punchRecords, breakRules, breakComputeOpts]);

  const userTotals = useMemo(() => {
    const totals: Record<string, { plannedMins: number; actualMins: number; deltaMins: number }> = {};
    for (const user of visibleUsers) {
      let planned = 0, actual = 0;
      for (const day of weekDays) {
        const dayData = timesheetData[user.id]?.[format(day, 'yyyy-MM-dd')];
        if (dayData) { planned += dayData.totalPlannedMins; actual += dayData.totalActualMins; }
      }
      totals[user.id] = { plannedMins: planned, actualMins: actual, deltaMins: actual - planned };
    }
    return totals;
  }, [visibleUsers, weekDays, timesheetData]);

  /** Allinea il drawer al dato griglia dopo nuove timbrature (stesso turno aperto). */
  useEffect(() => {
    if (!drawerData) return;
    const u = visibleUsers.find((x) => x.id === drawerData.userId);
    if (!u) return;
    const freshRows = timesheetData[u.id]?.[drawerData.dateStr]?.shifts;
    const fresh = freshRows?.find((r) => r.id === drawerData.shift.id);
    if (!fresh) return;
    setDrawerData((d) => {
      if (!d || d.shift.id !== fresh.id) return d;
      const p = d.shift;
      if (
        fresh.punched === p.punched &&
        fresh.actualStart === p.actualStart &&
        fresh.actualEnd === p.actualEnd &&
        fresh.punchInId === p.punchInId &&
        fresh.punchInSource === p.punchInSource &&
        fresh.punchOutSource === p.punchOutSource &&
        fresh.actualMins === p.actualMins &&
        fresh.hasMissingOut === p.hasMissingOut
      ) {
        return d;
      }
      return {
        ...d,
        shift: fresh,
        punchAuditEntries: fresh.punchInId ? punchAudits[fresh.punchInId] ?? [] : [],
      };
    });
  }, [timesheetData, punchAudits, drawerData?.shift.id, drawerData?.userId, drawerData?.dateStr, visibleUsers]);

  useEffect(() => {
    if (drawerData?.shift?.id) setDrawerShiftEditsExpanded(true);
  }, [drawerData?.shift?.id]);

  const handleExportTimesheetPdf = useCallback(() => {
    if (!currentUser || !isFeatureEnabled(currentUser, 'export_pdf')) return;
    try {
      const result = exportAttendancePdfFromGrid({
        weekDays,
        visibleUsers,
        shifts,
        punchRecords,
        breakRules,
        breakComputeOpts,
        locale,
        t: t as Record<string, string>,
        formatTrans,
        fmtHM,
      });
      if (result === 'no_days' || result === 'no_users') {
        showError?.(t.ts_pdf_no_data);
        return;
      }
      showSuccess?.((t as { mod_pdf_export?: string }).mod_pdf_export ?? 'PDF presenze esportato');
    } catch (e) {
      showError?.(e instanceof Error ? e.message : 'Export PDF non riuscito');
    }
  }, [
    currentUser,
    visibleUsers,
    weekDays,
    shifts,
    punchRecords,
    breakRules,
    breakComputeOpts,
    locale,
    t,
    fmtHM,
    showSuccess,
    showError,
  ]);

  // ── Indicatori rapidi di OGGI (Presenze) ───────────────────────────────────
  const todayStats = useMemo(() => {
    const visibleUserIds = new Set(visibleUsers.map((u) => u.id));
    const todayShifts = weekShifts.filter(
      (s) => s.date === todayStr && visibleUserIds.has(s.user_id)
    );
    let inTurno = 0, ritardi = 0, senzaTimbratura = 0, approvati = 0;
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

    for (const s of todayShifts) {
      if (s.approval_status === 'absent') continue;
      const startMins = toMinutesFromMidnight((s.start_time || '').slice(0, 5));
      const endMins = toMinutesFromMidnight((s.end_time || '00:00').slice(0, 5));
      if (nowMins >= startMins - 30 && nowMins <= endMins) inTurno++;
      if (s.approval_status === 'approved') approvati++;

      const punchIn = findPunchInForShiftOnDate(s, s.user_id, todayStr, punchRecords);
      if (!punchIn) senzaTimbratura++;
      else {
        const actualStartHHMM = punchTimeHHMM(punchIn.calculated_time || punchIn.timestamp);
        if (actualStartHHMM && toMinutesFromMidnight(actualStartHHMM) > startMins + 5) ritardi++;
      }
    }
    return { inTurno, ritardi, senzaTimbratura, approvati };
  }, [weekShifts, todayStr, punchRecords, visibleUsers]);

  // ── Turni dinner senza OUT (solo oggi, solo se oggi è nel periodo) ─────────────────
  const dinnerShiftsNeedingClose = useMemo(() => {
    const todayInRange = todayStr >= weekStr && todayStr < weekEnd;
    if (!todayInRange) return [];
    const todayShifts = weekShifts.filter((s) => s.date === todayStr);
    const result: Array<{
      shift: typeof todayShifts[0];
      user: (typeof visibleUsers)[0] | undefined;
      punchInId: string;
      actualStart: string;
      scheduledStart: string;
      scheduledEnd: string;
      plannedMins: number;
    }> = [];

    for (const s of todayShifts) {
      if (s.approval_status === 'approved') continue;
      const startHour = parseInt((s.start_time || '00:00').slice(0, 2), 10);
      if (startHour < 16) continue;

      const user = visibleUsers.find((u) => u.id === s.user_id);
      const punchIn = punchRecords.find(
        (p) =>
          p.type === 'in' &&
          (p.shift_id === s.id || (p.user_id === s.user_id && new Date(p.timestamp).getHours() >= 16))
      );
      if (!punchIn) continue;

      const hasOut = punchRecords.some(
        (p) =>
          p.type === 'out' &&
          (p.shift_id === s.id || (p.user_id === s.user_id && new Date(p.timestamp).getHours() >= 16))
      );
      const hasClockOut = !!(punchIn as { clock_out_time?: string | null }).clock_out_time;
      if (hasOut || hasClockOut) continue;

      const actualStart =
        punchTimeHHMM(
          (punchIn as { calculated_time?: string | null }).calculated_time || punchIn.timestamp
        ) ?? (s.start_time || '').slice(0, 5);
      const plannedStart = (s.start_time || '').slice(0, 5);
      const plannedEnd = (s.end_time || '').slice(0, 5);
      const grossPlanned = calculateShiftMinutesGross(plannedStart, plannedEnd);
      const breakMins = getBreakMinutesForShift(s, grossPlanned, user ?? undefined, breakRules, breakComputeOpts);
      const plannedMins = Math.max(0, grossPlanned - breakMins);

      result.push({
        shift: s,
        user,
        punchInId: punchIn.id,
        actualStart,
        scheduledStart: (s.start_time || '').slice(0, 5),
        scheduledEnd: (s.end_time || '').slice(0, 5),
        plannedMins,
      });
    }
    return result;
  }, [weekShifts, todayStr, visibleUsers, punchRecords, breakRules, breakComputeOpts, weekStr, weekEnd]);

  // ── Turni che soddisfano i criteri di congelamento (assenza, oppure IN+OUT complete; non futuri, non già sigillati) ──
  const readyForApproval = useMemo(() => {
    const result: Array<{
      shift: (typeof weekShifts)[0];
      user: (typeof visibleUsers)[0] | undefined;
      plannedStart: string;
      plannedEnd: string;
      plannedMins: number;
      actualStart: string;
      actualEnd: string;
      actualMins: number;
      grossActualMins: number;
      breakDeductionMins: number;
      deltaMins: number;
      punchInId: string;
      auditCount: number;
      auditEntries: PunchAuditEntry[];
      dateStr: string;
      freezeUsesPlannedTimes: boolean;
    }> = [];

    for (const s of weekShifts) {
      if (!shiftCanBeFrozenFromTimesheet(s, punchRecords, todayStr)) continue;

      const user = visibleUsers.find((u) => u.id === s.user_id);
      const plannedStart = (s.start_time || '').slice(0, 5);
      const plannedEnd = (s.end_time || '').slice(0, 5);
      const grossPlanned = calculateShiftMinutesGross(plannedStart, plannedEnd);
      const breakMins = getBreakMinutesForShift(s, grossPlanned, user ?? undefined, breakRules, breakComputeOpts);
      const plannedMins = Math.max(0, grossPlanned - breakMins);

      const punchIn = punchRecords.find(
        (p) => p.type === 'in' && (p.shift_id === s.id || p.user_id === s.user_id)
      );

      let actualStart = plannedStart;
      let actualEnd = plannedEnd;
      let grossActualMins = grossPlanned;
      let freezeUsesPlannedTimes = !punchIn;

      if (punchIn) {
        const clockOutRaw = (punchIn as { clock_out_time?: string | null }).clock_out_time ?? null;
        const punchOut = punchRecords.find(
          (p) => p.type === 'out' && (p.shift_id === s.id || p.user_id === s.user_id)
        );
        const actualEndRaw = clockOutRaw ?? punchOut?.timestamp ?? null;
        freezeUsesPlannedTimes = !actualEndRaw;
        actualStart =
          punchTimeHHMM(
            (punchIn as { calculated_time?: string | null }).calculated_time || punchIn.timestamp
          ) ?? plannedStart;
        actualEnd = actualEndRaw ? (punchTimeHHMM(actualEndRaw) ?? plannedEnd) : plannedEnd;
        grossActualMins = calculateShiftMinutesGross(actualStart, actualEnd);
      }

      const actualMins = Math.max(0, grossActualMins - breakMins);
      const breakDeductionMins = breakMins;
      const deltaMins = actualMins - plannedMins;
      const punchInId = punchIn?.id ?? '';
      const auditEntries = punchInId ? (punchAudits[punchInId] ?? []) : [];
      const auditCount = auditEntries.length;

      result.push({
        shift: s,
        user,
        plannedStart,
        plannedEnd,
        plannedMins,
        actualStart,
        actualEnd,
        actualMins,
        grossActualMins,
        breakDeductionMins,
        deltaMins,
        punchInId,
        auditCount,
        auditEntries,
        dateStr: s.date,
        freezeUsesPlannedTimes,
      });
    }
    // Sort: oldest first (data crescente)
    return result.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [weekShifts, visibleUsers, punchRecords, punchAudits, breakRules, breakComputeOpts, todayStr]);

  const scrollToTimesheetAnchor = useCallback((elementId: string) => {
    requestAnimationFrame(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  /** Card riepilogo oggi: tutte portano alla griglia presenze principale. */
  const handleStatCardClick = useCallback(() => {
    if (!currentUser) return;
    scrollToTimesheetAnchor('timesheet-section-main-grid');
  }, [currentUser, scrollToTimesheetAnchor]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleApproveShift = async (shiftId: string, actorOverride?: import('../types').User) => {
    setApprovingShiftId(shiftId);
    try {
      const raw = shifts.find((s) => s.id === shiftId);
      await approveShift(shiftId, {
        actorOverride,
        promoteFromDraft: raw?.approval_status === 'draft',
      });
      showSuccess?.(t.ts_toast_shift_approved);
      setDrawerData(null);
    } catch {
      showError?.(t.ts_toast_approve_freeze_error);
    } finally {
      setApprovingShiftId(null);
    }
  };

  const handleUnlockShift = async (pin: string) => {
    if (!unlockModalShiftId || !currentUser) return;
    if (pin !== currentUser.pin) {
      setUnlockError(t.ts_toast_wrong_pin);
      setUnlockPin('');
      return;
    }
    setUnlocking(true);
    try {
      const actorName = `${currentUser.first_name} ${currentUser.last_name ?? ''}`.trim();
      const full = shifts.find((sh) => sh.id === unlockModalShiftId);
      const restoreAbsent = full?.approval_status === 'absent' && !!full?.approved_at;
      const nextStatus = restoreAbsent ? 'absent' : 'confirmed';
      await updateShift(unlockModalShiftId, {
        approval_status: nextStatus,
        approved_at: null as unknown as string,
        approved_by: null as unknown as string,
        approved_start_time: null as unknown as string,
        approved_end_time: null as unknown as string,
      });
      const punchIn = punchRecords.find(
        (p) => p.type === 'in' && p.shift_id === unlockModalShiftId
      );
      if (punchIn) {
        try {
          await database.punchAuditLog.insert({
            punch_record_id: punchIn.id,
            actor_id: currentUser.id,
            actor_name: actorName,
            field: 'sblocco_turno',
            old_value: 'approved',
            new_value: nextStatus,
          });
        } catch { /* audit log non bloccante */ }
      }
      setUnlockModalShiftId(null);
      setUnlockPin('');
      setUnlockError('');
      // Aggiorna lo snapshot nel drawer in tempo reale
      setDrawerData((prev) =>
        prev
          ? {
              ...prev,
              shift: {
                ...prev.shift,
                status: nextStatus as ShiftRow['status'],
                approved_at: undefined,
                approved_by: undefined,
              },
            }
          : null
      );
      showSuccess?.(t.ts_toast_shift_unlocked);
    } catch {
      showError?.(t.ts_toast_unlock_error);
    } finally {
      setUnlocking(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!closingShift || !clockOutTime || !closingShift.punchInId) return;
    setClosingLoading(true);
    try {
      const [h, m] = clockOutTime.split(':').map(Number);
      const base = parseISO(closingShift.dateStr);
      const clockOutDate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h ?? 0, m ?? 0, 0, 0);
      try {
        await updatePunchRecord(closingShift.punchInId, { clock_out_time: clockOutDate.toISOString() });
      } catch {
        // Fallback: colonna clock_out_time non ancora migrata — usa calculated_time come campo di uscita
        await updatePunchRecord(closingShift.punchInId, { calculated_time: clockOutDate.toISOString() });
      }
      showSuccess?.(t.ts_toast_exit_saved);
      setClosingShift(null);
      setClockOutTime('');
      setDrawerData(null);
    } catch {
      showError?.(t.ts_toast_exit_error);
    } finally {
      setClosingLoading(false);
    }
  };

  const openDrawer = (shift: ShiftRow, user: { id: string; first_name: string; department?: string }, dateStr: string) => {
    const punchAuditEntries = shift.punchInId ? (punchAudits[shift.punchInId] || []) : [];
    const shiftEdits = getShiftHistory(shift.id);
    setDrawerData({ shift, userId: user.id, employeeName: user.first_name, department: user.department, dateStr, punchAuditEntries, shiftEdits });
    setManualPunchIn(shift.plannedStart);
    setManualPunchOut(shift.plannedEnd);
    setManualPunchOutDate(dateStr);
    setManualPunchSaving(false);
    setDrawerEditStart(shift.plannedStart);
    setDrawerEditEnd(shift.plannedEnd);
    setDrawerEditSaving(false);
    // Inizializza editor orario uscita
    if (shift.actualEndFull) {
      const d = new Date(shift.actualEndFull);
      setDrawerEditOutDate(format(d, 'yyyy-MM-dd'));
      setDrawerEditOutTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else {
      setDrawerEditOutDate(dateStr);
      setDrawerEditOutTime(shift.plannedEnd);
    }
    setDrawerEditOutSaving(false);
  };

  const handleDrawerInsertManualPunches = async () => {
    if (!drawerData) return;
    const shiftRow = drawerData.shift;
    if (shiftRow.status === 'absent') return;
    const inHm = (manualPunchIn || '').trim().slice(0, 5);
    const outHm = (manualPunchOut || '').trim().slice(0, 5);
    if (!/^\d{1,2}:\d{2}$/.test(inHm) || !/^\d{1,2}:\d{2}$/.test(outHm)) {
      showError?.(t.enter_valid_time_example);
      return;
    }
    const [yIn, moIn, dIn] = drawerData.dateStr.split('-').map((n) => parseInt(n, 10));
    const [hIn, mIn] = inHm.split(':').map((n) => parseInt(n, 10));
    const inLocal = new Date(yIn, moIn - 1, dIn, hIn, mIn, 0, 0);
    const outDateStr = (manualPunchOutDate || drawerData.dateStr).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(outDateStr)) {
      showError?.(t.save_error);
      return;
    }
    const [yOut, moOut, dOut] = outDateStr.split('-').map((n) => parseInt(n, 10));
    const [hOut, mOut] = outHm.split(':').map((n) => parseInt(n, 10));
    const outLocal = new Date(yOut, moOut - 1, dOut, hOut, mOut, 0, 0);
    if (outLocal.getTime() <= inLocal.getTime()) {
      showError?.(t.ts_manual_punches_out_after_in_error);
      return;
    }
    setManualPunchSaving(true);
    try {
      const rIn = await addPunchRecord(drawerData.userId, 'in', {
        shift_id: shiftRow.id,
        timestamp: inLocal.toISOString(),
        source: 'manual',
      });
      if (rIn && typeof rIn === 'object' && 'error' in rIn && rIn.error) {
        showError?.(rIn.error);
        return;
      }
      const rOut = await addPunchRecord(drawerData.userId, 'out', {
        shift_id: shiftRow.id,
        timestamp: outLocal.toISOString(),
        source: 'manual',
      });
      if (rOut && typeof rOut === 'object' && 'error' in rOut && rOut.error) {
        try {
          await deletePunchRecordsForShift(shiftRow.id);
        } catch {
          /* best effort */
        }
        showError?.(rOut.error);
        return;
      }
      showSuccess?.(t.ts_toast_manual_punches_saved);
    } catch {
      showError?.(t.save_error);
    } finally {
      setManualPunchSaving(false);
    }
  };

  const handleDrawerSaveShift = async (shiftId: string, start: string, end: string) => {
    setDrawerEditSaving(true);
    try {
      await updateShift(shiftId, { start_time: start, end_time: end });
      const rawShift = shifts.find((s) => s.id === shiftId);
      const user = rawShift ? visibleUsers.find((u) => u.id === rawShift.user_id) : undefined;
      const gross = calculateShiftMinutesGross(start, end);
      const breakMins = rawShift
        ? getBreakMinutesForShift({ ...rawShift, start_time: start, end_time: end }, gross, user ?? undefined, breakRules, breakComputeOpts)
        : 0;
      const newPlannedMins = Math.max(0, gross - breakMins);
      setDrawerData((prev) => {
        if (!prev) return null;
        const newDeltaMins = prev.shift.actualMins - newPlannedMins;
        return {
          ...prev,
          shift: {
            ...prev.shift,
            plannedStart: start,
            plannedEnd: end,
            plannedMins: newPlannedMins,
            deltaMins: newDeltaMins,
          },
        };
      });
      showSuccess?.(t.ts_toast_shift_time_updated);
    } catch {
      showError?.(t.save_error);
    } finally {
      setDrawerEditSaving(false);
    }
  };

  const handleDrawerSaveOut = async (punchOutId: string, date: string, time: string) => {
    if (!currentUser) return;
    setDrawerEditOutSaving(true);
    try {
      const [h, m] = time.split(':').map(Number);
      const d = parseISO(date);
      const newTs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h ?? 0, m ?? 0, 0, 0);
      const actorName = `${currentUser.first_name} ${currentUser.last_name ?? ''}`.trim();
      const oldVal = drawerData?.shift.actualEndFull ?? '—';
      await updatePunchRecord(punchOutId, { timestamp: newTs.toISOString() });
      // Audit log non bloccante
      try {
        await database.punchAuditLog.insert({
          punch_record_id: punchOutId,
          actor_id: currentUser.id,
          actor_name: actorName,
          field: 'timestamp_out',
          old_value: oldVal,
          new_value: newTs.toISOString(),
        });
      } catch { /* non bloccante */ }
      // Aggiorna snapshot drawer
      setDrawerData((prev) => {
        if (!prev) return null;
        const newEnd = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const rawElapsed = prev.shift.actualStart
          ? (() => {
              const punchInTs = punchRecords.find((p) => p.id === prev.shift.punchInId);
              if (punchInTs) {
                const elapsedMs = newTs.getTime() - new Date(punchInTs.calculated_time || punchInTs.timestamp).getTime();
                return Math.max(0, Math.round(elapsedMs / 60_000));
              }
              return calculateShiftMinutesGross(prev.shift.actualStart, newEnd);
            })()
          : 0;
        const newActualMins = Math.max(0, rawElapsed - prev.shift.breakMinutes);
        return {
          ...prev,
          shift: {
            ...prev.shift,
            actualEnd: newEnd,
            actualEndFull: newTs.toISOString(),
            actualMins: newActualMins,
            deltaMins: newActualMins - prev.shift.plannedMins,
            hasMissingOut: false,
            isCrossDay: false,
          },
        };
      });
      showSuccess?.(t.ts_toast_exit_corrected);
    } catch {
      showError?.(t.save_error);
    } finally {
      setDrawerEditOutSaving(false);
    }
  };

  // ── Day Review ───────────────────────────────────────────────────────────

  const toISOFromDateHHMM = (dateStr: string, hhmm: string): string => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = parseISO(dateStr);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h ?? 0, m ?? 0, 0, 0).toISOString();
  };

  const initDayReviewFields = (item: { shift: ShiftRow }, reviewDateStr: string) => {
    setDayReviewIn(item.shift.actualStart ?? item.shift.plannedStart);
    if (item.shift.actualEndFull) {
      const d = new Date(item.shift.actualEndFull);
      setDayReviewOutDate(format(d, 'yyyy-MM-dd'));
      setDayReviewOut(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    } else {
      setDayReviewOutDate(reviewDateStr);
      setDayReviewOut(item.shift.actualEnd ?? '');
    }
  };

  const handleOpenDayReview = (dateStr: string) => {
    const items: Array<{ userId: string; employeeName: string; department?: string; shift: ShiftRow }> = [];
    for (const user of visibleUsers) {
      const dayData = timesheetData[user.id]?.[dateStr];
      if (!dayData) continue;
      for (const shift of dayData.shifts) {
        if (shift.status === 'approved' || shiftRowPayrollFrozen(shift)) continue;
        items.push({ userId: user.id, employeeName: user.first_name, department: (user as { department?: string }).department, shift });
      }
    }
    if (items.length === 0) return;
    setDayReview({ dateStr, items, currentIdx: 0 });
    initDayReviewFields(items[0], dateStr);
  };

  const handleDayReviewNavigate = (dir: 1 | -1) => {
    if (!dayReview) return;
    const next = dayReview.currentIdx + dir;
    if (next < 0 || next >= dayReview.items.length) return;
    setDayReview((prev) => prev ? { ...prev, currentIdx: next } : null);
    initDayReviewFields(dayReview.items[next], dayReview.dateStr);
  };

  const handleDayReviewSave = async () => {
    if (!dayReview) return;
    const item = dayReview.items[dayReview.currentIdx];
    const s = item.shift;
    setDayReviewSaving(true);
    try {
      // Salva IN se cambiato
      if (s.punchInId && dayReviewIn) {
        const newInISO = toISOFromDateHHMM(dayReview.dateStr, dayReviewIn);
        await updatePunchRecord(s.punchInId, { calculated_time: newInISO });
      }
      // Salva OUT
      if (dayReviewOut && dayReviewOutDate) {
        const newOutISO = toISOFromDateHHMM(dayReviewOutDate, dayReviewOut);
        if (s.punchOutId) {
          await updatePunchRecord(s.punchOutId, { timestamp: newOutISO });
        } else if (s.punchInId) {
          await updatePunchRecord(s.punchInId, { clock_out_time: newOutISO });
        }
      }
      showSuccess?.(t.ts_toast_shift_updated);
      // Avanza automaticamente al prossimo
      const next = dayReview.currentIdx + 1;
      if (next < dayReview.items.length) {
        setDayReview((prev) => prev ? { ...prev, currentIdx: next } : null);
        initDayReviewFields(dayReview.items[next], dayReview.dateStr);
      } else {
        setDayReview(null);
        showSuccess?.(t.ts_toast_day_review_complete);
      }
    } catch {
      showError?.(t.save_error);
    } finally {
      setDayReviewSaving(false);
    }
  };

  // ── Helpers rendering ────────────────────────────────────────────────────

  const getShiftCardStyle = (s: ShiftRow, punchAuditCount: number, cellDateStr?: string, boardShift?: Shift | null) => {
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    const startMins = toMinutesFromMidnight(s.plannedStart);
    const endMins = toMinutesFromMidnight((s.plannedEnd || '00:00').slice(0, 5));
    const inTodayKpiWindow =
      cellDateStr === todayStr &&
      nowMins >= startMins - 30 &&
      nowMins <= endMins;

    const punchMissingOnBoard =
      !!boardShift && shiftPastPlannedEndWithoutClockIn(boardShift, punchRecords);
    const publishedOnBoard = s.status === 'confirmed' || s.status === 'approved';

    // Assenza (non lavorato) — VARIANT absent tabellone
    if (s.status === 'absent') {
      const frozen = !!s.approved_at;
      return {
        border: 'border-l-rose-400 dark:border-l-rose-500',
        bg: 'bg-rose-50 dark:bg-rose-950/35',
        ring: 'ring-1 ring-rose-400/50 dark:ring-rose-900/40',
        dot: 'bg-rose-500',
        label: frozen ? t.wst_grid_shift_frozen_short : t.status_absent,
        labelCls: 'text-rose-900 bg-rose-100 dark:text-rose-100 dark:bg-rose-950/50',
      };
    }
    // Approvato / congelato contabilità — VARIANT approved
    if (s.status === 'approved' && shiftRowPayrollFrozen(s)) {
      return {
        border: 'border-l-accent',
        bg: 'bg-accent/5 dark:bg-accent/15',
        ring: 'ring-1 ring-accent/20 dark:ring-accent/35',
        dot: 'bg-accent',
        label: t.wst_grid_shift_frozen_short,
        labelCls: 'text-accent-dark bg-accent/10 dark:text-accent-light dark:bg-accent/20',
      };
    }
    // Bozza — VARIANT planned (priorità come tabellone: prima di ritardo / non timbrato)
    if (s.status === 'draft') {
      return {
        border: 'border-l-slate-400 dark:border-l-white/75',
        bg: 'bg-slate-50 dark:bg-neutral-950/85',
        ring: 'ring-1 ring-slate-300/50 dark:ring-neutral-600/50',
        dot: 'bg-slate-400 dark:bg-neutral-500',
        label: t.ts_status_draft,
        labelCls: 'text-slate-800 bg-slate-100 dark:text-neutral-100 dark:bg-neutral-800/70',
      };
    }
    // Ritardo / OUT mancante — pill tabellone bg-red-500 dark:bg-red-400
    if (s.hasMissingOut || s.isLate) {
      return {
        border: 'border-l-red-500 dark:border-l-red-400',
        bg: 'bg-red-50 dark:bg-red-950/35',
        ring: 'ring-1 ring-red-400/45 dark:ring-red-900/40',
        dot: 'bg-red-500 dark:bg-red-400',
        label: s.hasMissingOut ? t.ts_status_missing_out : t.ts_status_late,
        labelCls: 'text-red-800 bg-red-100 dark:text-red-100 dark:bg-red-950/50',
      };
    }
    // Arancione — modifiche manuali (distinto dal non timbrato solo per chi ha già timbrato)
    if (punchAuditCount > 0) {
      return {
        border: 'border-l-orange-500',
        bg: 'bg-orange-50 dark:bg-orange-950/40',
        ring: 'ring-1 ring-orange-200 dark:ring-orange-900/45',
        dot: 'bg-orange-500',
        label: t.ts_status_modified,
        labelCls: 'text-orange-700 bg-orange-100 dark:text-orange-200 dark:bg-orange-950/50',
      };
    }
    // Non timbrato dopo fine turno — VARIANT punchMissing
    if (!s.punched && punchMissingOnBoard) {
      return {
        border: 'border-l-amber-400 dark:border-l-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-950/45',
        ring: 'ring-1 ring-amber-400/55 dark:ring-amber-500/40',
        dot: 'bg-amber-400 dark:bg-amber-500',
        label: t.ts_status_unpunched,
        labelCls: 'text-amber-950 bg-amber-100 dark:text-amber-100 dark:bg-amber-950/55',
      };
    }
    // Pubblicato senza timbratura — VARIANT inprogress (smeraldo)
    if (!s.punched && publishedOnBoard) {
      return {
        border: 'border-l-emerald-500 dark:border-l-emerald-500/80',
        bg: 'bg-emerald-50/95 dark:bg-emerald-950/40',
        ring: 'ring-1 ring-emerald-400/55 dark:ring-emerald-900/40',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        label: t.ts_status_unpunched,
        labelCls: 'text-emerald-900 bg-emerald-100 dark:text-emerald-50 dark:bg-emerald-950/50',
      };
    }
    if (!s.punched) {
      return {
        border: 'border-l-amber-400 dark:border-l-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-950/45',
        ring: 'ring-1 ring-amber-400/55 dark:ring-amber-500/40',
        dot: 'bg-amber-400 dark:bg-amber-500',
        label: t.ts_status_unpunched,
        labelCls: 'text-amber-950 bg-amber-100 dark:text-amber-100 dark:bg-amber-950/55',
      };
    }
    // In turno (oggi) / completato — VARIANT inprogress
    if (inTodayKpiWindow) {
      return {
        border: 'border-l-emerald-500 dark:border-l-emerald-500/80',
        bg: 'bg-emerald-50/95 dark:bg-emerald-950/40',
        ring: 'ring-1 ring-emerald-400/55 dark:ring-emerald-900/40',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        label: t.ts_status_in_shift,
        labelCls: 'text-emerald-900 bg-emerald-100 dark:text-emerald-50 dark:bg-emerald-950/50',
      };
    }
    if (s.punched && !s.actualEnd) {
      return {
        border: 'border-l-emerald-500 dark:border-l-emerald-500/80',
        bg: 'bg-emerald-50/95 dark:bg-emerald-950/40',
        ring: 'ring-1 ring-emerald-400/55 dark:ring-emerald-900/40',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        label: t.ts_status_in_shift,
        labelCls: 'text-emerald-900 bg-emerald-100 dark:text-emerald-50 dark:bg-emerald-950/50',
      };
    }
    if (s.punched && s.actualEnd) {
      return {
        border: 'border-l-emerald-500 dark:border-l-emerald-500/80',
        bg: 'bg-emerald-50/95 dark:bg-emerald-950/40',
        ring: 'ring-1 ring-emerald-400/55 dark:ring-emerald-900/40',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        label: t.ts_status_to_approve,
        labelCls: 'text-emerald-900 bg-emerald-100 dark:text-emerald-50 dark:bg-emerald-950/50',
      };
    }
    return {
      border: 'border-l-amber-400 dark:border-l-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/45',
      ring: 'ring-1 ring-amber-400/40 dark:ring-amber-500/35',
      dot: 'bg-amber-400 dark:bg-amber-500',
      label: t.ts_status_unpunched,
      labelCls: 'text-amber-950 bg-amber-100 dark:text-amber-100 dark:bg-amber-950/55',
    };
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (!currentUser) return null;

  const tv = t as Record<string, string>;
  const monthTabTitle = payrollStripForToolbar
    ? `${tv.ts_timesheet_month_tab_hint ?? ''}\n${formatTrans(tv.ts_timesheet_month_payroll_strip ?? 'Pagamento stipendi previsto: {dates}', { dates: payrollStripForToolbar })}`
    : (tv.ts_timesheet_month_tab_hint ?? '');

  return (
    <>
      <div className="pb-content pt-6 w-full max-w-full font-sans">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

          {/* ── Stats Cards (solo oggi, solo management) ────────────────── */}
          {uiW('timesheet.stats_today') && canTeamTimesheetOps && todayStr >= weekStr && todayStr < weekEnd && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {([
                {
                  label: t.ts_stat_in_shift,
                  value: todayStats.inTurno,
                  Icon: Users,
                  iconColor: 'text-emerald-600 dark:text-emerald-400',
                  bg: 'bg-transparent dark:bg-transparent',
                  border: 'border-emerald-200 dark:border-emerald-800/40',
                  iconWell: 'bg-emerald-100/80 dark:bg-emerald-950/50',
                },
                {
                  label: t.ts_stat_delays,
                  value: todayStats.ritardi,
                  Icon: Clock,
                  iconColor: 'text-red-500 dark:text-red-400',
                  bg: 'bg-transparent dark:bg-transparent',
                  border: 'border-red-200 dark:border-red-900/40',
                  iconWell: 'bg-red-100/80 dark:bg-red-950/40',
                },
                {
                  label: t.ts_stat_no_punch_today,
                  value: todayStats.senzaTimbratura,
                  Icon: AlertCircle,
                  iconColor: 'text-amber-500 dark:text-amber-400',
                  bg: 'bg-transparent dark:bg-transparent',
                  border: 'border-amber-400/45 dark:border-amber-500/35',
                  iconWell: 'bg-amber-400/15 dark:bg-amber-500/20',
                },
                {
                  label: t.ts_stat_approved_today,
                  value: todayStats.approvati,
                  Icon: UserCheck,
                  iconColor: 'text-accent dark:text-accent-light',
                  bg: 'bg-transparent dark:bg-transparent',
                  border: 'border-accent/20 dark:border-accent/35',
                  iconWell: 'bg-accent/15 dark:bg-accent/25',
                },
              ] as const).map(({ label, value, Icon, iconColor, bg, border, iconWell }) => (
                <button
                  key={label}
                  type="button"
                  title={t.ts_stat_card_hint}
                  onClick={handleStatCardClick}
                  className={`group w-full rounded-xl border ${border} ${bg} px-2.5 py-2 shadow-none flex items-center gap-2 text-left transition-colors hover:bg-slate-50/90 dark:hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${border} ${iconWell}`}>
                    <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} strokeWidth={2} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold text-slate-900 dark:text-neutral-100 leading-none tabular-nums">{value}</p>
                    <p className="text-[10px] text-slate-500 dark:text-neutral-300 mt-0.5 leading-tight pr-1">{label}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-neutral-500 shrink-0 opacity-70 group-hover:text-accent group-hover:opacity-100 transition-colors" aria-hidden />
                </button>
              ))}
            </div>
          )}

          {canTeamTimesheetOps &&
            currentUser &&
            isFeatureEnabled(currentUser, 'view_stats') &&
            uiW('stats.mgmt_kpi_cards') && (
              <TimesheetManagementKpiBlock
                visibleWeekDays={weekDays}
                showDetailPanels={uiW('stats.detail_panels')}
              />
            )}

          {/* ── Turni Sera da Chiudere ──────────────────────────────────── */}
          {uiW('timesheet.dinner_close') && canTeamTimesheetOps && dinnerShiftsNeedingClose.length > 0 && (
            <motion.div
              id="timesheet-section-dinner-close"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 scroll-mt-24"
            >
              <div className="mb-3 flex items-center gap-2">
                <Moon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-100">{t.ts_dinner_close_required}</h3>
                <span className="ml-auto rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-200">
                  {dinnerShiftsNeedingClose.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dinnerShiftsNeedingClose.map((item) => (
                  <div
                    key={item.shift.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/35"
                  >
                    {/* Employee header */}
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                        {item.user?.first_name?.[0] ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-neutral-100">{item.user?.first_name ?? '—'}</p>
                        <p className="text-[11px] text-slate-500 dark:text-neutral-300 truncate">{item.user?.department ?? ''}</p>
                      </div>
                      <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-teal-200 bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:border-teal-800/50 dark:bg-teal-950/50 dark:text-teal-200">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" /> {t.ts_badge_in_shift}
                      </span>
                    </div>
                    {/* Times */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="rounded-xl bg-white/70 px-2.5 py-2 text-center dark:bg-neutral-950/50">
                        <p className="mb-0.5 text-[9px] font-semibold uppercase text-slate-400 dark:text-neutral-400">{t.ts_label_planned}</p>
                        <p className="text-sm font-bold text-slate-700 tabular-nums dark:text-neutral-200">
                          {item.scheduledStart}–{item.scheduledEnd}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white/70 px-2.5 py-2 text-center dark:bg-neutral-950/50">
                        <p className="mb-0.5 text-[9px] font-semibold uppercase text-slate-400 dark:text-neutral-400">{t.ts_label_actual_entry}</p>
                        <p className="text-sm font-bold text-slate-800 tabular-nums dark:text-neutral-100">{item.actualStart}</p>
                      </div>
                    </div>
                    {/* Close button */}
                    <button
                      type="button"
                      onClick={() => {
                        setClockOutTime(item.scheduledEnd);
                        setClosingShift({
                          shiftId: item.shift.id,
                          punchInId: item.punchInId,
                          dateStr: todayStr,
                          plannedStart: item.scheduledStart,
                          plannedEnd: item.scheduledEnd,
                          plannedMins: item.plannedMins,
                          actualStart: item.actualStart,
                          employeeName: item.user?.first_name ?? '—',
                        });
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors shadow-sm"
                    >
                      <LogOut className="w-4 h-4" /> {t.ts_btn_close_and_approve}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Turni pronti per l'approvazione ─────────────────────────── */}
          {uiW('timesheet.ready_approval') && canTeamTimesheetOps && readyForApproval.length > 0 && (
            <motion.div
              id="timesheet-section-ready-approval"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 scroll-mt-24"
            >
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-bold text-slate-800">{t.ts_ready_for_approval}</h3>
                <span className="ml-auto text-[11px] font-bold text-accent-dark bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">
                  {readyForApproval.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {readyForApproval.map((item) => {
                  const deltaColor = item.deltaMins > 5 ? 'text-accent' : item.deltaMins < -5 ? 'text-red-500' : 'text-slate-500';
                  const isApproving = approvingShiftId === item.shift.id;
                  const auditOpen = auditDetailShiftId === item.shift.id;
                  return (
                    <div
                      key={item.shift.id}
                      className="surface-glass surface-ghost-interactive border-accent/25 p-4 transition-colors hover:border-accent/40 dark:hover:border-accent/35"
                    >
                      {/* Employee + date */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent-dark font-bold text-sm flex-shrink-0">
                          {item.user?.first_name?.[0] ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{item.user?.first_name ?? '—'}</p>
                          <p className="text-[11px] text-slate-400 dark:text-neutral-400">
                            {safeFormatDate(item.dateStr, 'EEEE d MMM', { locale })}
                          </p>
                        </div>
                        {item.auditCount > 0 && (
                          <button
                            type="button"
                            title={(t as Record<string, string>).ts_audit_toggle_hint || ''}
                            aria-expanded={auditOpen}
                            onClick={() =>
                              setAuditDetailShiftId((id) => (id === item.shift.id ? null : item.shift.id))
                            }
                            className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 border transition-colors ${
                              auditOpen
                                ? 'text-orange-800 bg-orange-200 border-orange-300'
                                : 'text-orange-600 bg-orange-100 border-orange-200 hover:bg-orange-200/80'
                            }`}
                          >
                            <ShieldAlert className="w-3 h-3" />
                            {item.auditCount}
                          </button>
                        )}
                      </div>
                      {auditOpen && item.auditEntries.length > 0 && (
                        <div className="mb-3 rounded-xl border border-orange-200 bg-orange-50/80 px-3 py-2.5 space-y-1.5">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-orange-800/80">
                            {(t as Record<string, string>).ts_audit_changes_title || 'Modifiche'}
                          </p>
                          <ul className="space-y-1.5 text-[10px] text-slate-700">
                            {item.auditEntries.map((e) => (
                              <li key={e.id} className="leading-snug border-b border-orange-100/80 pb-1.5 last:border-0 last:pb-0">
                                <span className="font-semibold text-slate-800">{punchAuditFieldLabel(e.field)}</span>
                                <span className="text-slate-500 dark:text-neutral-300"> · </span>
                                <span className="tabular-nums">{formatAuditValue(e.old_value)}</span>
                                <span className="text-slate-400 dark:text-neutral-400"> → </span>
                                <span className="tabular-nums font-medium">{formatAuditValue(e.new_value)}</span>
                                <span className="block text-[9px] text-slate-500 dark:text-neutral-300 mt-0.5">{e.actor_name}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Pianificato vs Timbrato */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-slate-50 rounded-xl px-2.5 py-2">
                          <p className="text-[9px] text-slate-400 dark:text-neutral-400 uppercase font-semibold mb-0.5">{t.ts_label_planned}</p>
                          <p className="text-sm font-semibold text-slate-600 tabular-nums">
                            {item.plannedStart} → {item.plannedEnd}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-neutral-400 mt-0.5">{fmtHM(item.plannedMins)}</p>
                        </div>
                        <div className="bg-accent/5 rounded-xl px-2.5 py-2">
                          <p className="text-[9px] text-slate-400 dark:text-neutral-400 uppercase font-semibold mb-0.5">{t.ts_label_punched}</p>
                          <p className="text-sm font-bold text-slate-800 tabular-nums">
                            {item.actualStart} → {item.actualEnd}
                          </p>
                          <p className={`text-[10px] font-semibold mt-0.5 ${deltaColor} tabular-nums`}>
                            {fmtHM(item.grossActualMins)}
                            {item.breakDeductionMins > 0 && (
                              <span className="opacity-70">&nbsp;(−{fmtHM(item.breakDeductionMins)} {t.ts_break_deduction})</span>
                            )}
                          </p>
                          {item.breakDeductionMins > 0 && (
                            <p className="mt-0.5 text-[9px] font-normal leading-tight text-slate-400 dark:text-neutral-400">
                              {t.ts_break_hint_ready_card}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Ore progress bar */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.deltaMins >= 0 ? 'bg-accent' : 'bg-red-400'}`}
                            style={{ width: `${Math.min(100, Math.max(4, (item.actualMins / Math.max(item.plannedMins, 1)) * 100))}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold tabular-nums ${deltaColor}`}>
                          {Math.round((item.actualMins / Math.max(item.plannedMins, 1)) * 100)}%
                        </span>
                      </div>

                      {/* Approva e Congela — apre il modal di conferma */}
                      <button
                        type="button"
                        disabled={isApproving}
                        onClick={() => setApprovalConfirm({
                          shiftId: item.shift.id,
                          employeeName: item.user?.first_name ?? '—',
                          dateStr: item.dateStr,
                          plannedStart: item.plannedStart,
                          plannedEnd: item.plannedEnd,
                          plannedMins: item.plannedMins,
                          actualStart: item.actualStart,
                          actualEnd: item.actualEnd,
                          actualMins: item.actualMins,
                          deltaMins: item.deltaMins,
                          freezeUsesPlannedTimes: item.freezeUsesPlannedTimes,
                        })}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-bold transition-colors shadow-sm"
                      >
                        {isApproving ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            {t.ts_approving}
                          </span>
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            {t.ts_btn_approve_freeze} — {fmtHM(item.actualMins)}
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Toolbar presenze: sopra la griglia ── */}
          {uiW('timesheet.header') && (
          <div className="ui-toolbar-page-band ui-toolbar-page-band-presences !h-auto !max-h-none min-h-0 flex-col items-stretch justify-start gap-2.5 sm:!h-auto sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-start gap-2.5 overflow-x-auto-safe sm:flex-row sm:flex-nowrap sm:items-center sm:justify-start sm:gap-3">
              <div className="ui-toolbar-row-tight min-w-0 shrink-0">
                <div className="ui-toolbar-group">
                  <button type="button" onClick={() => setViewMode('week')}
                    className={`ui-toolbar-tab ${viewMode === 'week' ? 'bg-accent text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800/80'}`}>
                    {t.ts_period_week}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('month')}
                    className={`ui-toolbar-tab ${viewMode === 'month' ? 'bg-accent text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800/80'}`}
                    title={monthTabTitle}
                    aria-label={`${t.ts_period_month}${payrollStripForToolbar ? `. ${formatTrans(tv.ts_timesheet_month_payroll_strip ?? '', { dates: payrollStripForToolbar })}` : ''}`}
                  >
                    {t.ts_period_month}
                  </button>
                </div>

                {viewMode === 'month' && payrollStripForToolbar && (
                  <span
                    className="hidden min-[400px]:inline-flex h-9 max-w-[min(100%,22rem)] shrink-0 items-center truncate rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                    title={tv.ts_timesheet_month_tab_hint}
                  >
                    {formatTrans(tv.ts_timesheet_month_payroll_strip ?? 'Pagamento stipendi previsto: {dates}', { dates: payrollStripForToolbar })}
                  </span>
                )}

                {viewMode === 'week' && (
                  <div className="ui-toolbar-group">
                    <button type="button" onClick={goPrevWeek} disabled={weekIndex <= 0}
                      className="ui-toolbar-icon-btn hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-neutral-800/80">
                      <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-neutral-300" />
                    </button>
                    <span className="ui-toolbar-segment-static min-w-[3.25rem]">
                      {weekIndex + 1} / {displayPeriodConfig.numWeeks}
                    </span>
                    <button type="button" onClick={goNextWeek} disabled={weekIndex >= maxWeekIndex}
                      className="ui-toolbar-icon-btn hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-neutral-800/80">
                      <ChevronRight className="h-4 w-4 text-slate-600 dark:text-neutral-300" />
                    </button>
                  </div>
                )}

                <div
                  className="ui-toolbar-chip max-w-full min-w-0 cursor-default select-none font-semibold"
                  role="status"
                  aria-label={t.ts_period_chip_aria}
                  title={`${format(periodStartDate, 'dd/MM/yy', { locale })} → ${format(periodEndDate, 'dd/MM/yy', { locale })}`}
                >
                  <Calendar className="h-4 w-4 shrink-0 text-slate-500 dark:text-neutral-400" aria-hidden />
                  <span className="min-w-0 truncate tabular-nums">
                    {format(periodStartDate, 'dd/MM/yy', { locale })} → {format(periodEndDate, 'dd/MM/yy', { locale })}
                  </span>
                </div>

                <div className="ui-toolbar-group shrink-0">
                  <button
                    type="button"
                    onClick={goToToday}
                    disabled={todayWeekIndexInPeriod === null}
                    title={
                      todayWeekIndexInPeriod === null
                        ? t.ts_toolbar_today_outside
                        : t.ts_toolbar_today_hint
                    }
                    className={`ui-toolbar-tab ${
                      isShowingTodayWeek
                        ? 'bg-accent text-white'
                        : 'text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800/80'
                    }`}
                  >
                    {t.today}
                  </button>
                </div>
              </div>

              <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-2 border-t border-slate-200 pt-2 dark:border-white/10 sm:w-auto sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
                <div className="flex min-w-0 shrink-0 items-center gap-2">
                  <span className="hidden min-[480px]:inline shrink-0 whitespace-nowrap text-xs font-bold uppercase leading-none tracking-wide text-slate-600 dark:text-neutral-300">
                    {t.ts_label_from}
                  </span>
                  <DatePickerField
                    value={periodStart}
                    onChange={(v) => { setPeriodStart(v); setPeriodSaved(false); setWeekIndex(0); }}
                    allowClear={false}
                    compact
                    toolbarComfortable
                    aria-label={t.ts_period_start}
                    className="min-w-[7rem] max-w-[10rem] justify-between !border-slate-200 !bg-white shadow-sm dark:!border-white/10 dark:!bg-neutral-900 surface-ghost-interactive hover:!border-slate-300 dark:hover:!border-white/15"
                  />
                </div>
                <div className="ui-toolbar-group shrink-0">
                  <button
                    type="button"
                    onClick={() => { setPeriodNumWeeks(4); setPeriodSaved(false); setWeekIndex(0); }}
                    className={`ui-toolbar-tab px-2 ${
                      periodNumWeeks === 4
                        ? 'bg-accent text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800/80'
                    }`}
                  >
                    {t.ts_preset_4weeks}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPeriodNumWeeks(5); setPeriodSaved(false); setWeekIndex(0); }}
                    className={`ui-toolbar-tab px-2 ${
                      periodNumWeeks === 5
                        ? 'bg-accent text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800/80'
                    }`}
                  >
                    {t.ts_preset_5weeks}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { handleSavePeriodConfig(); }}
                  disabled={periodSaved}
                  className={`ui-toolbar-accent shrink-0 px-2.5 ${
                    periodSaved
                      ? 'cursor-not-allowed !bg-slate-200 !text-slate-500 hover:!bg-slate-200 dark:!bg-neutral-800 dark:!text-neutral-500'
                      : ''
                  }`}
                >
                  {t.ts_save_period}
                </button>
                {!periodSaved && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                    title={t.ts_save_period}
                    aria-label={t.ts_save_period}
                  />
                )}
              </div>
            </div>

            <div className="flex min-h-9 shrink-0 items-center justify-start gap-2 self-stretch sm:ml-auto sm:justify-end sm:self-center">
              {currentUser && isFeatureEnabled(currentUser, 'export_pdf') && (
                <button
                  type="button"
                  onClick={() => void handleExportTimesheetPdf()}
                  className="ui-toolbar-chip hover:bg-slate-50 dark:hover:bg-neutral-800/90"
                  title={t.download_pdf}
                  aria-label={t.download_pdf}
                >
                  <FileDown className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="hidden min-[380px]:inline">{t.download_pdf}</span>
                </button>
              )}
            </div>
          </div>
          )}
          {/* ── Griglia presenze (ancora scroll dalle card riepilogo) ─── */}
          {uiW('timesheet.main_grid') && (
          <>
          <div id="timesheet-section-main-grid" className="surface-glass overflow-hidden scroll-mt-24">
            <HorizontalScrollArea
              variant="overlay"
              remeasureKey={`${viewMode}-${weekStr}-${weekDays.length}`}
              ariaLabelPrev={t.table_h_scroll_prev}
              ariaLabelNext={t.table_h_scroll_next}
              scrollClassName="overflow-x-auto-safe"
            >
            <table className="w-full border-collapse min-w-[700px] md:min-w-[640px] [&_th]:border-slate-400 dark:[&_th]:border-white/35 [&_td]:border-slate-400 dark:[&_td]:border-white/35">
              <thead>
                <tr className="border-b-2 border-slate-300 dark:border-white/30">
                  <th className="sticky left-0 bg-slate-50 dark:bg-neutral-800 pl-4 pr-3 py-3.5 text-left text-slate-500 dark:text-neutral-100 text-[11px] uppercase tracking-wider font-semibold min-w-[130px] border-r-2 border-r-slate-400 dark:border-r-white/40 z-10 md:py-2.5 md:pl-3 md:pr-2 md:min-w-[112px]">
                    {t.employee}
                  </th>
                  {weekDays.map((day, dayIdx) => {
                    const todayDate = isToday(day);
                    const dStr = format(day, 'yyyy-MM-dd');
                    const inP = viewMode === 'month' ? isDayInConfiguredPeriod(day) : true;
                    const isPayrollDay = dStr === weekViewPayrollDayStr;
                    const payrollHighlight = isPayrollDay && (viewMode === 'week' || inP);
                    const isPast = dStr < todayStr;
                    const dayShiftCount = visibleUsers.reduce((n, u) => {
                      const d = timesheetData[u.id]?.[dStr];
                      return n + (d?.shifts.filter((s) => s.status !== 'approved').length ?? 0);
                    }, 0);
                    const canReview = inP && isPast && canTeamTimesheetOps && dayShiftCount > 0;
                    const weekEndCol = viewMode === 'month' && (dayIdx + 1) % 7 === 0;
                    return (
                      <th key={dStr}
                        onClick={canReview ? () => handleOpenDayReview(dStr) : undefined}
                        title={
                          isPayrollDay
                            ? `${format(day, 'EEEE d MMMM yyyy', { locale })} — ${tv.ts_payroll_day_abbr ?? 'Paga'}`
                            : canReview
                              ? t.ts_review_shifts_tooltip.replace('{n}', String(dayShiftCount))
                              : undefined
                        }
                        className={`px-2 py-2.5 text-center text-[11px] font-semibold whitespace-nowrap min-w-[92px] transition-colors md:min-w-[76px] md:px-1 md:py-1.5 ${
                          weekEndCol ? 'border-r-[3px] border-r-slate-500 dark:border-r-white/50' : 'border-r-2'
                        } ${
                          payrollHighlight
                            ? 'bg-emerald-50 dark:bg-emerald-950/45 ring-1 ring-inset ring-emerald-200/90 dark:ring-emerald-800/50'
                            : todayDate
                              ? 'bg-accent/5 dark:bg-accent/15'
                              : 'bg-slate-50 dark:bg-neutral-800'
                        } ${viewMode === 'month' && !inP ? '!bg-slate-100/90 dark:!bg-neutral-900/90 opacity-70' : ''} ${canReview ? 'cursor-pointer hover:bg-accent/10 dark:hover:bg-accent/20 group' : ''}`}
                      >
                        <div
                          className={
                            todayDate && inP ? 'text-accent' : !inP ? 'text-slate-400 dark:text-neutral-400' : 'text-slate-400 dark:text-neutral-200'
                          }
                        >
                          {format(day, 'EEE', { locale })}
                        </div>
                        <div
                          className={`font-bold mt-0.5 text-sm md:text-xs ${
                            todayDate && inP
                              ? 'text-accent'
                              : !inP
                                ? 'text-slate-500 dark:text-neutral-400'
                                : payrollHighlight
                                  ? 'text-emerald-900 dark:text-emerald-100'
                                  : 'text-slate-700 dark:text-white'
                          }`}
                        >
                          {format(day, 'd MMM', { locale })}
                        </div>
                        {payrollHighlight && (
                          <div className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                            {tv.ts_payroll_day_abbr ?? 'Paga'}
                          </div>
                        )}
                        {canReview && (
                          <div className="mt-0.5 text-[9px] font-semibold text-accent/60 group-hover:text-accent transition-colors">
                            {t.ts_review_short}
                          </div>
                        )}
                      </th>
                    );
                  })}
                  <th className="px-3 py-3.5 text-center text-slate-500 dark:text-neutral-100 text-[11px] uppercase tracking-wider font-semibold bg-slate-50 dark:bg-neutral-800 border-l-[3px] border-l-slate-500 dark:border-l-white/50 min-w-[80px] md:min-w-[68px] md:py-2 md:px-2">
                    {t.stats_total}
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibleUsers.map((user, userIdx) => {
                  const totals = userTotals[user.id];
                  return (
                    <tr
                      key={user.id}
                      className={`border-b-2 border-slate-300 dark:border-white/28 last:border-b-0 ${
                        userIdx % 2 === 0 ? 'bg-white dark:bg-neutral-950' : 'bg-slate-100/80 dark:bg-neutral-800/75'
                      }`}
                    >
                      {/* Nome dipendente */}
                      <td className="sticky left-0 bg-inherit pl-4 pr-3 py-3 border-r-2 border-r-slate-400 dark:border-r-white/40 z-10 md:py-2 md:pl-3 md:pr-2">
                        <div className="font-semibold text-sm text-slate-800 dark:text-neutral-100 md:text-xs">{user.first_name}</div>
                        {user.department && (
                          <div className="text-[10px] text-slate-400 dark:text-neutral-400 mt-0.5 md:text-[9px]">{user.department}</div>
                        )}
                      </td>

                      {/* Celle giornaliere */}
                      {weekDays.map((day, dayIdx) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayData = timesheetData[user.id]?.[dateStr];
                        const todayDate = isToday(day);
                        const inP = viewMode === 'month' ? isDayInConfiguredPeriod(day) : true;
                        const isPayrollDay = dateStr === weekViewPayrollDayStr;
                        const payrollHighlight = isPayrollDay && (viewMode === 'week' || inP);
                        const weekEndCol = viewMode === 'month' && (dayIdx + 1) % 7 === 0;
                        const tdBorder = weekEndCol ? 'border-r-[3px] border-r-slate-500 dark:border-r-white/50' : 'border-r-2';
                        const tdMuted = viewMode === 'month' && !inP;
                        const tdBg =
                          payrollHighlight
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/25'
                            : todayDate && inP
                              ? 'bg-accent/5 dark:bg-accent/10'
                              : tdMuted
                                ? 'bg-slate-100/90 dark:bg-neutral-900/80 opacity-70'
                                : '';

                        if (!dayData || dayData.shifts.length === 0) {
                          return (
                            <td key={dateStr} className={`px-2 py-3 text-center ${tdBorder} ${tdBg} md:px-1.5 md:py-2`}>
                              <span className={`text-sm md:text-xs ${tdMuted ? 'text-slate-300 dark:text-neutral-600' : 'text-slate-200 dark:text-neutral-600'}`}>–</span>
                            </td>
                          );
                        }

                        return (
                          <td key={dateStr} className={`px-1.5 py-2 ${tdBorder} align-top ${tdBg} md:px-1 md:py-1.5`}>
                            <div className="flex flex-col gap-1 md:gap-0.5">
                              {dayData.shifts.map((s) => {
                                const punchAuditCount = s.punchInId ? (punchAudits[s.punchInId]?.length ?? 0) : 0;
                                const boardShift = shifts.find((sh) => sh.id === s.id) ?? null;
                                const { border, bg, ring, dot } = getShiftCardStyle(s, punchAuditCount, dateStr, boardShift);
                                const punchMissingCell =
                                  !!boardShift && shiftPastPlannedEndWithoutClockIn(boardShift, punchRecords);
                                const publishedCell = s.status === 'confirmed' || s.status === 'approved';
                                const deltaColor =
                                  s.deltaMins > 5 ? 'text-accent' : s.deltaMins < -5 ? 'text-red-500' : 'text-slate-500 dark:text-neutral-300';

                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => openDrawer(s, user, dateStr)}
                                    className={`flex w-full items-stretch text-left rounded-xl border-l-[3px] ${border} ${bg} ${ring} py-1.5 pl-2 pr-2 shadow-sm hover:shadow-md transition-all group md:rounded-lg md:py-1 md:pl-1.5 md:pr-1.5 md:border-l-2`}
                                  >
                                    {/* Spunta / lucchetto subito dopo la barra verticale, poi orari */}
                                    {(s.status === 'confirmed' || s.status === 'approved') && (
                                      <span className="mr-1.5 flex shrink-0 flex-col items-center justify-center gap-0.5 self-stretch md:mr-1">
                                        {s.status === 'confirmed' && (
                                          <Check
                                            className="h-2.5 w-2.5 shrink-0 text-emerald-600 dark:text-emerald-400 md:h-2 md:w-2"
                                            strokeWidth={2.5}
                                            aria-hidden
                                          />
                                        )}
                                        {s.status === 'approved' && (
                                          <Lock
                                            className="h-2.5 w-2.5 shrink-0 text-accent-dark dark:text-accent-light md:h-2 md:w-2"
                                            strokeWidth={2.5}
                                            aria-hidden
                                          />
                                        )}
                                      </span>
                                    )}
                                    <div className="flex min-w-0 flex-1 flex-col gap-1 md:gap-0.5">
                                    <div className="mb-0.5 flex items-center justify-between gap-1 md:mb-0">
                                      <span className="text-[11px] font-semibold text-slate-600 dark:text-white tabular-nums md:text-[10px]">
                                        {s.plannedStart}–{s.plannedEnd || '?'}
                                      </span>
                                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dot} md:h-1.5 md:w-1.5`} />
                                    </div>
                                    {/* Actual times or status */}
                                    {s.punched ? (
                                      s.actualEnd ? (
                                        <div className="flex items-center justify-between">
                                          <span className="text-[11px] font-bold text-slate-800 dark:text-white tabular-nums md:text-[10px]">
                                            {s.actualStart}–{s.actualEnd}
                                          </span>
                                          <span className={`text-[10px] font-semibold ${deltaColor} tabular-nums md:text-[9px]`}>
                                            {s.deltaMins >= 0 ? '+' : ''}{fmtHM(s.deltaMins)}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="text-[10px] font-semibold text-red-700 dark:text-red-200 flex items-center gap-0.5 md:text-[9px]">
                                          <span>{s.actualStart}</span>
                                          <span className="text-red-500 dark:text-red-400">{t.ts_missing_exit}</span>
                                        </div>
                                      )
                                    ) : (
                                      <div
                                        className={`text-[10px] font-semibold italic md:text-[9px] ${
                                          s.status === 'draft'
                                            ? 'text-slate-700 dark:text-neutral-200'
                                            : punchMissingCell
                                              ? 'text-amber-950 dark:text-amber-100'
                                              : publishedCell
                                                ? 'text-emerald-900 dark:text-emerald-50'
                                                : 'text-amber-950 dark:text-amber-100'
                                        }`}
                                      >
                                        {s.status === 'draft' ? t.ts_status_draft : t.ts_status_unpunched}
                                      </div>
                                    )}
                                    {/* Badge icone */}
                                    <div className="flex items-center gap-1 mt-1 md:mt-0.5 md:gap-0.5">
                                      {punchAuditCount > 0 && (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-orange-600 dark:text-orange-200 bg-orange-100 dark:bg-orange-950/55 rounded-xl px-1 py-0.5 md:rounded-md md:px-0.5 md:py-px">
                                          <ShieldAlert className="w-2.5 h-2.5 md:h-2 md:w-2" />{punchAuditCount}
                                        </span>
                                      )}
                                      {getShiftHistory(s.id).length > 0 && (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/50 rounded-xl px-1 py-0.5 md:rounded-md md:px-0.5 md:py-px">
                                          <History className="w-2.5 h-2.5 md:h-2 md:w-2" />{getShiftHistory(s.id).length}
                                        </span>
                                      )}
                                      <ArrowRight className="w-2.5 h-2.5 text-slate-300 dark:text-neutral-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity md:h-2 md:w-2" />
                                    </div>
                                    </div>
                                  </button>
                                );
                              })}
                              {dayData.shifts.length > 1 && (
                                <div className="text-[10px] font-semibold text-slate-500 dark:text-neutral-300 text-right px-1 mt-0.5 md:text-[9px] md:px-0.5">
                                  {fmtHM(dayData.totalPlannedMins)} / {dayData.totalActualMins > 0 ? fmtHM(dayData.totalActualMins) : '?'}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Totale settimana */}
                      <td className="px-3 py-3 text-center border-l-[3px] border-l-slate-500 dark:border-l-white/50 bg-slate-50/50 dark:bg-neutral-800/60 md:px-2 md:py-2">
                        <div className="text-xs font-semibold text-slate-500 dark:text-neutral-200 md:text-[10px]">
                          {formatMinutesToHoursAndMinutes(totals?.plannedMins ?? 0)}
                        </div>
                        {(totals?.actualMins ?? 0) > 0 && (
                          <>
                            <div className="text-sm font-bold text-slate-900 dark:text-white md:text-xs">{formatMinutesToHoursAndMinutes(totals?.actualMins ?? 0)}</div>
                            <div className={`text-[10px] font-semibold ${(totals?.deltaMins ?? 0) >= 0 ? 'text-accent' : 'text-red-500'} md:text-[9px]`}>
                              {(totals?.deltaMins ?? 0) >= 0 ? '+' : ''}{fmtHM(totals?.deltaMins ?? 0)}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Empty state — nessun dipendente */}
                {visibleUsers.length === 0 && (
                  <tr>
                    <td colSpan={weekDays.length + 2} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center">
                          <Calendar className="w-6 h-6 text-slate-300 dark:text-neutral-500" />
                        </div>
                        <p className="text-slate-600 dark:text-white font-semibold text-sm">{t.ts_no_data}</p>
                        <p className="text-slate-400 dark:text-neutral-400 text-xs">{t.ts_no_employees_this_week}</p>
                      </div>
                    </td>
                  </tr>
                )}
                {/* Empty state — dipendenti presenti ma senza turni */}
                {visibleUsers.length > 0 && visibleUsers.every((u) =>
                  weekDays.every((d) => (timesheetData[u.id]?.[format(d,'yyyy-MM-dd')]?.shifts.length ?? 0) === 0)
                ) && (
                  <tr>
                    <td colSpan={weekDays.length + 2} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center">
                          <Calendar className="w-6 h-6 text-slate-300 dark:text-neutral-500" />
                        </div>
                        <p className="text-slate-600 dark:text-white font-semibold text-sm">{t.ts_no_shifts_this_week}</p>
                        <p className="text-slate-400 dark:text-neutral-400 text-xs">{t.ts_no_shifts_description}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Footer totali */}
              {canTeamTimesheetOps && (
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-neutral-800 border-t-2 border-slate-400 dark:border-white/35">
                    <td className="sticky left-0 bg-slate-50 dark:bg-neutral-800 pl-4 pr-3 py-3 text-slate-600 dark:text-white font-bold text-xs uppercase border-r-2 border-r-slate-400 dark:border-r-white/40 z-10 md:py-2 md:pl-3 md:pr-2 md:text-[10px]">
                      {t.stats_total}
                    </td>
                    {weekDays.map((day, dayIdx) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const planned = visibleUsers.reduce((s, u) => s + (timesheetData[u.id]?.[dateStr]?.totalPlannedMins ?? 0), 0);
                      const actual = visibleUsers.reduce((s, u) => s + (timesheetData[u.id]?.[dateStr]?.totalActualMins ?? 0), 0);
                      const inP = viewMode === 'month' ? isDayInConfiguredPeriod(day) : true;
                      const isPayrollDay = dateStr === weekViewPayrollDayStr;
                      const payrollHighlight = isPayrollDay && (viewMode === 'week' || inP);
                      const weekEndCol = viewMode === 'month' && (dayIdx + 1) % 7 === 0;
                      const tdBorder = weekEndCol ? 'border-r-[3px] border-r-slate-500 dark:border-r-white/50' : 'border-r-2';
                      const tdMuted = viewMode === 'month' && !inP;
                      const tdBg =
                        payrollHighlight
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/25'
                          : tdMuted
                            ? 'bg-slate-100/90 dark:bg-neutral-900/80 opacity-70'
                            : '';
                      return (
                        <td key={dateStr} className={`px-2 py-3 text-center ${tdBorder} text-xs ${tdBg} md:px-1.5 md:py-2 md:text-[10px]`}>
                          {planned > 0 ? (
                            <>
                              <div className={tdMuted ? 'text-slate-400 dark:text-neutral-500' : 'text-slate-500 dark:text-neutral-200'}>
                                {formatMinutesToHoursAndMinutes(planned)}
                              </div>
                              {actual > 0 && (
                                <div className={`font-semibold ${tdMuted ? 'text-slate-500 dark:text-neutral-300' : 'text-slate-800 dark:text-white'}`}>
                                  {formatMinutesToHoursAndMinutes(actual)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className={tdMuted ? 'text-slate-300 dark:text-neutral-600' : 'text-slate-300 dark:text-neutral-600'}>–</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center bg-slate-50 dark:bg-neutral-800 border-l-[3px] border-l-slate-500 dark:border-l-white/50 md:px-2 md:py-2">
                      <div className="text-xs text-slate-500 dark:text-neutral-200 md:text-[10px]">
                        {formatMinutesToHoursAndMinutes(visibleUsers.reduce((s, u) => s + (userTotals[u.id]?.plannedMins ?? 0), 0))}
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white md:text-[10px]">
                        {(() => { const act = visibleUsers.reduce((s, u) => s + (userTotals[u.id]?.actualMins ?? 0), 0); return act > 0 ? formatMinutesToHoursAndMinutes(act) : ''; })()}
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            </HorizontalScrollArea>
          </div>
          </>
          )}

          {/* Box personale per staff */}
          {!canTeamTimesheetOps && currentUser && uiW('timesheet.staff_summary_box') && (
            <div className="mt-4 rounded-2xl border border-slate-100 bg-transparent p-5 shadow-none dark:border-white/10 dark:bg-transparent">
              <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-neutral-400 mb-3 font-semibold">
                {t.timesheet_my_week}
              </p>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: t.ts_kpi_planned, val: formatMinutesToHoursAndMinutes(userTotals[currentUser.id]?.plannedMins ?? 0), color: 'text-slate-800' },
                  { label: t.ts_kpi_punched, val: (userTotals[currentUser.id]?.actualMins ?? 0) > 0 ? formatMinutesToHoursAndMinutes(userTotals[currentUser.id]?.actualMins ?? 0) : '–', color: 'text-slate-800' },
                  { label: t.ts_kpi_delta, val: `${(userTotals[currentUser.id]?.deltaMins ?? 0) >= 0 ? '+' : ''}${fmtHM(userTotals[currentUser.id]?.deltaMins ?? 0)}`, color: (userTotals[currentUser.id]?.deltaMins ?? 0) >= 0 ? 'text-accent' : 'text-red-500' },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <p className="text-[10px] text-slate-400 dark:text-neutral-400 uppercase tracking-wide mb-1">{label}</p>
                    <p className={`text-2xl font-bold ${color}`}>{val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </motion.div>
      </div>

      {/* ── Popup centrato: dettaglio turno (stesso schema del tabellone) ── */}
      <CenteredModalPortal
        open={!!drawerData}
        onClose={closeTimesheetShiftDrawer}
        panelRef={timesheetShiftDetailPanelRef}
        maxWidthClass="max-w-sm md:max-w-2xl lg:max-w-4xl"
        maxHeightClass="max-h-[min(92dvh,820px)] lg:max-h-[min(92dvh,900px)]"
        overlayZClass="z-[10050]"
        ariaLabel={drawerData ? `${drawerData.employeeName} · ${drawerData.dateStr}` : t.ts_shift_detail_modal_aria}
        panelClassName="!overflow-hidden flex flex-col p-0"
        markDatePickerPortal
      >
        {drawerData && (() => {
          const s = drawerData.shift;
          const fullShift = shifts.find((sh) => sh.id === s.id);
          const isFrozen = fullShift ? isShiftPayrollFrozen(fullShift) : shiftRowPayrollFrozen(s);
          const isApproved = isFrozen;
          const canClose = canTeamTimesheetOps && s.punched && !s.actualEnd && !!s.punchInId && !isFrozen;
          const canOpenFreezeModal =
            canTimesheetApprove &&
            !!fullShift &&
            shiftCanBeFrozenFromTimesheet(fullShift, punchRecords, todayStr);
          const isAbsentDraw = s.status === 'absent';
          const canMarkAbsentTimesheet =
            canTimesheetApprove && !isFrozen && !isAbsentDraw && drawerData.dateStr <= todayStr;
          const canRegisterManualPunch =
            canTeamTimesheetOps &&
            !isApproved &&
            !isAbsentDraw &&
            !s.punched &&
            drawerData.dateStr <= todayStr;
          const punchAuditEntries = drawerData.punchAuditEntries;
          const shiftEdits = drawerData.shiftEdits;
          const { dot, border, bg, ring, label, labelCls } = getShiftCardStyle(
            s,
            punchAuditEntries.length,
            drawerData.dateStr,
            fullShift ?? null
          );
          const deltaColor =
            s.deltaMins > 5 ? 'text-accent' : s.deltaMins < -5 ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-neutral-400';

          const plannedPublishedCard = s.status === 'confirmed' || s.status === 'approved';
          const plannedDraftCard = s.status === 'draft';
          const plannedAbsentCard = s.status === 'absent';
          const plannedCardBoxClass = plannedPublishedCard
            ? 'rounded-xl border-2 border-solid border-emerald-500/80 bg-emerald-50/95 p-3 dark:border-emerald-500/50 dark:bg-emerald-950/40'
            : plannedAbsentCard
              ? 'rounded-xl border-2 border-dashed border-rose-400/85 bg-rose-50 p-3 dark:border-rose-500/65 dark:bg-rose-950/35'
              : plannedDraftCard
                ? 'rounded-xl border-2 border-dashed border-slate-400 bg-slate-50 p-3 dark:border-white/75 dark:bg-neutral-950/85'
                : 'rounded-xl border-2 border-dashed border-slate-400 bg-slate-50/90 p-3 dark:border-white/75 dark:bg-neutral-950/85';
          const plannedCardLabelCls = plannedPublishedCard
            ? 'text-emerald-700 dark:text-emerald-400'
            : plannedAbsentCard
              ? 'text-rose-600 dark:text-rose-400'
              : plannedDraftCard
                ? 'text-slate-600 dark:text-neutral-400'
                : 'text-slate-500 dark:text-neutral-400';
          const plannedCardMainCls = plannedPublishedCard
            ? 'text-emerald-900 dark:text-emerald-100'
            : plannedAbsentCard
              ? 'text-rose-900 dark:text-rose-100'
              : plannedDraftCard
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-800 dark:text-neutral-100';
          const plannedCardSubCls = plannedPublishedCard
            ? 'text-emerald-700/90 dark:text-emerald-300/90'
            : plannedAbsentCard
              ? 'text-rose-700 dark:text-rose-300'
              : plannedDraftCard
                ? 'text-slate-600 dark:text-neutral-300'
                : 'text-slate-500 dark:text-neutral-300';

          return (
              <div className="flex min-h-0 max-h-full flex-1 flex-col overflow-hidden">
                {/* Drawer header — strip colorato in base allo stato */}
                <div className={`border-l-4 ${border} ${bg} ${ring}`}>
                  <div className="flex items-start justify-between px-5 pt-5 pb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${labelCls}`}>
                          {label}
                        </span>
                        {drawerData.department && (
                          <span className="truncate rounded-full border border-slate-200/90 bg-slate-50/50 px-2 py-0.5 text-[10px] font-medium text-slate-600 backdrop-blur-[1px] dark:border-white/12 dark:bg-neutral-800/40 dark:text-neutral-300">
                            {drawerData.department}
                          </span>
                        )}
                        {isApproved && <Lock className="w-3.5 h-3.5 text-accent ml-auto flex-shrink-0" />}
                      </div>
                      <h3 className="truncate text-xl font-bold leading-tight text-slate-900 dark:text-neutral-100">
                        {drawerData.employeeName}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-neutral-300 mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        {safeFormatDate(drawerData.dateStr, 'EEEE d MMMM yyyy', { locale })}
                      </p>
                    </div>
                    <div className="ml-3 flex flex-shrink-0 items-start gap-0.5">
                      <button
                        type="button"
                        onClick={closeTimesheetShiftDrawer}
                        className="rounded-xl p-2 transition-colors hover:bg-white/80 dark:hover:bg-white/10"
                      >
                        <X className="h-4 w-4 text-slate-500 dark:text-neutral-300" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Corpo popup (scroll) */}
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {s.status === 'absent' && canTeamTimesheetOps && !isFrozen && (
                    <div className="border-b border-rose-100 bg-rose-50/90 p-5 dark:border-rose-900/40 dark:bg-rose-950/35">
                      <p className="text-sm font-medium text-rose-900 dark:text-rose-100">{t.wst_status_sub_absent}</p>
                      <button
                        type="button"
                        onClick={() =>
                          void (async () => {
                            try {
                              await updateShift(s.id, { approval_status: 'confirmed' });
                              showSuccess?.(t.shift_restored_published_toast);
                              closeTimesheetShiftDrawer();
                            } catch {
                              showError?.(t.save_error);
                            }
                          })()
                        }
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white py-2.5 text-sm font-bold text-rose-800 transition-colors hover:bg-rose-50 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-100 dark:hover:bg-rose-900/50"
                      >
                        {t.shift_restore_published_btn}
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 md:items-stretch md:divide-x md:divide-slate-100 dark:md:divide-white/10">
                  <div className="min-w-0">
                  {/* Riepilogo ore */}
                  <div className="border-b border-slate-100 p-5 dark:border-white/10">
                    <div className="mb-3 grid grid-cols-2 gap-3">
                      <div className={plannedCardBoxClass}>
                        <p className={`mb-1 text-[10px] font-semibold uppercase ${plannedCardLabelCls}`}>{t.ts_label_planned}</p>
                        <div className="flex items-start gap-2">
                          {(s.status === 'confirmed' || s.status === 'approved') && (
                            <span className="flex shrink-0 flex-col items-center justify-center gap-1 pr-1">
                              {s.status === 'confirmed' && (
                                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden />
                              )}
                              {s.status === 'approved' && (
                                <Lock className="h-4 w-4 text-accent dark:text-accent-light" strokeWidth={2.5} aria-hidden />
                              )}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`text-base font-bold tabular-nums ${plannedCardMainCls}`}>
                              {s.plannedStart}–{s.plannedEnd}
                            </p>
                            <p className={`mt-0.5 text-[11px] ${plannedCardSubCls}`}>{fmtHM(s.plannedMins)}</p>
                          </div>
                        </div>
                      </div>
                      <div
                        className={`rounded-xl p-3 ${
                          s.punched
                            ? s.isCrossDay
                              ? 'bg-red-50 dark:bg-red-950/35'
                              : 'bg-teal-50 dark:bg-teal-950/35'
                            : 'border-2 border-amber-400/90 bg-amber-50 dark:border-amber-500/70 dark:bg-amber-950/45'
                        }`}
                      >
                        <p className={`mb-1 text-[10px] font-semibold uppercase ${s.punched ? 'text-slate-400 dark:text-neutral-400' : 'text-amber-800/90 dark:text-amber-200/90'}`}>{t.ts_label_punched}</p>
                        {s.punched ? (
                          <>
                            <p className="text-base font-bold tabular-nums text-slate-800 dark:text-neutral-100">
                              {s.actualStart}
                              {s.actualEnd ? `–${s.actualEnd}` : ''}
                            </p>
                            {s.isCrossDay && s.actualEndFull && (
                              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                {formatTrans(t.ts_crossday_out_label, {
                                  time: format(new Date(s.actualEndFull), 'dd/MM HH:mm'),
                                })}
                              </p>
                            )}
                            <p
                              className={`mt-0.5 text-[11px] font-semibold ${s.actualMins > 0 && !s.isCrossDay ? deltaColor : 'text-amber-600 dark:text-amber-400'}`}
                            >
                              {s.isCrossDay
                                ? t.ts_fix_exit_time_label
                                : s.actualMins > 0
                                  ? `${fmtHM(s.actualMins)} (${s.deltaMins >= 0 ? '+' : ''}${fmtHM(s.deltaMins)})`
                                  : t.ts_out_missing_short}
                            </p>
                            <div className="mt-2 space-y-0.5 border-t border-teal-200/60 pt-2 dark:border-teal-800/40">
                              <p className="text-[10px] leading-snug text-slate-600 dark:text-neutral-400">
                                <span className="font-semibold text-slate-500 dark:text-neutral-500">{t.ts_punch_source_row_in}</span>{' '}
                                {punchSourceLabel(s.punchInSource, t)}
                              </p>
                              {s.actualEnd ? (
                                <p className="text-[10px] leading-snug text-slate-600 dark:text-neutral-400">
                                  <span className="font-semibold text-slate-500 dark:text-neutral-500">{t.ts_punch_source_row_out}</span>{' '}
                                  {punchSourceLabel(s.punchOutSource, t)}
                                </p>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{t.ts_status_unpunched}</p>
                        )}
                      </div>
                    </div>

                    {/* Ore effettive summary se complete */}
                    {s.punched && s.actualEnd && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-neutral-700">
                          <div
                            className={`h-full rounded-full transition-all ${s.deltaMins >= 0 ? 'bg-accent' : 'bg-red-400'}`}
                            style={{ width: `${Math.min(100, Math.max(5, (s.actualMins / Math.max(s.plannedMins, 1)) * 100))}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold ${deltaColor} tabular-nums`}>
                          {Math.round((s.actualMins / Math.max(s.plannedMins, 1)) * 100)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Storico modifiche turno — sempre sotto riepilogo pianificato / timbrato (scheda con bordo come timbrature manuali) */}
                  {shiftEdits.length > 0 && (
                    <div className="border-b border-slate-100 p-5 dark:border-white/10">
                      <div className="overflow-hidden rounded-xl border-2 border-amber-400/90 bg-white/85 shadow-sm dark:border-amber-500/70 dark:bg-amber-950/50">
                        <button
                          type="button"
                          aria-expanded={drawerShiftEditsExpanded}
                          aria-controls="timesheet-drawer-shift-edits"
                          onClick={() => setDrawerShiftEditsExpanded((v) => !v)}
                          className="flex w-full items-center gap-2 px-3.5 py-3.5 text-left transition-colors hover:bg-amber-50/80 dark:hover:bg-amber-950/40"
                        >
                          <History className="h-4 w-4 flex-shrink-0 text-amber-500 dark:text-amber-400" />
                          <span className="text-sm font-bold text-slate-800 dark:text-neutral-100">{t.ts_drawer_shift_edits}</span>
                          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                            {shiftEdits.length}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform dark:text-neutral-500 ${drawerShiftEditsExpanded ? 'rotate-180' : ''}`}
                            aria-hidden
                          />
                        </button>
                        {drawerShiftEditsExpanded && (
                          <div
                            id="timesheet-drawer-shift-edits"
                            className="flex flex-col gap-2 border-t border-amber-200/80 px-3.5 pb-3.5 pt-3 dark:border-amber-800/40"
                          >
                          {shiftEdits.map((e) => (
                            <div
                              key={e.id}
                              className="rounded-xl border border-amber-100 bg-amber-50/90 p-3 dark:border-amber-900/40 dark:bg-amber-950/35"
                            >
                              <div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-neutral-400">
                                <span className="font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">{e.field}</span>
                                <span>{format(new Date(e.timestamp), 'dd/MM HH:mm')}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="rounded-xl bg-red-50 px-1.5 py-0.5 text-red-600 line-through dark:bg-red-950/50 dark:text-red-300">
                                  {e.oldValue}
                                </span>
                                <ArrowRight className="h-3 w-3 flex-shrink-0 text-slate-400 dark:text-neutral-500" />
                                <span className="rounded-xl bg-accent/10 px-1.5 py-0.5 font-semibold text-accent-dark dark:bg-accent/20 dark:text-accent-light">
                                  {e.newValue}
                                </span>
                              </div>
                              <p className="mt-1.5 text-[10px] text-slate-500 dark:text-neutral-400">da {e.actorName}</p>
                            </div>
                          ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {punchAuditEntries.length === 0 && shiftEdits.length === 0 && (
                    <div className="border-b border-slate-100 p-5 text-center text-sm text-slate-400 dark:border-white/10 dark:text-neutral-400">
                      <FileEdit className="mx-auto mb-2 h-8 w-8 text-slate-200 dark:text-neutral-600" />
                      {t.ts_drawer_no_edits}
                    </div>
                  )}
                  </div>
                  <div className="flex min-w-0 flex-col">
                  {/* Timbrature in alto a destra (desktop): form visibile senza scroll nella colonna destra */}
                  {!isAbsentDraw && (
                    <div className="border-b border-slate-100 p-5 dark:border-white/10">
                      <div className="space-y-2 rounded-xl border-2 border-amber-400/90 bg-white/85 p-3.5 shadow-sm dark:border-amber-500/70 dark:bg-amber-950/50">
                        <div>
                          <h4 className="text-sm font-bold text-amber-950 dark:text-amber-100">{t.ts_drawer_manual_punches_title}</h4>
                          <p className="mt-0.5 text-[11px] font-medium text-amber-900/85 dark:text-amber-200/90">{t.ts_drawer_manual_punches_hint}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <div className="rounded-lg bg-white/80 px-3 py-2.5 ring-1 ring-amber-200/80 dark:bg-neutral-900/40 dark:ring-amber-800/50">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-300/90">
                              {t.ts_drawer_manual_punch_in}
                            </p>
                            <p
                              className={`text-base font-bold tabular-nums ${
                                s.actualStart ? 'text-slate-900 dark:text-neutral-100' : 'text-amber-700/45 dark:text-amber-400/45'
                              }`}
                            >
                              {s.actualStart ?? '—'}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white/80 px-3 py-2.5 ring-1 ring-amber-200/80 dark:bg-neutral-900/40 dark:ring-amber-800/50">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-300/90">
                              {t.ts_drawer_manual_punch_out}
                            </p>
                            <p
                              className={`text-base font-bold tabular-nums ${
                                s.actualEnd ? 'text-slate-900 dark:text-neutral-100' : 'text-amber-700/45 dark:text-amber-400/45'
                              }`}
                            >
                              {s.actualEnd ?? '—'}
                            </p>
                            {s.isCrossDay && s.actualEndFull && s.actualEnd && (
                              <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-900 dark:text-amber-200">
                                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                                {formatTrans(t.ts_crossday_out_label, {
                                  time: format(new Date(s.actualEndFull), 'dd/MM HH:mm'),
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      {canRegisterManualPunch && (
                        <div className="space-y-3 border-t border-amber-200/80 pt-3 dark:border-amber-800/40">
                          <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800/70 dark:text-amber-300/80">
                              {t.ts_drawer_manual_punch_in}
                            </p>
                            <TimeInputField
                              value={manualPunchIn}
                              onChange={setManualPunchIn}
                              aria-label={t.ts_drawer_manual_punch_in}
                              className="w-full focus-within:ring-amber-500"
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800/70 dark:text-amber-300/80">
                              {t.ts_drawer_manual_punch_out_date}
                            </p>
                            <input
                              type="date"
                              value={manualPunchOutDate}
                              onChange={(e) => setManualPunchOutDate(e.target.value)}
                              className="w-full rounded-xl border border-amber-200/90 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-transparent focus:ring-2 focus:ring-amber-500 dark:border-amber-800/50 dark:bg-neutral-800 dark:text-neutral-100"
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800/70 dark:text-amber-300/80">
                              {t.ts_drawer_manual_punch_out}
                            </p>
                            <TimeInputField
                              value={manualPunchOut}
                              onChange={setManualPunchOut}
                              aria-label={t.ts_drawer_manual_punch_out}
                              className="w-full focus-within:ring-amber-500"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={manualPunchSaving}
                            onClick={() => void handleDrawerInsertManualPunches()}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-amber-700 disabled:opacity-40 dark:bg-amber-600 dark:hover:bg-amber-500"
                          >
                            {manualPunchSaving ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            ) : (
                              <Clock className="h-3.5 w-3.5" />
                            )}
                            {t.ts_drawer_manual_punches_save}
                          </button>
                        </div>
                      )}
                      </div>
                    </div>
                  )}
                  {/* ── Blocco Approvazione (sempre visibile se approvato) ── */}
                  {isApproved && (
                    <div className="border-b border-slate-100 bg-accent/5 p-5 dark:border-white/10 dark:bg-accent/10">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-accent/15">
                          <Lock className="h-4 w-4 text-accent" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-accent-dark dark:text-accent-light">{t.ts_drawer_approved_frozen}</p>
                          <p className="text-[11px] text-accent dark:text-accent-light/90">{t.ts_drawer_no_further_edits}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="surface-glass-sm bg-slate-50/40 p-3 dark:bg-neutral-900/35">
                          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-neutral-400">{t.ts_drawer_approved_by}</p>
                          <p className="truncate text-sm font-bold text-slate-800 dark:text-neutral-100">{s.approved_by ?? '—'}</p>
                        </div>
                        <div className="surface-glass-sm bg-slate-50/40 p-3 dark:bg-neutral-900/35">
                          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-neutral-400">{t.ts_drawer_approval_date}</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-neutral-100">
                            {s.approved_at
                              ? format(new Date(s.approved_at), 'dd/MM/yyyy HH:mm')
                              : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Audit log timbrature */}
                  {punchAuditEntries.length > 0 && (
                    <div className="border-b border-slate-100 p-5 dark:border-white/10">
                      <div className="mb-3 flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-neutral-100">{t.ts_drawer_punch_edits}</h4>
                        <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-950/50 dark:text-orange-200">
                          {punchAuditEntries.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {punchAuditEntries.map((e) => (
                          <div
                            key={e.id}
                            className="rounded-xl border border-orange-100 bg-orange-50/90 p-3 dark:border-orange-900/40 dark:bg-orange-950/35"
                          >
                            <div className="mb-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-neutral-400">
                              <span className="font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">{e.field}</span>
                              <span>{format(new Date(e.changed_at), 'dd/MM HH:mm')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="rounded-xl bg-red-50 px-1.5 py-0.5 text-red-600 line-through dark:bg-red-950/50 dark:text-red-300">
                                {fmtAuditValue(e.old_value)}
                              </span>
                              <ArrowRight className="h-3 w-3 flex-shrink-0 text-slate-400 dark:text-neutral-500" />
                              <span className="rounded-xl bg-accent/10 px-1.5 py-0.5 font-semibold text-accent-dark dark:bg-accent/20 dark:text-accent-light">
                                {fmtAuditValue(e.new_value)}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[10px] text-slate-500 dark:text-neutral-400">da {e.actor_name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                  </div>
                </div>

                {/* Drawer footer – azioni */}
                {canTeamTimesheetOps && !isApproved && !isAbsentDraw && (
                  <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] dark:border-white/10 dark:bg-neutral-900">
                    {/* ── Orario pianificato: modificabile solo in bozza; pubblicato = tabellone ── */}
                    {s.status !== 'confirmed' && (
                      <div>
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-neutral-400">{t.ts_drawer_shift_time}</p>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <TimeInputField
                              value={drawerEditStart}
                              onChange={setDrawerEditStart}
                              aria-label={t.ts_drawer_shift_time}
                              className="flex-1 focus-within:ring-accent"
                            />
                            <span className="text-sm font-bold text-slate-400 dark:text-neutral-400">–</span>
                            <TimeInputField
                              value={drawerEditEnd}
                              onChange={setDrawerEditEnd}
                              aria-label={t.ts_drawer_shift_time}
                              className="flex-1 focus-within:ring-accent"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={drawerEditSaving}
                            onClick={async () => {
                              const timesDirty = drawerEditStart !== s.plannedStart || drawerEditEnd !== s.plannedEnd;
                              if (timesDirty) {
                                await handleDrawerSaveShift(s.id, drawerEditStart, drawerEditEnd);
                              } else {
                                showSuccess?.(t.ts_drawer_nothing_to_save_hint);
                              }
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
                          >
                            {drawerEditSaving ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            {t.wst_save_changes_btn}
                          </button>
                        </div>
                      </div>
                    )}
                    {s.status === 'confirmed' && (
                      <p className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-center text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-neutral-800/80 dark:text-neutral-300">
                        {t.wst_schedule_readonly_after_publish}
                      </p>
                    )}
                    {canOpenFreezeModal && (
                      <button
                        type="button"
                        onClick={() =>
                          setApprovalConfirm({
                            shiftId: s.id,
                            employeeName: drawerData.employeeName,
                            dateStr: drawerData.dateStr,
                            plannedStart: s.plannedStart,
                            plannedEnd: s.plannedEnd,
                            plannedMins: s.plannedMins,
                            actualStart: s.actualStart,
                            actualEnd: s.actualEnd,
                            actualMins: s.actualMins,
                            deltaMins: s.deltaMins,
                            freezeUsesPlannedTimes: !s.punched || !s.actualEnd,
                          })
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-accent/40 bg-white px-3 py-2.5 text-xs font-bold text-accent-dark shadow-sm transition-colors hover:bg-accent/5 dark:border-accent/50 dark:bg-neutral-900 dark:text-accent-light dark:hover:bg-accent/10"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        {t.ts_drawer_btn_freeze_with_pin}
                      </button>
                    )}

                    {/* ── Correggi orario uscita (quando OUT già esiste ma è sbagliato) ── */}
                    {s.punched && s.punchOutId && (
                      <div>
                        <p
                          className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wide ${s.isCrossDay ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-neutral-400'}`}
                        >
                          {s.isCrossDay ? t.ts_drawer_fix_exit_datetime : t.ts_drawer_exit_time_punched}
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={drawerEditOutDate}
                            onChange={(e) => setDrawerEditOutDate(e.target.value)}
                            className="w-[130px] rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-xs text-slate-900 outline-none focus:border-transparent focus:ring-2 focus:ring-accent dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100"
                          />
                          <TimeInputField
                            value={drawerEditOutTime}
                            onChange={setDrawerEditOutTime}
                            aria-label={t.ts_drawer_exit_time_punched}
                            className="flex-1 focus-within:ring-accent"
                          />
                          <button
                            type="button"
                            disabled={drawerEditOutSaving || (!drawerEditOutDate || !drawerEditOutTime)}
                            onClick={() => handleDrawerSaveOut(s.punchOutId!, drawerEditOutDate, drawerEditOutTime)}
                            className={`px-3 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-40 transition-colors flex-shrink-0 flex items-center gap-1 ${s.isCrossDay ? 'bg-red-500 hover:bg-red-600' : 'bg-accent hover:bg-accent-hover'}`}
                          >
                            {drawerEditOutSaving
                              ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              : <Check className="w-3.5 h-3.5" />}
                          {t.save}
                          </button>
                        </div>
                      </div>
                    )}

                    {canMarkAbsentTimesheet && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(t.shift_mark_absent_confirm)) return;
                          void (async () => {
                            try {
                              await updateShift(s.id, {
                                approval_status: 'absent',
                                approved_at: null as unknown as string,
                                approved_by: null as unknown as string,
                                approved_start_time: null as unknown as string,
                                approved_end_time: null as unknown as string,
                              });
                              showSuccess?.(t.shift_marked_absent_toast);
                              closeTimesheetShiftDrawer();
                            } catch {
                              showError?.(t.save_error);
                            }
                          })();
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-800 transition-colors hover:bg-rose-100 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/55"
                      >
                        <UserX className="h-4 w-4" />
                        {t.shift_mark_absent}
                      </button>
                    )}

                    {canClose && (
                      <button type="button"
                        onClick={() => {
                          setClockOutTime(s.plannedEnd);
                          setClosingShift({
                            shiftId: s.id,
                            punchInId: s.punchInId!,
                            dateStr: drawerData.dateStr,
                            plannedStart: s.plannedStart,
                            plannedEnd: s.plannedEnd,
                            plannedMins: s.plannedMins,
                            actualStart: s.actualStart ?? s.plannedStart,
                            employeeName: drawerData.employeeName,
                          });
                          closeTimesheetShiftDrawer();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors">
                        <LogOut className="w-4 h-4" />
                        {t.ts_btn_close_shift_insert_out}
                      </button>
                    )}
                    {!canClose && !canOpenFreezeModal && (
                      <p className="text-xs text-slate-400 dark:text-neutral-400 text-center py-1">
                        {!s.punched
                          ? t.ts_drawer_not_punched_yet
                          : drawerData.dateStr >= todayStr
                            ? t.ts_drawer_shift_not_elapsed
                            : t.ts_drawer_awaiting_completion}
                      </p>
                    )}
                  </div>
                )}
                {isApproved && (() => {
                  const fullShift = shifts.find((sh) => sh.id === s.id);
                  return (
                    <div className="border-t border-accent/20 bg-accent/5 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] dark:border-accent/30 dark:bg-accent/10">
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-accent-dark dark:text-accent-light">
                        <Lock className="h-4 w-4 flex-shrink-0" />
                        {t.ts_shift_approved_frozen}
                      </div>
                      {fullShift?.approved_by && (
                        <p className="pl-6 text-[11px] text-accent dark:text-accent-light/95">
                          da <strong>{fullShift.approved_by}</strong>
                          {fullShift.approved_at && (
                            <> · {format(new Date(fullShift.approved_at), 'dd/MM/yyyy HH:mm')}</>
                          )}
                        </p>
                      )}
                      <p className="mt-0.5 pl-6 text-[10px] text-accent/70 dark:text-accent-light/70">{t.ts_no_edits_allowed}</p>
                      {canTeamTimesheetOps && featureFlags['unlock_with_pin'] !== false && (
                        unlockModalShiftId === s.id ? (
                          <div className="mt-3">
                            <p className="text-[11px] text-slate-500 dark:text-neutral-300 mb-1.5 text-center">{t.ts_enter_manager_pin}</p>
                            <input
                              type="password"
                              inputMode="numeric"
                              maxLength={4}
                              autoFocus
                              value={unlockPin}
                              placeholder="••••"
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setUnlockPin(val);
                                setUnlockError('');
                                if (val.length === 4) handleUnlockShift(val);
                              }}
                              className={`w-full rounded-xl border px-3 py-2.5 text-center text-2xl font-bold tracking-[0.5em] transition-all focus:outline-none focus:ring-2 ${unlockError ? 'border-red-400 bg-red-50 text-red-600 ring-red-200 dark:bg-red-950/40 dark:text-red-300' : 'border-slate-300 bg-white text-slate-900 ring-accent/30 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100'}`}
                            />
                            {unlockError && <p className="text-[11px] text-red-500 text-center mt-1 font-semibold">{unlockError}</p>}
                            {unlocking && <p className="text-[11px] text-accent text-center mt-1">{t.ts_unlocking}</p>}
                            <button type="button" onClick={() => { setUnlockModalShiftId(null); setUnlockPin(''); setUnlockError(''); }}
                              className="mt-2 w-full text-[11px] text-slate-400 dark:text-neutral-400 hover:text-slate-600 transition-colors">
                              {t.cancel}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setUnlockModalShiftId(s.id); setUnlockPin(''); setUnlockError(''); }}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            {t.ts_btn_unlock_to_edit}
                          </button>
                        )
                      )}
                    </div>
                  );
                })()}
              </div>
          );
        })()}
      </CenteredModalPortal>

      {/* ── Modal chiusura manuale turno sera ────────────────────────── */}
      <AnimatePresence>
        {closingShift && (() => {
          const [h, m] = clockOutTime ? clockOutTime.split(':').map(Number) : [0, 0];
          const outTime = clockOutTime ? `${String(h ?? 0).padStart(2,'0')}:${String(m ?? 0).padStart(2,'0')}` : '';
          const shiftObj = shifts.find((s) => s.id === closingShift.shiftId);
          const userObj = shiftObj ? users.find((u) => u.id === shiftObj.user_id) : undefined;
          const previewMins = outTime && shiftObj && userObj
            ? getNetShiftMinutes(shiftObj, closingShift.actualStart, outTime, userObj, breakRules, breakComputeOpts)
            : 0;
          const previewDelta = previewMins - closingShift.plannedMins;
          const previewDeltaColor = previewDelta > 5 ? 'text-accent' : previewDelta < -5 ? 'text-red-500' : 'text-slate-500';

          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
              onClick={(e) => { if (e.target === e.currentTarget) { setClosingShift(null); setClockOutTime(''); } }}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="modal-glass-panel w-full max-w-sm rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                      <LogOut className="w-4 h-4 text-amber-500" />
                      {t.ts_modal_close_shift_title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-neutral-300 mt-0.5">
                      {closingShift.employeeName} · {safeFormatDate(closingShift.dateStr, 'd MMM', { locale })}
                    </p>
                  </div>
                  <button type="button" onClick={() => { setClosingShift(null); setClockOutTime(''); }}
                    className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
                    <X className="w-4 h-4 text-slate-500 dark:text-neutral-300" />
                  </button>
                </div>

                <div className="bg-slate-50 rounded-xl px-3 py-2.5 mb-4 flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-neutral-300">{t.ts_modal_entry_registered}</span>
                  <span className="font-bold text-slate-800">{closingShift.actualStart}</span>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{t.ts_label_exit_time}</label>
                  <TimeInputField
                    size="hero"
                    value={clockOutTime}
                    onChange={setClockOutTime}
                    aria-label={t.ts_label_exit_time}
                    className="w-full"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400 dark:text-neutral-400 mt-1 text-center">
                    {t.ts_label_planned}: {closingShift.plannedStart}–{closingShift.plannedEnd}
                  </p>
                </div>

                {clockOutTime && previewMins > 0 && (
                  <div className="bg-slate-50 rounded-xl p-3 mb-4">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-neutral-300 uppercase tracking-wide mb-2">{t.ts_modal_hours_preview}</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-neutral-400">{t.ts_kpi_planned}</p>
                        <p className="font-bold text-slate-700 text-sm">{fmtHM(closingShift.plannedMins)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-neutral-400">{t.ts_kpi_actual}</p>
                        <p className="font-bold text-slate-800 text-sm">{fmtHM(previewMins)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 dark:text-neutral-400">{t.ts_kpi_delta}</p>
                        <p className={`font-bold text-sm ${previewDeltaColor}`}>{previewDelta >= 0 ? '+' : ''}{fmtHM(previewDelta)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button type="button" onClick={() => { setClosingShift(null); setClockOutTime(''); }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                    {t.cancel}
                  </button>
                  <button type="button" disabled={!clockOutTime || closingLoading} onClick={handleConfirmClose}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
                    {closingLoading ? t.ts_saving : <><LogOut className="w-3.5 h-3.5" />{t.ts_btn_register_exit}</>}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Modal revisione giornata ─────────────────────────────────── */}
      <AnimatePresence>
        {dayReview && (() => {
          const item = dayReview.items[dayReview.currentIdx];
          const s = item.shift;
          const total = dayReview.items.length;
          const idx = dayReview.currentIdx;
          const isComplete = !!(dayReviewIn && dayReviewOut);
          const hasMissingOut = !s.actualEnd && !s.actualEndFull;
          const hasMissingIn = !s.punchInId;
          const deltaColor = s.deltaMins > 5 ? 'text-accent' : s.deltaMins < -5 ? 'text-red-500' : 'text-slate-500';
          const actualEndFullDate = s.actualEndFull ? new Date(s.actualEndFull) : null;
          const showDayReviewExitDate =
            s.isCrossDay ||
            (!!actualEndFullDate &&
              isValid(actualEndFullDate) &&
              format(actualEndFullDate, 'yyyy-MM-dd') !== dayReview.dateStr);
          const dayReviewDateParsed = parseISO(dayReview.dateStr);
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
              onClick={(e) => { if (e.target === e.currentTarget) setDayReview(null); }}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.15 }}
                className="modal-glass-panel w-full max-w-sm overflow-hidden rounded-2xl">

                {/* Header */}
                <div className="border-b border-slate-100 bg-slate-50/90 px-5 py-4 backdrop-blur-sm dark:border-white/10 dark:bg-neutral-900/60 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <Calendar className="w-4 h-4 text-accent" />
                      <h3 className="font-bold text-slate-900 text-base">
                        {t.ts_modal_day_review_title}{' '}
                        {isValid(dayReviewDateParsed)
                          ? format(dayReviewDateParsed, 'EEE d MMM', { locale })
                          : dayReview.dateStr}
                      </h3>
                    </div>
                    {/* Progress pills */}
                    <div className="flex items-center gap-1 mt-1.5 pl-6">
                      {dayReview.items.map((_, i) => (
                        <button key={i} type="button"
                          onClick={() => { setDayReview((p) => p ? { ...p, currentIdx: i } : null); initDayReviewFields(dayReview.items[i], dayReview.dateStr); }}
                          className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-accent' : 'w-2 bg-slate-200 hover:bg-slate-300'}`} />
                      ))}
                      <span className="ml-1 text-[10px] text-slate-400 dark:text-neutral-400 font-medium">{idx + 1}/{total}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setDayReview(null)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors ml-2 flex-shrink-0">
                    <X className="w-4 h-4 text-slate-500 dark:text-neutral-300" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                  {/* Dipendente */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent-dark font-bold text-sm flex-shrink-0">
                      {item.employeeName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{item.employeeName}</p>
                      {item.department && <p className="text-[11px] text-slate-400 dark:text-neutral-400">{item.department}</p>}
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-[10px] text-slate-400 dark:text-neutral-400 uppercase font-semibold">{t.ts_label_planned}</p>
                      <p className="text-sm font-bold text-slate-700 tabular-nums">{s.plannedStart}–{s.plannedEnd}</p>
                    </div>
                  </div>

                  {/* Avvisi */}
                  {hasMissingIn && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-600 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      {t.ts_warning_no_punch_in}
                    </div>
                  )}
                  {hasMissingOut && !hasMissingIn && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      {t.ts_warning_no_exit}
                    </div>
                  )}
                  {s.isCrossDay && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-600 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      {t.ts_warning_crossday_exit}
                    </div>
                  )}

                  {/* Campi IN / OUT */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-neutral-300 uppercase tracking-wide mb-1.5">
                        {t.ts_label_entry} {hasMissingIn && <span className="text-red-500">{t.ts_label_absent}</span>}
                      </label>
                      <TimeInputField
                        value={dayReviewIn}
                        onChange={setDayReviewIn}
                        disabled={hasMissingIn}
                        aria-label={t.ts_label_entry}
                        className="w-full border-slate-200 disabled:opacity-40 disabled:bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-neutral-300 uppercase tracking-wide mb-1.5">
                        {t.ts_label_exit}
                      </label>
                      <TimeInputField
                        value={dayReviewOut}
                        onChange={setDayReviewOut}
                        disabled={hasMissingIn}
                        aria-label={t.ts_label_exit}
                        className={`w-full font-bold text-sm focus-within:ring-accent disabled:opacity-40 ${
                          hasMissingOut && !hasMissingIn ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Data uscita (solo se cross-day o diversa dal turno) */}
                  {showDayReviewExitDate && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-neutral-300 uppercase tracking-wide mb-1.5">
                        {t.ts_label_exit_date}
                      </label>
                      <input type="date" value={dayReviewOutDate}
                        onChange={(e) => setDayReviewOutDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 text-sm focus:ring-2 focus:ring-accent outline-none"
                      />
                    </div>
                  )}

                  {/* Preview ore nette */}
                  {dayReviewIn && dayReviewOut && !hasMissingIn && (
                    <div className="bg-slate-50 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-neutral-300">{t.ts_net_hours}</span>
                      <span className={`font-bold tabular-nums ${deltaColor}`}>
                        {fmtHM(Math.max(0, calculateShiftMinutesGross(dayReviewIn, dayReviewOut) - s.breakMinutes))}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleDayReviewNavigate(-1)} disabled={idx === 0}
                      className="flex-shrink-0 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-30 transition-colors">
                      ←
                    </button>
                    <button type="button"
                      disabled={dayReviewSaving || hasMissingIn || !isComplete}
                      onClick={handleDayReviewSave}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {dayReviewSaving
                        ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {t.ts_saving}</>
                        : <><Check className="w-4 h-4" /> {idx < total - 1 ? t.ts_btn_save_and_next : t.ts_btn_save_and_close}</>
                      }
                    </button>
                    {idx < total - 1 && (
                      <button type="button" onClick={() => handleDayReviewNavigate(1)}
                        className="flex-shrink-0 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                        →
                      </button>
                    )}
                  </div>
                  <button type="button" onClick={() => handleDayReviewNavigate(1)}
                    className="text-[11px] text-slate-400 dark:text-neutral-400 hover:text-slate-600 text-center transition-colors py-0.5">
                    {idx < total - 1 ? t.ts_btn_skip : t.ts_btn_close_without_saving}
                  </button>
                </div>

              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Modal conferma approvazione ──────────────────────────────── */}
      <AnimatePresence>
        {approvalConfirm && (() => {
          const ac = approvalConfirm;
          const deltaColor = ac.deltaMins > 5 ? 'text-accent' : ac.deltaMins < -5 ? 'text-red-500' : 'text-slate-500';
          const hasAnomaly = ac.deltaMins < -10 || ac.freezeUsesPlannedTimes || !ac.actualEnd;
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
              onClick={(e) => { if (e.target === e.currentTarget) setApprovalConfirm(null); }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.15 }}
                className="modal-glass-panel w-full max-w-sm overflow-hidden rounded-2xl"
              >
                {/* Header */}
                <div className="border-b border-accent/15 bg-accent/8 px-5 py-4 backdrop-blur-sm dark:bg-accent/10 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <Lock className="w-4 h-4 text-accent flex-shrink-0" />
                      <h3 className="font-bold text-slate-900 text-base">{t.ts_modal_confirm_approval}</h3>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-neutral-300 pl-6">
                      {ac.employeeName} · {safeFormatDate(ac.dateStr, 'EEEE d MMMM', { locale })}
                    </p>
                  </div>
                  <button type="button" onClick={() => setApprovalConfirm(null)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors ml-2 flex-shrink-0">
                    <X className="w-4 h-4 text-slate-500 dark:text-neutral-300" />
                  </button>
                </div>

                {/* Dati da verificare */}
                <div className="p-5 space-y-3">
                  {/* Pianificato vs Effettivo */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-neutral-800/60">
                      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-neutral-400">{t.ts_label_planned}</p>
                      <p className="text-sm font-bold text-slate-700 tabular-nums dark:text-neutral-100">{ac.plannedStart} – {ac.plannedEnd}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-neutral-300">{fmtHM(ac.plannedMins)}</p>
                    </div>
                    <div
                      className={`rounded-xl p-3 ${
                        !ac.actualEnd
                          ? 'bg-red-50 dark:bg-red-950/35'
                          : ac.freezeUsesPlannedTimes
                            ? 'bg-amber-50 dark:bg-amber-950/30'
                            : 'bg-teal-50 dark:bg-teal-950/35'
                      }`}
                    >
                      <p className="text-[9px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-wide mb-1.5">{t.ts_label_punched}</p>
                      {ac.actualEnd ? (
                        <>
                          <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-neutral-100">
                            {ac.actualStart} – {ac.actualEnd}
                          </p>
                          <p className={`mt-0.5 text-[11px] font-semibold ${deltaColor}`}>
                            {fmtHM(ac.actualMins)} ({ac.deltaMins >= 0 ? '+' : ''}{fmtHM(ac.deltaMins)})
                          </p>
                          {ac.freezeUsesPlannedTimes && (
                            <p className="mt-1 text-[10px] font-medium text-amber-800 dark:text-amber-200/90">
                              {t.ts_freeze_planned_ref_hint}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm font-semibold text-red-500 dark:text-red-400">{t.ts_status_missing_out}</p>
                      )}
                    </div>
                  </div>

                  {/* Barra visiva delta */}
                  {ac.actualMins > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-neutral-700">
                        <div
                          className={`h-full rounded-full ${ac.deltaMins >= 0 ? 'bg-accent' : 'bg-red-400'}`}
                          style={{ width: `${Math.min(100, Math.max(4, (ac.actualMins / Math.max(ac.plannedMins, 1)) * 100))}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-bold tabular-nums ${deltaColor}`}>
                        {Math.round((ac.actualMins / Math.max(ac.plannedMins, 1)) * 100)}%
                      </span>
                    </div>
                  )}

                  {/* Avviso se anomalia */}
                  {hasAnomaly && (
                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 font-medium">
                        {!ac.actualEnd
                          ? t.ts_warning_no_exit_confirm
                          : ac.freezeUsesPlannedTimes
                            ? t.ts_freeze_planned_confirm
                            : t.ts_warning_anomaly}
                      </p>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-400 dark:text-neutral-400 text-center">
                    {t.ts_approval_freeze_notice}
                  </p>

                  <div className="space-y-1.5">
                    <label className="block text-center text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                      {t.ts_approval_pin_label}
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={approvalPin}
                      placeholder={t.ts_approval_pin_placeholder}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setApprovalPin(val);
                        setApprovalPinError('');
                      }}
                      className={`w-full rounded-xl border px-3 py-2.5 text-center text-xl font-bold tracking-[0.5em] focus:outline-none focus:ring-2 ${
                        approvalPinError
                          ? 'border-red-400 text-red-600 ring-red-200 dark:bg-neutral-900 dark:text-red-400'
                          : 'border-slate-200 text-slate-900 ring-accent/30 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100'
                      }`}
                    />
                    {approvalPinError ? (
                      <p className="text-center text-xs font-semibold text-red-500">{approvalPinError}</p>
                    ) : null}
                  </div>
                </div>

                {/* Azioni */}
                <div className="flex gap-2 px-5 pb-5">
                  <button type="button" onClick={() => setApprovalConfirm(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={approvingShiftId === ac.shiftId || approvalPin.length < 4}
                    onClick={async () => {
                      const verifier = findFreezeVerifierByPin(users, approvalPin);
                      if (!verifier) {
                        setApprovalPinError(t.ts_approval_pin_invalid);
                        setApprovalPin('');
                        return;
                      }
                      setApprovalConfirm(null);
                      await handleApproveShift(ac.shiftId, verifier);
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {approvingShiftId === ac.shiftId
                      ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {t.ts_approving}</>
                      : <><Lock className="w-4 h-4" /> {t.ts_btn_yes_approve_freeze}</>
                    }
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </>
  );
}
