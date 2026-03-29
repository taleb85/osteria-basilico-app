import { useState, useMemo, useEffect, useCallback, useRef, type CSSProperties } from 'react';
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
  ChevronRight, ChevronLeft, Check, AlertTriangle, X,
  Clock, History, FileEdit, ShieldAlert, LogOut, Lock, Unlock,
  Users, UserCheck, AlertCircle, ArrowRight, Calendar, Moon,
  ChevronDown, FileDown, UserX, Trash2, Pencil, Filter,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getTranslations, getDateLocale, formatTrans } from '../utils/translations';
import {
  calculateShiftMinutesGross,
  formatMinutesToHoursAndMinutes,
  hasShiftConflictSameDay,
  normalizeTimeInputToHHmm,
} from '../utils/timeCalculations';
import {
  getBreakMinutesForShift,
  getNetShiftMinutes,
  type BreakMinutesComputeOptions,
  type BreakRule,
} from '../utils/breakRules';
import {
  isPurelyManagementRole,
  isManagementRole,
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
  weekIndexForDateInPeriod,
  type PeriodConfig,
} from '../utils/periodConfig';
import { saveTimesheetPeriodToSupabase } from '../utils/timesheetPeriodSupabase';
import type { PunchAuditEntry, PunchRecord, PunchRecordSource, Shift, User } from '../types';
import { getResolvedStartEndForHours, shiftPastPlannedEndWithoutClockIn } from '../utils/shiftResolvedClockTimes';
import { HorizontalScrollArea } from './HorizontalScrollArea';
import DatePickerField from './DatePickerField';
import TimesheetManagementKpiBlock from './TimesheetManagementKpiBlock';
import { CenteredModalPortal } from './ui/CenteredModalPortal';
import { getPayrollPaymentDateForCalendarMonth } from '../utils/payrollSchedule';
import { exportAttendancePdfFromGrid } from '../utils/timesheetPdfFromRange';
import { isShiftPayrollFrozen } from '../utils/timesheetFreezeCriteria';
import { getDeptColor, getDepartments, BUILTIN_DEPARTMENTS } from '../utils/departments';
import { translateDepartmentValue } from '../utils/departmentLabels';
import { getTimesheetGridPrivacyMode } from '../utils/timesheetGridPrivacy';
import { PinPadModal } from './ui/PinPadModal';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Pill reparto: sfondo colore reparto, testo bianco (scurisce il rgb se troppo chiaro per il contrasto). */
function departmentChipStyle(hex: string): CSSProperties {
  const raw = hex.replace('#', '').trim();
  const six = raw.length === 6 && /^[0-9a-fA-F]{6}$/.test(raw) ? raw : '2D5A27';
  let r = parseInt(six.slice(0, 2), 16);
  let g = parseInt(six.slice(2, 4), 16);
  let b = parseInt(six.slice(4, 6), 16);
  const lin = (x: number) => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const relLum = () => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  for (let i = 0; i < 10 && relLum() > 0.48; i++) {
    r = Math.max(0, Math.floor(r * 0.82));
    g = Math.max(0, Math.floor(g * 0.82));
    b = Math.max(0, Math.floor(b * 0.82));
  }
  return {
    backgroundColor: `rgb(${r},${g},${b})`,
    borderColor: 'rgba(255,255,255,0.25)',
    color: '#ffffff',
  };
}

function toMinutesFromMidnight(hhmm: string): number {
  const [h, m] = (hhmm || '00:00').slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Uscita sul calendario del giorno dopo il turno, entro 24h dall’ingresso: chiusura notturna (es. 18:00 → 00:00),
 * non errore "data errata".
 */
function isTimesheetNightRolloverOk(
  shiftDateStr: string,
  actualEndISO: string,
  punchIn: { calculated_time?: string; timestamp: string } | undefined,
  isLunchSlot: boolean,
  punchActualStart: string | null
): boolean {
  if (!punchIn) return false;
  const outD = new Date(actualEndISO);
  if (!isValid(outD)) return false;
  const shiftD = parseISO(shiftDateStr);
  if (!isValid(shiftD)) return false;
  const actualEndDate = format(outD, 'yyyy-MM-dd');
  const nextShiftDay = format(addDays(shiftD, 1), 'yyyy-MM-dd');
  if (actualEndDate !== nextShiftDay) return false;
  const inMs = new Date(punchIn.calculated_time || punchIn.timestamp).getTime();
  const outMs = outD.getTime();
  const elapsed = outMs - inMs;
  if (elapsed <= 0 || elapsed > 24 * 60 * 60 * 1000) return false;
  if (isLunchSlot) {
    const eveningIn =
      !!punchActualStart && toMinutesFromMidnight(punchActualStart) >= 14 * 60;
    if (!eveningIn) return false;
  }
  return true;
}

/**
 * Se data uscita = giorno turno ma l’ora è prima dell’ingresso (es. IN 18:00, OUT 00:00), assume giorno successivo.
 */
function resolveTimesheetPunchOutDateStr(
  shiftDateStr: string,
  manualOutDateStr: string | undefined,
  inHHMM: string,
  outHHMM: string
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDateStr)) return null;
  const trimmedManual = (manualOutDateStr || '').trim();
  const base =
    trimmedManual && /^\d{4}-\d{2}-\d{2}$/.test(trimmedManual) ? trimmedManual : shiftDateStr;
  const inSlice = (inHHMM || '').trim().slice(0, 5);
  const outSlice = (outHHMM || '').trim().slice(0, 5);
  const inNorm = normalizeTimeInputToHHmm(inSlice) || inSlice;
  const outNorm = normalizeTimeInputToHHmm(outSlice) || outSlice;
  if (!/^\d{1,2}:\d{2}$/.test(inNorm) || !/^\d{1,2}:\d{2}$/.test(outNorm)) return base;
  const pad2 = (hm: string) => {
    const [h, m] = hm.split(':').map((x) => parseInt(String(x), 10) || 0);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const inP = pad2(inNorm);
  const outP = pad2(outNorm);
  const inM = toMinutesFromMidnight(inP);
  const outM = toMinutesFromMidnight(outP);
  if (base === shiftDateStr && outM < inM) {
    return format(addDays(parseISO(shiftDateStr), 1), 'yyyy-MM-dd');
  }
  return base;
}

/** Dati per il popup congelo dopo salvataggio timbrature in coda revisione giornata/settimana. */
function buildReviewQueueFreezeApprovalPayload(args: {
  shiftId: string;
  employeeName: string;
  shiftDateStr: string;
  plannedStart: string;
  plannedEnd: string;
  plannedMins: number;
  fullShift: Shift;
  user: User;
  breakRules: BreakRule[];
  breakComputeOpts: BreakMinutesComputeOptions;
  inHm: string;
  outHm: string;
  resolvedOutDate: string;
}): {
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
  freezeUsesPlannedTimes: boolean;
  afterFreeze: 'advance_review';
} {
  const inNorm = normalizeTimeInputToHHmm(args.inHm.trim()) || args.inHm.trim().slice(0, 5);
  const outNorm = normalizeTimeInputToHHmm(args.outHm.trim()) || args.outHm.trim().slice(0, 5);
  const pad2 = (hm: string) => {
    const [h, m] = hm.split(':').map((x) => parseInt(String(x), 10) || 0);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const inP = pad2(inNorm);
  const outP = pad2(outNorm);
  const actualMins = getNetShiftMinutes(
    args.fullShift,
    inP,
    outP,
    args.user,
    args.breakRules,
    args.breakComputeOpts
  );
  const deltaMins = actualMins - args.plannedMins;
  return {
    shiftId: args.shiftId,
    employeeName: args.employeeName,
    dateStr: args.shiftDateStr,
    plannedStart: args.plannedStart,
    plannedEnd: args.plannedEnd,
    plannedMins: args.plannedMins,
    actualStart: inP,
    actualEnd: outP,
    actualMins,
    deltaMins,
    freezeUsesPlannedTimes: false,
    afterFreeze: 'advance_review',
  };
}

function fmtHM(mins: number): string {
  if (mins === 0) return '0h';
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  const sign = mins < 0 ? '−' : '';
  return m > 0 ? `${sign}${h}h${m.toString().padStart(2, '0')}` : `${sign}${h}h`;
}

/** Durata pausa detratta in forma leggibile (es. 30 → "30m", 90 → "1h30m"). */
function fmtBreakDeductionShort(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
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
  /** Detrazione pausa sul pianificato (regole / fallback sul turno pianificato). */
  breakMinutes: number;
  /** Detrazione pausa sulle ore effettive (timbratura / congelato); 0 se effettivo incompleto. */
  breakMinutesActual: number;
  actualStart: string | null;
  actualEnd: string | null;
  actualEndFull?: string;
  actualMins: number;
  deltaMins: number;
  /** In griglia l’effettivo deriva da orari congelati (approved_start/end), non da timbrature grezze. */
  displayFromFrozenApprovedTimes?: boolean;
  status: 'approved' | 'confirmed' | 'draft' | 'absent';
  punched: boolean;
  punchInId?: string;
  punchOutId?: string;
  punchInSource?: PunchRecordSource | null;
  punchOutSource?: PunchRecordSource | null;
  isLate: boolean;
  hasMissingOut: boolean;
  isCrossDay?: boolean;
  /** Uscita legittima il giorno dopo (mezzanotte / notte), solo informativo in UI. */
  nightRolloverOk?: boolean;
  approved_by?: string;
  approved_at?: string;
}

/** Pranzo / mattina &lt; 16:00 in alto; cena (inizio pianificato ≥ 16:00) in basso nella cella. */
function partitionShiftsByPlannedHour16(shifts: ShiftRow[]): { before16: ShiftRow[]; from16: ShiftRow[] } {
  const before16: ShiftRow[] = [];
  const from16: ShiftRow[] = [];
  for (const s of shifts) {
    const hour = parseInt((s.plannedStart || '00:00').split(':')[0], 10) || 0;
    if (hour >= 16) from16.push(s);
    else before16.push(s);
  }
  return { before16, from16 };
}

interface DayData {
  dateStr: string;
  shifts: ShiftRow[];
  totalPlannedMins: number;
  totalActualMins: number;
  totalDeltaMins: number;
  /** Somma ore nette da turni con orario ufficiale congelato (solo per totali in modalità solo pianificato). */
  totalFrozenOfficialMins: number;
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

/** Coda «revisione giornata» / settimana per dipendente: stesso modal, navigazione 1/N e salva/prossimo. */
type DrawerReviewQueueItem = {
  userId: string;
  employeeName: string;
  department?: string;
  shift: ShiftRow;
  /** Giorno di calendario del turno (yyyy-MM-dd). */
  dateStr: string;
};
type DrawerReviewQueue = {
  dateStr: string;
  items: DrawerReviewQueueItem[];
  currentIdx: number;
  reviewScope?: 'day' | 'employee_week';
};

function shiftRowPayrollFrozen(s: ShiftRow): boolean {
  return isShiftPayrollFrozen({
    approval_status: s.status,
    approved_at: s.approved_at ?? null,
  });
}

/** Stessi criteri di `handleOpenDayReview` (header «revisiona» e modal). */
function shiftEligibleForDayReview(s: ShiftRow): boolean {
  if (s.status === 'absent') return false;
  return s.status !== 'approved' && !shiftRowPayrollFrozen(s);
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

  const canTeamTimesheetOps = currentUser ? canOperateTeamSchedule(currentUser) : false;
  const canTimesheetApprove = currentUser ? canApproveShiftActions(currentUser) : false;
  const timesheetGridPrivacyMode = getTimesheetGridPrivacyMode(currentUser);
  const showFullTimesheetGrid = timesheetGridPrivacyMode === 'full';
  const plannedOnlyTimesheetGrid = timesheetGridPrivacyMode === 'planned_only';
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

  type ViewMode = 'day' | 'week' | 'month';
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [dayOffset, setDayOffset] = useState(() => {
    const today = new Date();
    const config = loadPeriodConfig();
    const start = getPeriodStartDate(config);
    const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  });

  // Quando la scheda diventa attiva, riporta la visualizzazione al giorno corrente
  useEffect(() => {
    const today = new Date();
    const start = getPeriodStartDate(periodConfig);
    const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (dayOffset !== diff) {
      setDayOffset(diff);
    }
    const currentWeekIdx = weekIndexForDateInPeriod(periodConfig);
    if (weekIndex !== currentWeekIdx) {
      setWeekIndex(currentWeekIdx);
    }
  }, [periodConfig]);
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
  const [approvingShiftId, setApprovingShiftId] = useState<string | null>(null);
  const [punchAudits, setPunchAudits] = useState<Record<string, PunchAuditEntry[]>>({});
  const [closingShift, setClosingShift] = useState<ClosingShiftState | null>(null);
  const [clockOutTime, setClockOutTime] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);
  const [drawerData, setDrawerData] = useState<DrawerData | null>(null);

  // PDF Export Department Filter
  const [pdfDeptFilter, setPdfDeptFilter] = useState<string>('all');
  const [showPdfDeptMenu, setShowPdfDeptMenu] = useState(false);
  const pdfDeptMenuRef = useRef<HTMLDivElement | null>(null);

  const availableDepts = useMemo(() => {
    const builtin = BUILTIN_DEPARTMENTS;
    const custom = getDepartments().filter(d => !builtin.some(b => b.value === d.value));
    return [...builtin, ...custom];
  }, []);

  useEffect(() => {
    if (!showPdfDeptMenu) return;
    const onClick = (e: MouseEvent) => {
      if (pdfDeptMenuRef.current && !pdfDeptMenuRef.current.contains(e.target as Node)) {
        setShowPdfDeptMenu(false);
      }
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [showPdfDeptMenu]);
  type TimbraturePinGateMode =
    | 'unlock_frozen'
    | 'enable_timbrature'
    | 'unlock_shift_edits'
    | 'delete_punches'
    | 'enable_planned_times_edit';
  const [pinGateModal, setPinGateModal] = useState<{
    shiftId: string;
    mode: TimbraturePinGateMode;
  } | null>(null);
  const [pinGatePin, setPinGatePin] = useState('');
  const [pinGateError, setPinGateError] = useState('');
  const [pinGateUnlocking, setPinGateUnlocking] = useState(false);
  const [timbratureEditUnlockedShiftId, setTimbratureEditUnlockedShiftId] = useState<string | null>(null);
  const [shiftEditsUnlockedShiftId, setShiftEditsUnlockedShiftId] = useState<string | null>(null);
  const pinGateKeyboardInputRef = useRef<HTMLInputElement | null>(null);
  /** Evita doppio submit (React Strict Mode) e permette di reinserire lo stesso PIN dopo errore. */
  const pinGateAutoSubmittedFor = useRef('');
  const [drawerReviewQueue, setDrawerReviewQueue] = useState<DrawerReviewQueue | null>(null);
  const drawerReviewQueueRef = useRef(drawerReviewQueue);
  drawerReviewQueueRef.current = drawerReviewQueue;
  const [reviewQueueSaving, setReviewQueueSaving] = useState(false);
  const timesheetShiftDetailPanelRef = useRef<HTMLDivElement | null>(null);

  const [manualPunchIn, setManualPunchIn] = useState('');
  const [manualPunchOut, setManualPunchOut] = useState('');
  const [manualPunchOutDate, setManualPunchOutDate] = useState('');
  const [manualPunchSaving, setManualPunchSaving] = useState(false);
  /** Form IN/OUT sotto il riepilogo: dopo «Registra timbrature» si richiude; tap su riepilogo lo riapre. */
  const [drawerManualPunchFormExpanded, setDrawerManualPunchFormExpanded] = useState(true);
  const manualPunchInHourRef = useRef<HTMLInputElement | null>(null);
  const manualPunchOutHourRef = useRef<HTMLInputElement | null>(null);

  /** Click/tap sulla card orario → stesso effetto di un click diretto sul campo ore (un solo gesto). */
  const focusManualPunchHourFromSummary = useCallback((which: 'in' | 'out') => {
    const pick = () => (which === 'in' ? manualPunchInHourRef.current : manualPunchOutHourRef.current);
    const apply = () => {
      const el = pick();
      if (!el) return false;
      el.focus({ preventScroll: true });
      queueMicrotask(() => el.select());
      return true;
    };
    if (apply()) return;
    requestAnimationFrame(() => {
      if (apply()) return;
      requestAnimationFrame(apply);
    });
  }, []);
  const [markAbsentSaving, setMarkAbsentSaving] = useState(false);
  const [drawerShiftEditsExpanded, setDrawerShiftEditsExpanded] = useState(false);
  const [deductBreakSaving, setDeductBreakSaving] = useState(false);
  const [plannedTimesEditUnlockedShiftId, setPlannedTimesEditUnlockedShiftId] = useState<string | null>(null);
  const [drawerPlannedTimeStart, setDrawerPlannedTimeStart] = useState('');
  const [drawerPlannedTimeEnd, setDrawerPlannedTimeEnd] = useState('');
  const [plannedTimesSaving, setPlannedTimesSaving] = useState(false);

  const closeTimesheetShiftDrawer = useCallback(() => {
    setDrawerData(null);
    setDrawerReviewQueue(null);
    setMarkAbsentSaving(false);
    setPinGateModal(null);
    setPinGatePin('');
    setPinGateError('');
    setTimbratureEditUnlockedShiftId(null);
    setShiftEditsUnlockedShiftId(null);
    setPlannedTimesEditUnlockedShiftId(null);
    setDrawerShiftEditsExpanded(false);
    setDrawerManualPunchFormExpanded(true);
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
    /** Dopo congelamento con PIN: avanza la coda revisione invece di chiudere solo il pannello. */
    afterFreeze?: 'advance_review';
  } | null>(null);
  const [approvalPin, setApprovalPin] = useState('');
  const [approvalPinError, setApprovalPinError] = useState('');
  /** Dopo l’ultimo salvataggio in revisione settimana dipendente: congela tutti i turni della coda con un solo PIN. */
  const [employeeWeekFreezeBatch, setEmployeeWeekFreezeBatch] = useState<{
    shiftIds: string[];
    employeeName: string;
    previewRows: { dateStr: string; planned: string }[];
  } | null>(null);
  const [employeeWeekFreezeBusy, setEmployeeWeekFreezeBusy] = useState(false);

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
    viewMode === 'day'
      ? [addDays(periodStartDate, dayOffset)]
      : viewMode === 'week'
        ? allPeriodDays.slice(weekIndex * 7, weekIndex * 7 + 7)
        : calendarPaddedDays;
  const weekStart = weekDays[0] ?? periodStartDate;
  const lastDay = weekDays[weekDays.length - 1] ?? periodEndDate;
  const weekStr = format(weekStart, 'yyyy-MM-dd');
  const weekEnd = format(addDays(lastDay, 1), 'yyyy-MM-dd');
  const todayStr = format(now, 'yyyy-MM-dd');

  const maxDayOffset = allPeriodDays.length - 1;

  const timesheetMainGridWeekNav = useMemo(
    () =>
      viewMode === 'day'
        ? {
            canPrev: dayOffset > 0,
            canNext: dayOffset < maxDayOffset,
            onPrev: () => setDayOffset((d) => Math.max(0, d - 1)),
            onNext: () => setDayOffset((d) => Math.min(maxDayOffset, d + 1)),
          }
        : viewMode === 'week'
          ? {
              canPrev: weekIndex > 0,
              canNext: weekIndex < maxWeekIndex,
              onPrev: () => setWeekIndex((i) => Math.max(0, i - 1)),
              onNext: () => setWeekIndex((i) => Math.min(maxWeekIndex, i + 1)),
            }
          : undefined,
    [viewMode, weekIndex, maxWeekIndex]
  );

  /** Griglia presenze: larghezze fisse (px) — nome | ogni giorno | colonna totale. */
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const timesheetGridDayColPx = viewMode === 'month' ? (isMobile ? 110 : 76) : 120;
  const timesheetGridNameColPx = 80;
  const timesheetGridTotalColPx = 60;
  const timesheetGridMinWidthPx =
    timesheetGridNameColPx + weekDays.length * timesheetGridDayColPx + timesheetGridTotalColPx;

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


  useEffect(() => {
    setWeekIndex((i) => Math.min(i, maxWeekIndex));
  }, [maxWeekIndex]);

  useEffect(() => {
    if (approvalConfirm || employeeWeekFreezeBatch) {
      setApprovalPin('');
      setApprovalPinError('');
    }
  }, [approvalConfirm, employeeWeekFreezeBatch]);

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
    // Se l'utente corrente NON è gestionale, vede solo sé stesso
    if (currentUser && !isManagementRole(currentUser.role)) {
      return users.filter((u) => u.id === currentUser.id);
    } else {
      // Utente gestionale: vede tutti gli utenti operativi
      let list = users.filter((u) => {
        // Solo attivi e visibili in planning
        if (u.status !== 'active' || !isUserVisibleOnTeamSchedule(u, shifts)) return false;
        
      // Filtro reparto (se attivo)
      if (pdfDeptFilter !== 'all') {
        const d = (u.department || '').toLowerCase();
        const filterLc = pdfDeptFilter.toLowerCase();
        
        // Se il filtro è "sala_bar", includi utenti con reparto "sala_bar", "sala" o "bar"
        if (filterLc === 'sala_bar') {
          return d === 'sala_bar' || d === 'sala' || d === 'bar';
        }
        
        return d === filterLc;
      }

        return true;
      });

      // Applica lo stesso ordinamento della scheda Turni (WeeklyShiftsTable)
      list = [...list].sort((a, b) => {
        // Priorità reparto: Sala e Bar, poi Sala, poi Bar, poi Cucina, poi altri
        const getDeptPriority = (u: any) => {
          const d = (u.department || '').toLowerCase();
          if (d === 'sala_bar') return 1;
          if (d === 'sala') return 2;
          if (d === 'bar') return 3;
          if (d === 'kitchen' || d === 'cucina') return 4;
          return 5;
        };
        const pa = getDeptPriority(a);
        const pb = getDeptPriority(b);
        if (pa !== pb) return pa - pb;

        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
      return list;
    }
  }, [users, shifts, currentUser, pdfDeptFilter]);

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
              breakMinutesActual: 0,
              actualStart: null,
              actualEnd: null,
              actualEndFull: undefined,
              actualMins: 0,
              deltaMins: -plannedMins,
              displayFromFrozenApprovedTimes: false,
              status: 'absent' as const,
              punched: false,
              isLate: false,
              hasMissingOut: false,
              isCrossDay: false,
              nightRolloverOk: false,
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

          const nextCalendarDayStr = format(addDays(parseISO(dateStr), 1), 'yyyy-MM-dd');
          const punchOut = punchRecords.find((p) => {
            if (p.type !== 'out') return false;
            if (s.id && p.shift_id) return p.shift_id === s.id;
            if (p.user_id !== user.id) return false;
            const pDate = new Date(p.timestamp);
            if (!isValid(pDate)) return false;
            const pDateStr = format(pDate, 'yyyy-MM-dd');
            if (pDateStr === dateStr) {
              return isLunch ? pDate.getHours() < 16 : pDate.getHours() >= 16;
            }
            if (
              !isLunch &&
              punchIn &&
              pDateStr === nextCalendarDayStr &&
              pDate.getTime() > new Date(punchIn.calculated_time || punchIn.timestamp).getTime() &&
              pDate.getTime() - new Date(punchIn.calculated_time || punchIn.timestamp).getTime() <=
                24 * 60 * 60 * 1000
            ) {
              return true;
            }
            return false;
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
          const nightRolloverOk =
            !frozen &&
            !!actualEndFull &&
            isTimesheetNightRolloverOk(
              dateStr,
              actualEndFull,
              punchIn,
              isLunch,
              punchActualStart
            );
          const isCrossDay =
            !frozen && !!actualEndFull && actualEndDate !== dateStr && !nightRolloverOk;
          /** Pausa sulle ore effettive: regole / fallback usano timbratura (o orari congelati), non il pianificato. */
          const actualMins =
            displayActualStart && displayActualEnd
              ? getNetShiftMinutes(
                  s,
                  displayActualStart,
                  displayActualEnd,
                  user,
                  breakRules,
                  breakComputeOpts
                )
              : Math.max(0, grossActualMins);
          const breakMinutesActual =
            displayActualStart && displayActualEnd
              ? Math.max(
                  0,
                  calculateShiftMinutesGross(displayActualStart, displayActualEnd) - actualMins
                )
              : 0;
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
            breakMinutesActual,
            actualStart: displayActualStart,
            actualEnd: displayActualEnd,
            actualEndFull: actualEndFullForRow,
            actualMins,
            deltaMins,
            displayFromFrozenApprovedTimes: frozen,
            status: s.approval_status,
            punched: !!punchIn,
            punchInId: punchIn?.id,
            punchOutId: punchOut?.id,
            punchInSource: punchIn?.source ?? null,
            punchOutSource: punchOut?.source ?? null,
            isLate,
            hasMissingOut,
            isCrossDay,
            nightRolloverOk,
            approved_by: s.approved_by ?? undefined,
            approved_at: s.approved_at ?? undefined,
          };
        });

        const totalPlannedMins = shiftRows.reduce((a, r) => a + r.plannedMins, 0);
        const totalActualMins = shiftRows.reduce((a, r) => a + r.actualMins, 0);
        const totalDeltaMins = totalActualMins - totalPlannedMins;
        const totalFrozenOfficialMins = shiftRows.reduce(
          (a, r) => a + (r.displayFromFrozenApprovedTimes ? r.actualMins : 0),
          0
        );

        data[user.id][dateStr] = {
          dateStr,
          shifts: shiftRows,
          totalPlannedMins,
          totalActualMins,
          totalDeltaMins,
          totalFrozenOfficialMins,
        };
      }
    }
    return data;
  }, [visibleUsers, weekDays, weekShifts, punchRecords, breakRules, breakComputeOpts]);

  const userTotals = useMemo(() => {
    const totals: Record<
      string,
      { plannedMins: number; actualMins: number; deltaMins: number; frozenOfficialMins: number }
    > = {};
    for (const user of visibleUsers) {
      let planned = 0,
        actual = 0,
        frozenOfficial = 0;
      for (const day of weekDays) {
        const dayData = timesheetData[user.id]?.[format(day, 'yyyy-MM-dd')];
        if (dayData) {
          planned += dayData.totalPlannedMins;
          actual += dayData.totalActualMins;
          frozenOfficial += dayData.totalFrozenOfficialMins;
        }
      }
      totals[user.id] = {
        plannedMins: planned,
        actualMins: actual,
        deltaMins: actual - planned,
        frozenOfficialMins: frozenOfficial,
      };
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
        fresh.plannedMins === p.plannedMins &&
        fresh.plannedStart === p.plannedStart &&
        fresh.plannedEnd === p.plannedEnd &&
        fresh.breakMinutes === p.breakMinutes &&
        fresh.breakMinutesActual === p.breakMinutesActual &&
        fresh.deltaMins === p.deltaMins &&
        fresh.hasMissingOut === p.hasMissingOut &&
        fresh.isCrossDay === p.isCrossDay &&
        fresh.nightRolloverOk === p.nightRolloverOk
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

  const handleExportTimesheetPdf = useCallback((mode: 'WEEK' | 'PERIOD' = 'WEEK') => {
    if (!currentUser || !isFeatureEnabled(currentUser, 'export_pdf')) return;
    try {
      const daysToExport = mode === 'WEEK' ? weekDays : allPeriodDays;
      
      const result = exportAttendancePdfFromGrid({
        weekDays: daysToExport,
        visibleUsers,
        shifts,
        punchRecords,
        breakRules,
        breakComputeOpts,
        locale,
        t: t as Record<string, string>,
        formatTrans,
        fmtHM,
        onlyConfirmedOrApproved: true, // FILTRO RIGOROSO: Solo turni congelati/approvati
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
    allPeriodDays,
    shifts,
    punchRecords,
    breakRules,
    breakComputeOpts,
    locale,
    t,
    formatTrans,
    fmtHM,
    showSuccess,
    showError,
  ]);

  // ── Indicatori Presenze: settimana visualizzata (in turno = solo se oggi è in quella settimana) ──
  const weekViewStats = useMemo(() => {
    const visibleUserIds = new Set(visibleUsers.map((u) => u.id));
    const todayInViewedWeek = todayStr >= weekStr && todayStr < weekEnd;
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    let inTurno = 0,
      ritardi = 0,
      senzaTimbratura = 0,
      approvati = 0;

    for (const day of weekDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const isFutureDay = dateStr > todayStr;
      const dayShifts = weekShifts.filter((s) => s.date === dateStr && visibleUserIds.has(s.user_id));

      for (const s of dayShifts) {
        if (s.approval_status === 'absent') continue;

        if (s.approval_status === 'approved') approvati++;

        if (todayInViewedWeek && dateStr === todayStr) {
          const startMins = toMinutesFromMidnight((s.start_time || '').slice(0, 5));
          const endMins = toMinutesFromMidnight((s.end_time || '00:00').slice(0, 5));
          if (nowMins >= startMins - 30 && nowMins <= endMins) inTurno++;
        }

        if (isFutureDay) continue;

        const startMins = toMinutesFromMidnight((s.start_time || '').slice(0, 5));
        const punchIn = findPunchInForShiftOnDate(s, s.user_id, dateStr, punchRecords);
        if (!punchIn) senzaTimbratura++;
        else {
          const actualStartHHMM = punchTimeHHMM(punchIn.calculated_time || punchIn.timestamp);
          if (actualStartHHMM && toMinutesFromMidnight(actualStartHHMM) > startMins + 5) ritardi++;
        }
      }
    }
    return { inTurno, ritardi, senzaTimbratura, approvati };
  }, [weekShifts, weekDays, punchRecords, visibleUsers, todayStr, weekStr, weekEnd]);

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

  const scrollToTimesheetAnchor = useCallback((elementId: string) => {
    requestAnimationFrame(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  /** Card riepilogo settimana visualizzata: tutte portano alla griglia presenze principale. */
  const handleStatCardClick = useCallback(() => {
    if (!currentUser) return;
    scrollToTimesheetAnchor('timesheet-section-main-grid');
  }, [currentUser, scrollToTimesheetAnchor]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleApproveShift = async (
    shiftId: string,
    actorOverride?: import('../types').User,
    opts?: { afterSuccess?: 'close_drawer' | 'advance_review'; silentToast?: boolean }
  ) => {
    setApprovingShiftId(shiftId);
    try {
      const raw = shifts.find((s) => s.id === shiftId);
      await approveShift(shiftId, {
        actorOverride,
        promoteFromDraft: raw?.approval_status === 'draft',
      });
      if (!opts?.silentToast) showSuccess?.(t.ts_toast_shift_approved);
      if (opts?.afterSuccess === 'advance_review') {
        advanceDrawerReviewAfterStep();
      } else {
        setDrawerData(null);
        setDrawerReviewQueue(null);
      }
    } catch {
      showError?.(t.ts_toast_approve_freeze_error);
    } finally {
      setApprovingShiftId(null);
    }
  };

  const applyPayrollUnlock = useCallback(
    async (shiftId: string, verifier: User) => {
      const actorName = `${verifier.first_name} ${verifier.last_name ?? ''}`.trim();
      const full = shifts.find((sh) => sh.id === shiftId);
      const restoreAbsent = full?.approval_status === 'absent' && !!full?.approved_at;
      const nextStatus = restoreAbsent ? 'absent' : 'confirmed';
      await updateShift(shiftId, {
        approval_status: nextStatus,
        approved_at: null as unknown as string,
        approved_by: null as unknown as string,
        approved_start_time: null as unknown as string,
        approved_end_time: null as unknown as string,
      });
      const punchIn = punchRecords.find((p) => p.type === 'in' && p.shift_id === shiftId);
      if (punchIn) {
        try {
          await database.punchAuditLog.insert({
            punch_record_id: punchIn.id,
            actor_id: verifier.id,
            actor_name: actorName,
            field: 'sblocco_turno',
            old_value: 'approved',
            new_value: nextStatus,
          });
        } catch {
          /* non bloccante */
        }
      }
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
    },
    [shifts, punchRecords, updateShift]
  );

  const submitTimbraturePinGate = useCallback(
    async (pin: string) => {
      if (!pinGateModal) return;
      const verifier = findFreezeVerifierByPin(users, pin);
      if (!verifier) {
        setPinGateError(t.wst_freeze_pin_invalid);
        setPinGatePin('');
        return;
      }
      if (currentUser.role === 'capo') {
        const shift = shifts.find(s => s.id === pinGateModal.shiftId);
        const user = users.find(u => u.id === shift?.user_id);
        if (user?.department !== currentUser.department) {
          setPinGateError(t.wst_freeze_pin_invalid); // O un errore più specifico se disponibile
          setPinGatePin('');
          return;
        }
      }
      setPinGateUnlocking(true);
      try {
        if (pinGateModal.mode === 'delete_punches') {
          await deletePunchRecordsForShift(pinGateModal.shiftId);
          showSuccess?.(t.ts_toast_punches_deleted);
          setPinGateModal(null);
          setPinGatePin('');
          setPinGateError('');
          closeTimesheetShiftDrawer();
          return;
        }
        if (pinGateModal.mode === 'unlock_frozen') {
          await applyPayrollUnlock(pinGateModal.shiftId, verifier);
          showSuccess?.(t.ts_toast_shift_unlocked);
        }
        if (pinGateModal.mode === 'unlock_shift_edits') {
          setShiftEditsUnlockedShiftId(pinGateModal.shiftId);
          setDrawerShiftEditsExpanded(true);
        }
        if (pinGateModal.mode === 'enable_planned_times_edit') {
          const full = shifts.find((sh) => sh.id === pinGateModal.shiftId);
          if (full) {
            setDrawerPlannedTimeStart((full.start_time || '').slice(0, 5));
            setDrawerPlannedTimeEnd((full.end_time || '').slice(0, 5));
          }
          setPlannedTimesEditUnlockedShiftId(pinGateModal.shiftId);
        }
        if (pinGateModal.mode === 'enable_timbrature' || pinGateModal.mode === 'unlock_frozen') {
          setTimbratureEditUnlockedShiftId(pinGateModal.shiftId);
          setDrawerManualPunchFormExpanded(true);
        }
        setPinGateModal(null);
        setPinGatePin('');
        setPinGateError('');
      } catch {
        showError?.(
          pinGateModal.mode === 'delete_punches' ? t.save_error : t.ts_toast_unlock_error
        );
      } finally {
        setPinGateUnlocking(false);
      }
    },
    [
      pinGateModal,
      users,
      shifts,
      applyPayrollUnlock,
      deletePunchRecordsForShift,
      closeTimesheetShiftDrawer,
      showSuccess,
      showError,
      t,
    ]
  );

  useEffect(() => {
    if (!pinGateModal) return;
    const id = requestAnimationFrame(() => {
      pinGateKeyboardInputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [pinGateModal]);

  useEffect(() => {
    if (!pinGateModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || pinGateUnlocking) return;
      e.preventDefault();
      setPinGateModal(null);
      setPinGatePin('');
      setPinGateError('');
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [pinGateModal, pinGateUnlocking]);

  useEffect(() => {
    if (!pinGateModal || pinGateUnlocking) {
      if (!pinGateModal) pinGateAutoSubmittedFor.current = '';
      return;
    }
    if (pinGatePin.length < 4) {
      pinGateAutoSubmittedFor.current = '';
      return;
    }
    if (pinGateAutoSubmittedFor.current === pinGatePin) return;
    pinGateAutoSubmittedFor.current = pinGatePin;
    void submitTimbraturePinGate(pinGatePin);
  }, [pinGateModal, pinGatePin, pinGateUnlocking, submitTimbraturePinGate]);

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
      setDrawerReviewQueue(null);
    } catch {
      showError?.(t.ts_toast_exit_error);
    } finally {
      setClosingLoading(false);
    }
  };

  const openDrawer = (
    shift: ShiftRow,
    user: { id: string; first_name: string; department?: string },
    dateStr: string,
    reviewQueue: DrawerReviewQueue | null = null
  ) => {
    setDrawerReviewQueue(reviewQueue);
    const punchAuditEntries = shift.punchInId ? (punchAudits[shift.punchInId] || []) : [];
    const shiftEdits = getShiftHistory(shift.id);
    setDrawerData({ shift, userId: user.id, employeeName: user.first_name, department: user.department, dateStr, punchAuditEntries, shiftEdits });
    if (reviewQueue) {
      setManualPunchIn(shift.actualStart ?? shift.plannedStart);
      if (shift.actualEndFull) {
        const d = new Date(shift.actualEndFull);
        setManualPunchOutDate(format(d, 'yyyy-MM-dd'));
        setManualPunchOut(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      } else {
        setManualPunchOutDate(dateStr);
        setManualPunchOut(shift.actualEnd ?? '');
      }
    } else if (shift.punched && shift.punchInId) {
      setManualPunchIn(shift.actualStart ?? shift.plannedStart);
      if (shift.actualEndFull) {
        const d = new Date(shift.actualEndFull);
        setManualPunchOutDate(format(d, 'yyyy-MM-dd'));
        setManualPunchOut(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      } else {
        setManualPunchOutDate(dateStr);
        setManualPunchOut(shift.actualEnd ?? '');
      }
    } else {
      setManualPunchIn(shift.plannedStart);
      setManualPunchOut(shift.plannedEnd);
      setManualPunchOutDate(dateStr);
    }
    setManualPunchSaving(false);
    setPinGateModal(null);
    setPinGatePin('');
    setPinGateError('');
    setTimbratureEditUnlockedShiftId((cur) => {
      if (reviewQueue?.reviewScope === 'employee_week') return shift.id;
      return drawerData?.shift.id === shift.id ? cur : null;
    });
    setShiftEditsUnlockedShiftId((cur) =>
      drawerData?.shift.id === shift.id ? cur : null
    );
    setPlannedTimesEditUnlockedShiftId((cur) =>
      drawerData?.shift.id === shift.id ? cur : null
    );
    setDrawerPlannedTimeStart(shift.plannedStart);
    setDrawerPlannedTimeEnd((shift.plannedEnd || '').slice(0, 5));
    setPlannedTimesSaving(false);
    setDrawerShiftEditsExpanded(false);
    setDrawerManualPunchFormExpanded(true);
  };

  const toISOFromDateHHMM = (dateStr: string, hhmm: string): string => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = parseISO(dateStr);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h ?? 0, m ?? 0, 0, 0).toISOString();
  };

  /** Inserimento timbrature mancanti o aggiornamento ingresso/uscita già presenti (dopo PIN se richiesto). */
  const handleDrawerSaveTimbratures = async (opts?: { silentToast?: boolean }): Promise<boolean> => {
    if (!drawerData) return false;
    const shiftRow = drawerData.shift;
    if (shiftRow.status === 'absent') return false;
    const fullForPunch = shifts.find((sh) => sh.id === shiftRow.id);
    const payFrozen = fullForPunch ? isShiftPayrollFrozen(fullForPunch) : false;
    if (payFrozen) return false;
    if (
      featureFlags['unlock_with_pin'] !== false &&
      timbratureEditUnlockedShiftId !== shiftRow.id
    ) {
      return false;
    }
    const inHm = (manualPunchIn || '').trim().slice(0, 5);
    const outHm = (manualPunchOut || '').trim().slice(0, 5);
    if (!/^\d{1,2}:\d{2}$/.test(inHm) || !/^\d{1,2}:\d{2}$/.test(outHm)) {
      showError?.(t.enter_valid_time_example);
      return false;
    }
    const [yIn, moIn, dIn] = drawerData.dateStr.split('-').map((n) => parseInt(n, 10));
    const [hIn, mIn] = inHm.split(':').map((n) => parseInt(n, 10));
    const inLocal = new Date(yIn, moIn - 1, dIn, hIn, mIn, 0, 0);
    const outDateStr = resolveTimesheetPunchOutDateStr(
      drawerData.dateStr,
      manualPunchOutDate || undefined,
      manualPunchIn,
      manualPunchOut
    );
    if (!outDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(outDateStr)) {
      showError?.(t.save_error);
      return false;
    }
    const [yOut, moOut, dOut] = outDateStr.split('-').map((n) => parseInt(n, 10));
    const [hOut, mOut] = outHm.split(':').map((n) => parseInt(n, 10));
    const outLocal = new Date(yOut, moOut - 1, dOut, hOut, mOut, 0, 0);
    if (outLocal.getTime() <= inLocal.getTime()) {
      showError?.(t.ts_manual_punches_out_after_in_error);
      return false;
    }
    setManualPunchSaving(true);
    try {
      if (shiftRow.punchInId) {
        const newInISO = toISOFromDateHHMM(drawerData.dateStr, inHm);
        await updatePunchRecord(shiftRow.punchInId, { calculated_time: newInISO });
        const newOutISO = toISOFromDateHHMM(outDateStr, outHm);
        if (shiftRow.punchOutId) {
          await updatePunchRecord(shiftRow.punchOutId, { timestamp: newOutISO });
        } else {
          try {
            await updatePunchRecord(shiftRow.punchInId, { clock_out_time: newOutISO });
          } catch {
            await updatePunchRecord(shiftRow.punchInId, { calculated_time: newOutISO });
          }
        }
        if (!opts?.silentToast) showSuccess?.(t.ts_toast_shift_updated);
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        setDrawerManualPunchFormExpanded(false);
        return true;
      }
      const rIn = await addPunchRecord(drawerData.userId, 'in', {
        shift_id: shiftRow.id,
        timestamp: inLocal.toISOString(),
        source: 'manual',
      });
      if (rIn && typeof rIn === 'object' && 'error' in rIn && rIn.error) {
        showError?.(rIn.error);
        return false;
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
        return false;
      }
      if (!opts?.silentToast) showSuccess?.(t.ts_toast_manual_punches_saved);
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setDrawerManualPunchFormExpanded(false);
      return true;
    } catch {
      showError?.(t.save_error);
      return false;
    } finally {
      setManualPunchSaving(false);
    }
  };

  /** Se OUT è prima di IN sulla data del turno (es. 00:00 dopo le 18:00), imposta data uscita al giorno dopo. */
  useEffect(() => {
    if (!drawerData) return;
    const shiftD = drawerData.dateStr;
    const raw = (manualPunchOutDate || '').trim();
    const effective = raw || shiftD;
    const resolved = resolveTimesheetPunchOutDateStr(
      shiftD,
      manualPunchOutDate || undefined,
      manualPunchIn,
      manualPunchOut
    );
    if (!resolved) return;
    if (resolved !== effective && (raw === '' || raw === shiftD)) {
      setManualPunchOutDate(resolved);
    }
  }, [drawerData, manualPunchOutDate, manualPunchIn, manualPunchOut]);

  const handleSaveDrawerPlannedTimes = async () => {
    if (!drawerData) return;
    const shiftRow = drawerData.shift;
    const startNorm = normalizeTimeInputToHHmm(drawerPlannedTimeStart.trim());
    const endNorm = normalizeTimeInputToHHmm(drawerPlannedTimeEnd.trim());
    if (!startNorm || !/^\d{2}:\d{2}$/.test(startNorm)) {
      showError?.(t.enter_valid_time_example);
      return;
    }
    if (!endNorm || !/^\d{2}:\d{2}$/.test(endNorm)) {
      showError?.(t.shift_end_time_required);
      return;
    }
    const others = shifts.filter(
      (sh) =>
        sh.id !== shiftRow.id &&
        sh.user_id === drawerData.userId &&
        sh.date === drawerData.dateStr
    );
    if (hasShiftConflictSameDay(others, { start_time: startNorm, end_time: endNorm }, shiftRow.id)) {
      showError?.(t.shift_overlap_same_day);
      return;
    }
    const curEnd = (shiftRow.plannedEnd || '').slice(0, 5);
    if (startNorm === shiftRow.plannedStart && endNorm === curEnd) {
      return;
    }
    setPlannedTimesSaving(true);
    try {
      await updateShift(shiftRow.id, { start_time: startNorm, end_time: endNorm });
      showSuccess?.(t.ts_toast_shift_time_updated);
    } catch {
      showError?.(t.save_error);
    } finally {
      setPlannedTimesSaving(false);
    }
  };

  const handleDrawerDeductBreakChange = useCallback(
    async (shiftId: string, checked: boolean) => {
      setDeductBreakSaving(true);
      try {
        await updateShift(shiftId, { deduct_break: checked });
        showSuccess?.(t.shift_saved);
      } catch {
        showError?.(t.save_error);
      } finally {
        setDeductBreakSaving(false);
      }
    },
    [updateShift, showSuccess, showError, t]
  );

  // ── Day Review ───────────────────────────────────────────────────────────

  const handleOpenDayReview = (dateStr: string) => {
    const items: DrawerReviewQueueItem[] = [];
    for (const user of visibleUsers) {
      const dayData = timesheetData[user.id]?.[dateStr];
      if (!dayData) continue;
      for (const shift of dayData.shifts) {
        if (!shiftEligibleForDayReview(shift)) continue;
        items.push({
          userId: user.id,
          employeeName: user.first_name,
          department: (user as { department?: string }).department,
          shift,
          dateStr,
        });
      }
    }
    if (items.length === 0) return;
    const first = items[0];
    const u = visibleUsers.find((x) => x.id === first.userId);
    if (!u) return;
    const queue: DrawerReviewQueue = { dateStr, items, currentIdx: 0, reviewScope: 'day' };
    openDrawer(first.shift, { id: u.id, first_name: first.employeeName, department: first.department }, first.dateStr, queue);
  };

  const handleOpenEmployeeWeekReview = (user: User) => {
    const items: DrawerReviewQueueItem[] = [];
    for (const day of weekDays) {
      const inP = viewMode === 'month' ? isDayInConfiguredPeriod(day) : true;
      if (!inP) continue;
      const dStr = format(day, 'yyyy-MM-dd');
      const dayData = timesheetData[user.id]?.[dStr];
      if (!dayData) continue;
      for (const shift of dayData.shifts) {
        if (!shiftEligibleForDayReview(shift)) continue;
        items.push({
          userId: user.id,
          employeeName: user.first_name,
          department: user.department,
          shift,
          dateStr: dStr,
        });
      }
    }
    items.sort((a, b) => {
      const c = a.dateStr.localeCompare(b.dateStr);
      if (c !== 0) return c;
      return toMinutesFromMidnight(a.shift.plannedStart) - toMinutesFromMidnight(b.shift.plannedStart);
    });
    if (items.length === 0) {
      showError?.(t.ts_employee_week_review_empty);
      return;
    }
    const first = items[0];
    const queue: DrawerReviewQueue = {
      dateStr: first.dateStr,
      items,
      currentIdx: 0,
      reviewScope: 'employee_week',
    };
    openDrawer(
      first.shift,
      { id: user.id, first_name: first.employeeName, department: first.department },
      first.dateStr,
      queue
    );
  };

  const goToDrawerReviewIndex = (i: number) => {
    const q = drawerReviewQueueRef.current;
    if (!q || i < 0 || i >= q.items.length) return;
    const item = q.items[i];
    const u = visibleUsers.find((x) => x.id === item.userId);
    if (!u) return;
    openDrawer(item.shift, { id: u.id, first_name: item.employeeName, department: item.department }, item.dateStr, {
      ...q,
      currentIdx: i,
    });
  };

  const handleDrawerReviewNavigate = (dir: 1 | -1) => {
    const q = drawerReviewQueueRef.current;
    if (!q) return;
    const next = q.currentIdx + dir;
    goToDrawerReviewIndex(next);
  };

  const advanceDrawerReviewAfterStep = () => {
    const q = drawerReviewQueueRef.current;
    if (!q) return;
    const next = q.currentIdx + 1;
    if (next < q.items.length) {
      goToDrawerReviewIndex(next);
    } else {
      const scope = q.reviewScope;
      setDrawerReviewQueue(null);
      setDrawerData(null);
      if (scope === 'employee_week' && canTimesheetApprove) {
        const uniqueIds = [...new Set(q.items.map((it) => it.shift.id))];
        const toFreeze = uniqueIds.filter((id) => {
          const full = shifts.find((s) => s.id === id);
          if (!full) return false;
          if (full.approval_status === 'approved') return false;
          if (full.approval_status === 'absent') return false;
          if (isShiftPayrollFrozen(full)) return false;
          return true;
        });
        if (toFreeze.length > 0) {
          const idSet = new Set(toFreeze);
          const previewRows = q.items
            .filter((it) => idSet.has(it.shift.id))
            .map((it) => ({
              dateStr: it.dateStr,
              planned: `${it.shift.plannedStart}–${it.shift.plannedEnd}`,
            }));
          setEmployeeWeekFreezeBatch({
            shiftIds: toFreeze,
            employeeName: q.items[0]?.employeeName ?? '—',
            previewRows,
          });
        } else {
          showSuccess?.(t.ts_toast_employee_week_review_complete);
        }
      } else {
        showSuccess?.(
          scope === 'employee_week' ? t.ts_toast_employee_week_review_complete : t.ts_toast_day_review_complete
        );
      }
    }
  };

  const handleDrawerReviewSaveAndNext = async () => {
    if (!drawerReviewQueue || !drawerData) return;
    const s = drawerData.shift;
    if (drawerReviewQueue.reviewScope === 'employee_week' && s.status === 'absent') {
      advanceDrawerReviewAfterStep();
      return;
    }
    const inHm = (manualPunchIn || '').trim().slice(0, 5);
    const outHm = (manualPunchOut || '').trim().slice(0, 5);
    const outDate = (manualPunchOutDate || '').trim();
    if (!inHm || !outHm) {
      showError?.(t.enter_valid_time_example);
      return;
    }
    const resolvedOutDate = resolveTimesheetPunchOutDateStr(
      drawerData.dateStr,
      outDate || undefined,
      inHm,
      outHm
    );
    if (
      !/^\d{1,2}:\d{2}$/.test(inHm) ||
      !/^\d{1,2}:\d{2}$/.test(outHm) ||
      !resolvedOutDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(resolvedOutDate)
    ) {
      showError?.(t.enter_valid_time_example);
      return;
    }
    setReviewQueueSaving(true);
    try {
      const fullShiftForBreak = shifts.find((x) => x.id === s.id);
      const userForBreak = users.find((u) => u.id === drawerData.userId);
      if (!fullShiftForBreak || !userForBreak) {
        showError?.(t.save_error);
        return;
      }
      const isEmployeeWeek = drawerReviewQueue.reviewScope === 'employee_week';
      const requireFreezeAfterSave = canTimesheetApprove && !isEmployeeWeek;
      const silentIntermediateToast = canTimesheetApprove && isEmployeeWeek;
      if (!s.punchInId) {
        const ok = await handleDrawerSaveTimbratures({
          silentToast: requireFreezeAfterSave || silentIntermediateToast,
        });
        if (!ok) return;
        if (requireFreezeAfterSave) {
          setApprovalConfirm(
            buildReviewQueueFreezeApprovalPayload({
              shiftId: s.id,
              employeeName: drawerData.employeeName,
              shiftDateStr: drawerData.dateStr,
              plannedStart: s.plannedStart,
              plannedEnd: s.plannedEnd,
              plannedMins: s.plannedMins,
              fullShift: fullShiftForBreak,
              user: userForBreak,
              breakRules,
              breakComputeOpts,
              inHm,
              outHm,
              resolvedOutDate,
            })
          );
        } else {
          if (!silentIntermediateToast) showSuccess?.(t.ts_toast_manual_punches_saved);
          advanceDrawerReviewAfterStep();
        }
        return;
      }
      const newInISO = toISOFromDateHHMM(drawerData.dateStr, inHm);
      await updatePunchRecord(s.punchInId, { calculated_time: newInISO });
      const newOutISO = toISOFromDateHHMM(resolvedOutDate, outHm);
      if (s.punchOutId) {
        await updatePunchRecord(s.punchOutId, { timestamp: newOutISO });
      } else {
        await updatePunchRecord(s.punchInId, { clock_out_time: newOutISO });
      }
      if (requireFreezeAfterSave) {
        setApprovalConfirm(
          buildReviewQueueFreezeApprovalPayload({
            shiftId: s.id,
            employeeName: drawerData.employeeName,
            shiftDateStr: drawerData.dateStr,
            plannedStart: s.plannedStart,
            plannedEnd: s.plannedEnd,
            plannedMins: s.plannedMins,
            fullShift: fullShiftForBreak,
            user: userForBreak,
            breakRules,
            breakComputeOpts,
            inHm,
            outHm,
            resolvedOutDate,
          })
        );
      } else {
        if (!silentIntermediateToast) showSuccess?.(t.ts_toast_shift_updated);
        advanceDrawerReviewAfterStep();
      }
    } catch {
      showError?.(t.save_error);
    } finally {
      setReviewQueueSaving(false);
    }
  };

  const runEmployeeWeekBatchFreeze = async () => {
    if (!employeeWeekFreezeBatch) return;
    const verifier = findFreezeVerifierByPin(users, approvalPin);
    if (!verifier) {
      setApprovalPinError(t.ts_approval_pin_invalid);
      setApprovalPin('');
      return;
    }
    setEmployeeWeekFreezeBusy(true);
    try {
      for (const shiftId of employeeWeekFreezeBatch.shiftIds) {
        const raw = shifts.find((s) => s.id === shiftId);
        if (!raw || raw.approval_status === 'approved' || isShiftPayrollFrozen(raw)) continue;
        await approveShift(shiftId, {
          actorOverride: verifier,
          promoteFromDraft: raw.approval_status === 'draft',
        });
      }
      const n = employeeWeekFreezeBatch.shiftIds.length;
      setEmployeeWeekFreezeBatch(null);
      setApprovalPin('');
      const tv = t as Record<string, string>;
      showSuccess?.(
        formatTrans(
          tv.ts_employee_week_freeze_batch_done ?? 'Congelati {count} turni. Revisione completata.',
          { count: String(n) }
        )
      );
    } catch {
      showError?.(t.ts_toast_approve_freeze_error);
    } finally {
      setEmployeeWeekFreezeBusy(false);
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

          {/* ── Stats Cards: settimana visualizzata (management) ────────────────── */}
          {uiW('timesheet.stats_today') && canTeamTimesheetOps && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {([
                {
                  label: t.ts_stat_in_shift,
                  value: weekViewStats.inTurno,
                  Icon: Users,
                  iconColor: 'text-emerald-600 dark:text-emerald-400',
                  bg: 'bg-transparent dark:bg-transparent',
                  border: 'border-emerald-200 dark:border-emerald-800/40',
                  iconWell: 'bg-emerald-100/80 dark:bg-emerald-950/50',
                },
                {
                  label: t.ts_stat_delays_week,
                  value: weekViewStats.ritardi,
                  Icon: Clock,
                  iconColor: 'text-red-500 dark:text-red-400',
                  bg: 'bg-transparent dark:bg-transparent',
                  border: 'border-red-200 dark:border-red-900/40',
                  iconWell: 'bg-red-100/80 dark:bg-red-950/40',
                },
                {
                  label: t.ts_stat_no_punch_week,
                  value: weekViewStats.senzaTimbratura,
                  Icon: AlertCircle,
                  iconColor: 'text-amber-500 dark:text-amber-400',
                  bg: 'bg-transparent dark:bg-transparent',
                  border: 'border-amber-400/45 dark:border-amber-500/35',
                  iconWell: 'bg-amber-400/15 dark:bg-amber-500/20',
                },
                {
                  label: t.ts_stat_approved_week,
                  value: weekViewStats.approvati,
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

          {/* ── Toolbar presenze: sopra la griglia ── */}
          {uiW('timesheet.header') && (
          <div className="ui-toolbar-page-band ui-toolbar-page-band-presences !h-auto !max-h-none min-h-0 flex-col items-stretch justify-start gap-2 md:flex-row md:items-center md:justify-between md:gap-1.5 md:px-2 overflow-visible relative z-[1000]">
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-stretch gap-2 overflow-visible md:flex-row md:flex-nowrap md:items-center md:justify-start md:gap-1.5 relative z-[1001]">
              <div className="ui-toolbar-row-tight min-w-0 w-full shrink-0 md:w-auto md:gap-1.5">
                <div className="ui-toolbar-group md:scale-90 md:origin-left">
                  <button
                    type="button"
                    onClick={() => setViewMode('day')}
                    className={`ui-toolbar-tab !px-2 !text-[10px] ${viewMode === 'day' ? 'bg-accent text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800/80'}`}
                  >
                    {t.ts_period_day || 'Giorno'}
                  </button>
                  <button type="button" onClick={() => setViewMode('week')}
                    className={`ui-toolbar-tab !px-2 !text-[10px] ${viewMode === 'week' ? 'bg-accent text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800/80'}`}>
                    {t.ts_period_week}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('month')}
                    className={`ui-toolbar-tab !px-2 !text-[10px] ${viewMode === 'month' ? 'bg-accent text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800/80'}`}
                    title={monthTabTitle}
                    aria-label={`${t.ts_period_month}${payrollStripForToolbar ? `. ${formatTrans(tv.ts_timesheet_month_payroll_strip ?? '', { dates: payrollStripForToolbar })}` : ''}`}
                  >
                    {t.ts_period_month}
                  </button>
                </div>

                {viewMode === 'month' && payrollStripForToolbar && (
                  <span
                    className="hidden min-[400px]:inline-flex h-8 max-w-[min(100%,12rem)] shrink-0 items-center truncate rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-[9px] font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                    title={tv.ts_timesheet_month_tab_hint}
                  >
                    {payrollStripForToolbar}
                  </span>
                )}

                <div
                  className="ui-toolbar-chip max-w-full min-w-0 cursor-default select-none font-bold !px-2 !h-8 !text-[10px]"
                  role="status"
                  aria-label={t.ts_period_chip_aria}
                  title={`${format(periodStartDate, 'dd/MM/yy', { locale })} → ${format(periodEndDate, 'dd/MM/yy', { locale })}`}
                >
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-neutral-400" aria-hidden />
                  <span className="min-w-0 truncate tabular-nums">
                    {viewMode === 'day' 
                      ? format(weekDays[0], 'd MMM yy', { locale })
                      : `${format(periodStartDate, 'dd/MM/yy', { locale })} → ${format(periodEndDate, 'dd/MM/yy', { locale })}`}
                  </span>
                </div>

                {timesheetMainGridWeekNav && (
                  <div className="ui-toolbar-group shrink-0 md:scale-90">
                    <button
                      type="button"
                      onClick={timesheetMainGridWeekNav.onPrev}
                      disabled={!timesheetMainGridWeekNav.canPrev}
                      className="ui-toolbar-tab px-1.5 h-8 disabled:opacity-30"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={timesheetMainGridWeekNav.onNext}
                      disabled={!timesheetMainGridWeekNav.canNext}
                      className="ui-toolbar-tab px-1.5 h-8 disabled:opacity-30"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className="ui-toolbar-group shrink-0 flex md:scale-90">
                  <button
                    type="button"
                    onClick={goToToday}
                    disabled={todayWeekIndexInPeriod === null}
                    title={
                      todayWeekIndexInPeriod === null
                        ? t.ts_toolbar_today_outside
                        : t.ts_toolbar_today_hint
                    }
                    className={`ui-toolbar-tab !px-2 !text-[10px] h-8 ${
                      isShowingTodayWeek
                        ? 'bg-accent text-white'
                        : 'text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800/80'
                    }`}
                  >
                    {t.today}
                  </button>
                </div>
              </div>

              <div className="hidden w-full min-w-0 flex-nowrap items-center justify-start gap-1.5 border-t border-slate-200 pt-2 dark:border-white/10 md:flex md:w-auto md:border-l md:border-t-0 md:pl-2 md:pt-0">
                <div className="flex min-w-0 shrink-0 items-center gap-1.5">
                  <span className="shrink-0 whitespace-nowrap text-[9px] font-bold uppercase leading-none tracking-wide text-slate-500 dark:text-neutral-400">
                    {t.ts_label_from}
                  </span>
                  <DatePickerField
                    value={periodStart}
                    onChange={(v) => { setPeriodStart(v); setPeriodSaved(false); setWeekIndex(0); }}
                    allowClear={false}
                    compact
                    toolbarComfortable
                    aria-label={t.ts_period_start}
                    className="!h-8 !min-w-[6rem] !max-w-[8rem] !text-[10px] justify-between !border-slate-200 !bg-white shadow-sm dark:!border-white/10 dark:!bg-neutral-900 surface-ghost-interactive hover:!border-slate-300 dark:hover:!border-white/15"
                  />
                </div>
                <div className="ui-toolbar-group shrink-0 md:scale-90" title={t.ts_preset_weeks_mobile_hint}>
                  <button
                    type="button"
                    onClick={() => { setPeriodNumWeeks(4); setPeriodSaved(false); setWeekIndex(0); }}
                    className={`ui-toolbar-tab !px-2 !text-[10px] h-8 ${
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
                    className={`ui-toolbar-tab !px-2 !text-[10px] h-8 ${
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
                  className={`ui-toolbar-accent shrink-0 !px-2 !h-8 !text-[10px] ${
                    periodSaved
                      ? 'cursor-not-allowed !bg-slate-200 !text-slate-500 hover:!bg-slate-200 dark:!bg-neutral-800 dark:!text-neutral-500'
                      : ''
                  }`}
                >
                  {t.ts_save_period}
                </button>
              </div>
            </div>

            <div className="flex min-h-8 shrink-0 items-center justify-start gap-1 self-stretch md:ml-auto md:justify-end md:self-center">
              <div className="flex items-center gap-1 md:scale-90 md:origin-right">
                {/* Department Selector for PDF */}
                <div className="relative" ref={pdfDeptMenuRef}>
                  <button
                    type="button"
                    onClick={(e) => { 
                      e.preventDefault();
                      e.stopPropagation(); 
                      setShowPdfDeptMenu(prev => !prev); 
                    }}
                    className="ui-toolbar-chip !inline-flex !h-8 !px-2 !text-[10px] items-center gap-1.5 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-neutral-800/90 cursor-pointer relative z-[110]"
                    title="Seleziona reparto per PDF"
                  >
                    <Filter className="h-3 w-3 text-slate-400" />
                    <span className="font-bold text-slate-700 dark:text-neutral-200">
                      {pdfDeptFilter === 'all' ? 'Tutti i reparti' : 
                       availableDepts.find(d => d.value === pdfDeptFilter)?.label || pdfDeptFilter}
                    </span>
                    <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${showPdfDeptMenu ? 'rotate-180' : ''}`} />
                  </button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                      {showPdfDeptMenu && (
                        <>
                          {/* Desktop Dropdown */}
                          <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.95 }}
                            className="hidden lg:block absolute left-0 lg:right-0 lg:left-auto top-full z-[9999] mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-neutral-900"
                            style={{ isolation: 'isolate' }}
                          >
                            <button
                              type="button"
                              onClick={() => { setPdfDeptFilter('all'); setShowPdfDeptMenu(false); }}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-all ${
                                pdfDeptFilter === 'all' 
                                  ? 'bg-accent text-white shadow-md' 
                                  : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-white/5'
                              }`}
                            >
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                                <Check className={`h-3 w-3 ${pdfDeptFilter === 'all' ? 'text-white' : 'text-accent'}`} strokeWidth={3} />
                              </div>
                              <span className="flex-1 truncate">Tutti i reparti</span>
                              {pdfDeptFilter === 'all' && <Check className="h-3 w-3 text-white/90" strokeWidth={3} />}
                            </button>

                            <div className="my-1 h-px bg-slate-100 dark:bg-white/5" />

                            {availableDepts
                              .map((dept) => (
                              <button
                                key={dept.value}
                                type="button"
                                onClick={() => { setPdfDeptFilter(dept.value); setShowPdfDeptMenu(false); }}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-all ${
                                  pdfDeptFilter === dept.value 
                                    ? 'bg-accent text-white shadow-md' 
                                    : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-white/5'
                                }`}
                              >
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full shadow-sm ${pdfDeptFilter === dept.value ? 'bg-white' : ''}`}
                                    style={pdfDeptFilter !== dept.value ? { backgroundColor: getDeptColor(dept.value) } : {}}
                                  />
                                </div>
                                <span className="flex-1 truncate">{dept.label}</span>
                                {pdfDeptFilter === dept.value && <Check className="h-3 w-3 text-white/90" strokeWidth={3} />}
                              </button>
                            ))}
                          </motion.div>

                          {/* Mobile/Tablet Popup Modal */}
                          <div className="lg:hidden">
                            <CenteredModalPortal
                              open={showPdfDeptMenu}
                              onClose={() => setShowPdfDeptMenu(false)}
                              maxWidthClass="max-w-[280px]"
                              panelClassName="p-1"
                            >
                              <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 border-b border-slate-100 dark:border-white/10 mb-1">
                                {t.department_filter_label}
                              </div>
                              <button
                                type="button"
                                onClick={() => { setPdfDeptFilter('all'); setShowPdfDeptMenu(false); }}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-all ${
                                  pdfDeptFilter === 'all' 
                                    ? 'bg-accent text-white shadow-md' 
                                    : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-white/5'
                                }`}
                              >
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                                  <Check className={`h-3 w-3 ${pdfDeptFilter === 'all' ? 'text-white' : 'text-accent'}`} strokeWidth={3} />
                                </div>
                                <span className="flex-1 truncate">Tutti i reparti</span>
                                {pdfDeptFilter === 'all' && <Check className="h-3 w-3 text-white/90" strokeWidth={3} />}
                              </button>

                              <div className="my-1 h-px bg-slate-100 dark:bg-white/5" />

                              {availableDepts
                                .map((dept) => (
                                <button
                                  key={dept.value}
                                  type="button"
                                  onClick={() => { setPdfDeptFilter(dept.value); setShowPdfDeptMenu(false); }}
                                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-all ${
                                    pdfDeptFilter === dept.value 
                                      ? 'bg-accent text-white shadow-md' 
                                      : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-white/5'
                                  }`}
                                >
                                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                                    <span
                                      className={`h-2.5 w-2.5 rounded-full shadow-sm ${pdfDeptFilter === dept.value ? 'bg-white' : ''}`}
                                      style={pdfDeptFilter !== dept.value ? { backgroundColor: getDeptColor(dept.value) } : {}}
                                    />
                                  </div>
                                  <span className="flex-1 truncate">{dept.label}</span>
                                  {pdfDeptFilter === dept.value && <Check className="h-3 w-3 text-white/90" strokeWidth={3} />}
                                </button>
                              ))}
                            </CenteredModalPortal>
                          </div>
                        </>
                      )}
                    </AnimatePresence>
                </div>

                <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-0.5" />

                <button
                  type="button"
                  onClick={() => void handleExportTimesheetPdf('WEEK')}
                  className="ui-toolbar-chip hover:bg-slate-50 dark:hover:bg-neutral-800/90 inline-flex !h-8 !px-2 !text-[10px]"
                  title={t.ts_export_week_pdf || "Export Current Week PDF"}
                  aria-label={t.ts_export_week_pdf || "Export Current Week PDF"}
                >
                  <FileDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="hidden min-[380px]:inline">{t.ts_week_pdf || "Week PDF"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportTimesheetPdf('PERIOD')}
                  className="ui-toolbar-chip hover:bg-slate-50 dark:hover:bg-neutral-800/90 inline-flex border-accent/30 text-accent !h-8 !px-2 !text-[10px]"
                  title={t.ts_export_period_pdf || "Export Full Period PDF"}
                  aria-label={t.ts_export_period_pdf || "Export Full Period PDF"}
                >
                  <FileDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="hidden min-[380px]:inline">{t.ts_period_pdf || "Period PDF"}</span>
                </button>
              </div>
            </div>
          </div>
          )}
          {/* ── Griglia presenze (ancora scroll dalle card riepilogo) ─── */}
          {uiW('timesheet.main_grid') && (
          <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4 px-4 pb-8">
            {visibleUsers.map((user) => {
              const totals = userTotals[user.id];
              const userHasShifts = weekDays.some(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                return timesheetData[user.id]?.[dateStr]?.shifts.length > 0;
              });

              return (
                <div key={user.id} className="surface-glass rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-lg text-slate-900 dark:text-neutral-100">{user.first_name}</h4>
                      {user.department && (
                        <p className="text-[10px] text-slate-400 dark:text-neutral-400 font-medium uppercase tracking-wider">{user.department}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{t.stats_total}</div>
                      <div className="text-sm font-bold text-accent">
                        {formatMinutesToHoursAndMinutes(totals?.actualMins || totals?.plannedMins || 0)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {!userHasShifts ? (
                      <div className="py-4 text-center border-2 border-dashed border-slate-100 dark:border-white/5 rounded-xl">
                        <p className="text-xs text-slate-400 italic">{t.no_shifts_this_week || 'Nessun turno questa settimana'}</p>
                      </div>
                    ) : (
                      weekDays.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayData = timesheetData[user.id]?.[dateStr];
                        if (!dayData || dayData.shifts.length === 0) return null;
                        
                        const todayDate = isToday(day);

                        return (
                          <div key={dateStr} className={`flex items-start gap-3 p-2 rounded-xl ${todayDate ? 'bg-accent/5 ring-1 ring-accent/20' : 'bg-slate-50/50 dark:bg-white/5'}`}>
                            <div className="w-10 shrink-0 text-center">
                              <div className={`text-[10px] font-bold uppercase ${todayDate ? 'text-accent' : 'text-slate-400'}`}>
                                {format(day, 'EEE', { locale })}
                              </div>
                              <div className={`text-xs font-bold ${todayDate ? 'text-accent' : 'text-slate-600 dark:text-neutral-300'}`}>
                                {format(day, 'd', { locale })}
                              </div>
                            </div>
                            
                            <div className="flex-1 space-y-2">
                              {dayData.shifts.map(s => {
                                const punchAuditCount = s.punchInId ? (punchAudits[s.punchInId]?.length ?? 0) : 0;
                                const boardShift = shifts.find((sh) => sh.id === s.id) ?? null;
                                const { border, bg, ring } = getShiftCardStyle(s, punchAuditCount, dateStr, boardShift);
                                
                                return (
                                  <button 
                                    key={s.id} 
                                    onClick={() => openDrawer(s, user, dateStr)} 
                                    className={`flex w-full items-center justify-between rounded-lg border-l-4 ${border} ${bg} ${ring} p-2 text-left transition-transform active:scale-[0.98]`}
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-slate-800 dark:text-neutral-100">
                                        {s.plannedStart}–{s.plannedEnd || '?'}
                                      </span>
                                      {s.punched && s.actualStart && (
                                        <span className="text-[10px] font-medium text-slate-500 dark:text-neutral-400">
                                          {s.actualStart}–{s.actualEnd || '...'}
                                        </span>
                                      )}
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-300" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div id="timesheet-section-main-grid" className="hidden md:block surface-glass overflow-hidden scroll-mt-24">
            <HorizontalScrollArea
              variant="overlay"
              remeasureKey={`${viewMode}-${weekStr}-${weekDays.length}`}
              ariaLabelPrev={viewMode === 'week' ? tv.ts_timesheet_week_nav_prev : t.table_h_scroll_prev}
              ariaLabelNext={viewMode === 'week' ? tv.ts_timesheet_week_nav_next : t.table_h_scroll_next}
              weekNav={timesheetMainGridWeekNav}
              scrollClassName="overflow-x-auto-safe"
            >
            <table
              className="w-full table-fixed border-collapse [&_th]:border-slate-400 dark:[&_th]:border-white/35 [&_td]:border-slate-400 dark:[&_td]:border-white/35"
              style={{ minWidth: timesheetGridMinWidthPx }}
            >
              <colgroup>
                <col style={{ width: timesheetGridNameColPx }} />
                {weekDays.map((day) => (
                  <col key={format(day, 'yyyy-MM-dd')} style={{ width: timesheetGridDayColPx }} />
                ))}
                <col style={{ width: timesheetGridTotalColPx }} />
              </colgroup>
              <thead>
                <tr className="border-b-2 border-slate-300 dark:border-white/30">
                  <th className="sticky left-0 z-10 box-border bg-slate-50 py-3.5 pl-4 pr-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-r-white/40 dark:bg-neutral-800 dark:text-neutral-100 border-r-2 border-r-slate-400 md:py-2.5 md:pl-3 md:pr-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                    {t.employee}
                  </th>
                  {weekDays.map((day, dayIdx) => {
                    const todayDate = isToday(day);
                    const dStr = format(day, 'yyyy-MM-dd');
                    const inP = viewMode === 'month' ? isDayInConfiguredPeriod(day) : true;
                    const isPayrollDay = dStr === weekViewPayrollDayStr;
                    const payrollHighlight = isPayrollDay && (viewMode === 'week' || inP);
                    const canReviewThisDay = dStr <= todayStr;
                    const dayReviewableCount = visibleUsers.reduce((n, u) => {
                      const d = timesheetData[u.id]?.[dStr];
                      return n + (d?.shifts.filter((s) => shiftEligibleForDayReview(s)).length ?? 0);
                    }, 0);
                    const canReview = inP && canReviewThisDay && canTeamTimesheetOps && dayReviewableCount > 0;
                    const weekEndCol = viewMode === 'month' && (dayIdx + 1) % 7 === 0;
                    return (
                      <th key={dStr}
                        onClick={canReview ? () => handleOpenDayReview(dStr) : undefined}
                        title={
                          isPayrollDay
                            ? `${format(day, 'EEEE d MMMM yyyy', { locale })} — ${tv.ts_payroll_day_abbr ?? 'Paga'}`
                            : canReview
                              ? t.ts_review_shifts_tooltip.replace('{n}', String(dayReviewableCount))
                              : undefined
                        }
                        className={`box-border px-2 py-2.5 text-center text-[11px] font-semibold whitespace-nowrap transition-colors md:px-1 md:py-1.5 ${
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
                  <th className="box-border border-l-[3px] border-l-slate-500 bg-slate-50 px-3 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-l-white/50 dark:bg-neutral-800 dark:text-neutral-100 md:px-2 md:py-2">
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
                      {/* Nome dipendente — click → revisione settimana (coda turni) */}
                      <td className="sticky left-0 bg-inherit pl-4 pr-3 py-3 border-r-2 border-r-slate-400 dark:border-r-white/40 z-10 md:py-2 md:pl-3 md:pr-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                        {canTeamTimesheetOps ? (
                          <button
                            type="button"
                            className="w-full max-w-full rounded-lg py-0.5 text-left transition-colors hover:bg-slate-200/60 dark:hover:bg-white/10"
                            aria-label={formatTrans(t.ts_employee_week_review_open_aria, { name: user.first_name })}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEmployeeWeekReview(user);
                            }}
                          >
                            <div className="font-semibold text-sm text-slate-800 dark:text-neutral-100 md:text-xs">{user.first_name}</div>
                            {user.department && (
                              <div className="text-[10px] text-slate-400 dark:text-neutral-400 mt-0.5 md:text-[9px]">{user.department}</div>
                            )}
                          </button>
                        ) : (
                          <>
                            <div className="font-semibold text-sm text-slate-800 dark:text-neutral-100 md:text-xs">{user.first_name}</div>
                            {user.department && (
                              <div className="text-[10px] text-slate-400 dark:text-neutral-400 mt-0.5 md:text-[9px]">{user.department}</div>
                            )}
                          </>
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

                        const { before16, from16 } = partitionShiftsByPlannedHour16(dayData.shifts);
                        const renderShiftButton = (s: ShiftRow) => {
                                const punchAuditCount = s.punchInId ? (punchAudits[s.punchInId]?.length ?? 0) : 0;
                                const boardShift = shifts.find((sh) => sh.id === s.id) ?? null;
                                const { border, bg, ring, dot } = getShiftCardStyle(s, punchAuditCount, dateStr, boardShift);
                                const punchMissingCell =
                                  !!boardShift && shiftPastPlannedEndWithoutClockIn(boardShift, punchRecords);
                                const publishedCell = s.status === 'confirmed' || s.status === 'approved';
                                const showPlannedTimesInCell =
                                  showFullTimesheetGrid || (plannedOnlyTimesheetGrid && publishedCell);
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
                                      <span
                                        className="text-[11px] font-semibold text-slate-600 dark:text-white tabular-nums md:text-[10px]"
                                        aria-label={
                                          showPlannedTimesInCell
                                            ? undefined
                                            : t.ts_times_grid_times_masked_aria
                                        }
                                      >
                                        {showPlannedTimesInCell
                                          ? `${s.plannedStart}–${s.plannedEnd || '?'}`
                                          : t.ts_times_masked_range}
                                      </span>
                                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dot} md:h-1.5 md:w-1.5`} />
                                    </div>
                                    {/* Effettivo: completo in full; in solo-pianificato solo ore ufficiali congelate (no timbrature/delta). */}
                                    {showFullTimesheetGrid ? (
                                      s.punched ? (
                                        s.actualEnd ? (
                                          <div className="flex items-center justify-between gap-1">
                                            <span className="text-[11px] font-bold text-slate-800 dark:text-white tabular-nums md:text-[10px]">
                                              {`${s.actualStart}–${s.actualEnd}`}
                                            </span>
                                            <span
                                              className={`max-w-[min(100%,5.5rem)] shrink-0 text-right text-[10px] font-semibold leading-tight tabular-nums md:max-w-[4.75rem] md:text-[9px] ${
                                                s.breakMinutesActual > 0 ? 'text-slate-500 dark:text-neutral-400' : deltaColor
                                              }`}
                                              title={
                                                s.breakMinutesActual > 0
                                                  ? `${t.ts_net_hours}: ${fmtHM(s.actualMins)}`
                                                  : undefined
                                              }
                                            >
                                              {s.breakMinutesActual > 0
                                                ? `−${fmtBreakDeductionShort(s.breakMinutesActual)}`
                                                : `${s.deltaMins >= 0 ? '+' : ''}${fmtHM(s.deltaMins)}`}
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex items-start justify-between gap-1 md:gap-0.5">
                                            <div className="min-w-0 flex flex-1 flex-wrap items-center gap-x-0.5 text-[10px] font-semibold text-red-700 dark:text-red-200 md:text-[9px]">
                                              <span>{s.actualStart}</span>
                                              <span className="text-red-500 dark:text-red-400">{t.ts_missing_exit}</span>
                                            </div>
                                            {s.breakMinutes > 0 && (
                                              <span
                                                className="max-w-[min(100%,5.5rem)] shrink-0 text-right text-[10px] font-semibold leading-tight tabular-nums text-slate-500 dark:text-neutral-400 md:max-w-[4.75rem] md:text-[9px]"
                                                title={`${t.ts_kpi_planned}: ${fmtHM(s.plannedMins)}`}
                                              >
                                                {`−${fmtBreakDeductionShort(s.breakMinutes)}`}
                                              </span>
                                            )}
                                          </div>
                                        )
                                      ) : (
                                        <>
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
                                          {s.breakMinutes > 0 && (
                                            <div className="flex justify-end">
                                              <span
                                                className="max-w-[min(100%,5.5rem)] text-right text-[10px] font-semibold leading-tight tabular-nums text-slate-500 dark:text-neutral-400 md:max-w-[4.75rem] md:text-[9px]"
                                                title={`${t.ts_kpi_planned}: ${fmtHM(s.plannedMins)}`}
                                              >
                                                {`−${fmtBreakDeductionShort(s.breakMinutes)}`}
                                              </span>
                                            </div>
                                          )}
                                        </>
                                      )
                                    ) : plannedOnlyTimesheetGrid &&
                                      publishedCell &&
                                      s.displayFromFrozenApprovedTimes &&
                                      s.actualStart &&
                                      s.actualEnd ? (
                                      <div className="flex items-center justify-between gap-1">
                                        <span
                                          className="text-[11px] font-bold text-slate-800 dark:text-white tabular-nums md:text-[10px]"
                                          title={t.ts_kpi_frozen_official}
                                        >
                                          {`${s.actualStart}–${s.actualEnd}`}
                                        </span>
                                      </div>
                                    ) : null}
                                    {/* Badge icone */}
                                    <div className="flex items-center gap-1 mt-1 md:mt-0.5 md:gap-0.5">
                                      {showFullTimesheetGrid && punchAuditCount > 0 && (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-orange-600 dark:text-orange-200 bg-orange-100 dark:bg-orange-950/55 rounded-xl px-1 py-0.5 md:rounded-md md:px-0.5 md:py-px">
                                          <ShieldAlert className="w-2.5 h-2.5 md:h-2 md:w-2" />{punchAuditCount}
                                        </span>
                                      )}
                                      {showFullTimesheetGrid && getShiftHistory(s.id).length > 0 && (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/50 rounded-xl px-1 py-0.5 md:rounded-md md:px-0.5 md:py-px">
                                          <History className="w-2.5 h-2.5 md:h-2 md:w-2" />{getShiftHistory(s.id).length}
                                        </span>
                                      )}
                                      <ArrowRight className="w-2.5 h-2.5 text-slate-300 dark:text-neutral-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity md:h-2 md:w-2" />
                                    </div>
                                    </div>
                                  </button>
                                );
                        };

                        return (
                          <td key={dateStr} className={`px-1.5 py-2 ${tdBorder} align-top ${tdBg} md:px-1 md:py-1.5 h-px`}>
                            <div className="flex h-full flex-col gap-1.5 md:gap-1">
                              {/* Slot Pranzo (Prima delle 16:00) */}
                              <div className={`flex flex-1 flex-col gap-1 md:gap-0.5 rounded-lg border px-1 py-1 md:rounded-md md:px-0.5 md:py-0.5 min-h-[42px] transition-all ${
                                before16.length > 0 
                                  ? 'border-slate-200/90 dark:border-white/12 bg-slate-50/70 dark:bg-neutral-900/50' 
                                  : 'border-transparent'
                              }`}>
                                {before16.map((s) => renderShiftButton(s))}
                              </div>
                              
                              {/* Slot Cena (Dalle 16:00 in poi) */}
                              <div className={`mt-auto flex flex-1 flex-col gap-1 md:gap-0.5 rounded-lg border px-1 py-1 md:rounded-md md:px-0.5 md:py-0.5 min-h-[42px] transition-all ${
                                from16.length > 0 
                                  ? 'border-slate-200/90 dark:border-white/12 bg-slate-50/70 dark:bg-neutral-900/50' 
                                  : 'border-transparent'
                              }`}>
                                {from16.map((s) => renderShiftButton(s))}
                              </div>
                            </div>
                          </td>
                        );
                      })}

                      {/* Totale settimana */}
                      <td className="px-3 py-3 text-center border-l-[3px] border-l-slate-500 dark:border-l-white/50 bg-slate-50/50 dark:bg-neutral-800/60 md:px-2 md:py-2">
                        <div className="text-xs font-semibold text-slate-500 dark:text-neutral-200 md:text-[10px]">
                          {showFullTimesheetGrid || plannedOnlyTimesheetGrid
                            ? formatMinutesToHoursAndMinutes(totals?.plannedMins ?? 0)
                            : t.ts_times_masked_hm}
                        </div>
                        {showFullTimesheetGrid && (totals?.actualMins ?? 0) > 0 && (
                          <>
                            <div className="text-sm font-bold text-slate-900 dark:text-white md:text-xs">
                              {formatMinutesToHoursAndMinutes(totals?.actualMins ?? 0)}
                            </div>
                            <div className={`text-[10px] font-semibold ${(totals?.deltaMins ?? 0) >= 0 ? 'text-accent' : 'text-red-500'} md:text-[9px]`}>
                              {(totals?.deltaMins ?? 0) >= 0 ? '+' : ''}
                              {fmtHM(totals?.deltaMins ?? 0)}
                            </div>
                          </>
                        )}
                        {plannedOnlyTimesheetGrid && (totals?.frozenOfficialMins ?? 0) > 0 && (
                          <div
                            className="text-sm font-bold text-slate-900 dark:text-white md:text-xs"
                            title={t.ts_kpi_frozen_official}
                          >
                            {formatMinutesToHoursAndMinutes(totals?.frozenOfficialMins ?? 0)}
                          </div>
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
                      const frozenCol = visibleUsers.reduce(
                        (s, u) => s + (timesheetData[u.id]?.[dateStr]?.totalFrozenOfficialMins ?? 0),
                        0
                      );
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
                              {showFullTimesheetGrid && actual > 0 && (
                                <div className={`font-semibold ${tdMuted ? 'text-slate-500 dark:text-neutral-300' : 'text-slate-800 dark:text-white'}`}>
                                  {formatMinutesToHoursAndMinutes(actual)}
                                </div>
                              )}
                              {plannedOnlyTimesheetGrid && frozenCol > 0 && (
                                <div
                                  className={`font-semibold ${tdMuted ? 'text-slate-500 dark:text-neutral-300' : 'text-slate-800 dark:text-white'}`}
                                  title={t.ts_kpi_frozen_official}
                                >
                                  {formatMinutesToHoursAndMinutes(frozenCol)}
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
                      {showFullTimesheetGrid && (
                        <div className="text-xs font-bold text-slate-900 dark:text-white md:text-[10px]">
                          {(() => {
                            const act = visibleUsers.reduce((s, u) => s + (userTotals[u.id]?.actualMins ?? 0), 0);
                            return act > 0 ? formatMinutesToHoursAndMinutes(act) : '';
                          })()}
                        </div>
                      )}
                      {plannedOnlyTimesheetGrid &&
                        (() => {
                          const gf = visibleUsers.reduce((s, u) => s + (userTotals[u.id]?.frozenOfficialMins ?? 0), 0);
                          return gf > 0 ? (
                            <div
                              className="text-xs font-bold text-slate-900 dark:text-white md:text-[10px]"
                              title={t.ts_kpi_frozen_official}
                            >
                              {formatMinutesToHoursAndMinutes(gf)}
                            </div>
                          ) : null;
                        })()}
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
              {(() => {
                const myTot = userTotals[currentUser.id];
                const frozenM = myTot?.frozenOfficialMins ?? 0;
                const gridCols = showFullTimesheetGrid
                  ? 'grid-cols-3'
                  : plannedOnlyTimesheetGrid && frozenM > 0
                    ? 'grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-1';
                const kpiItems = showFullTimesheetGrid
                  ? [
                      {
                        label: t.ts_kpi_planned,
                        val: formatMinutesToHoursAndMinutes(myTot?.plannedMins ?? 0),
                        color: 'text-slate-800',
                      },
                      {
                        label: t.ts_kpi_punched,
                        val:
                          (myTot?.actualMins ?? 0) > 0
                            ? formatMinutesToHoursAndMinutes(myTot?.actualMins ?? 0)
                            : '–',
                        color: 'text-slate-800',
                      },
                      {
                        label: t.ts_kpi_delta,
                        val: `${(myTot?.deltaMins ?? 0) >= 0 ? '+' : ''}${fmtHM(myTot?.deltaMins ?? 0)}`,
                        color: (myTot?.deltaMins ?? 0) >= 0 ? 'text-accent' : 'text-red-500',
                      },
                    ]
                  : plannedOnlyTimesheetGrid && frozenM > 0
                    ? [
                        {
                          label: t.ts_kpi_planned,
                          val: formatMinutesToHoursAndMinutes(myTot?.plannedMins ?? 0),
                          color: 'text-slate-800',
                        },
                        {
                          label: t.ts_kpi_frozen_official,
                          val: formatMinutesToHoursAndMinutes(frozenM),
                          color: 'text-slate-800',
                        },
                      ]
                    : [
                        {
                          label: t.ts_kpi_planned,
                          val: formatMinutesToHoursAndMinutes(myTot?.plannedMins ?? 0),
                          color: 'text-slate-800',
                        },
                      ];
                return (
                  <div className={`grid gap-4 ${gridCols}`}>
                    {kpiItems.map(({ label, val, color }) => (
                      <div key={label}>
                        <p className="text-[10px] text-slate-400 dark:text-neutral-400 uppercase tracking-wide mb-1">{label}</p>
                        <p className={`text-2xl font-bold ${color}`}>{val}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

        </motion.div>
      </div>

      {/* ── Popup centrato: dettaglio turno (stesso schema del tabellone) ── */}
      {isUiWidgetVisible(currentUser, 'timesheet.punch_modal') && (
        <CenteredModalPortal
          open={!!drawerData}
          onClose={closeTimesheetShiftDrawer}
          panelRef={timesheetShiftDetailPanelRef}
          maxWidthClass={
            drawerReviewQueue?.reviewScope === 'employee_week'
              ? 'max-w-sm md:max-w-xl lg:max-w-2xl'
              : 'max-w-sm md:max-w-2xl lg:max-w-4xl'
          }
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
          const isAbsentDraw = s.status === 'absent';
          const canMarkAbsentTimesheet =
            canTimesheetApprove && !isFrozen && !isAbsentDraw && drawerData.dateStr <= todayStr;
          const pinRequiredForTimbrature =
            canTeamTimesheetOps &&
            featureFlags['unlock_with_pin'] !== false &&
            drawerData.dateStr <= todayStr;
          const timbratureEditorEligible =
            canTeamTimesheetOps &&
            !isFrozen &&
            !isAbsentDraw &&
            drawerData.dateStr <= todayStr;
          const canTimbratureInsert = timbratureEditorEligible && !s.punched;
          const canTimbratureEditExisting = timbratureEditorEligible && s.punched && !!s.punchInId;
          const showTimbratureEditForm =
            (canTimbratureInsert || canTimbratureEditExisting) &&
            (!pinRequiredForTimbrature || timbratureEditUnlockedShiftId === s.id);
          /** Click sulla scheda timbrature → PIN (se attivo), poi form inserimento o modifica e salva. */
          const timbraturePinGateTarget =
            pinRequiredForTimbrature &&
            !isAbsentDraw &&
            timbratureEditUnlockedShiftId !== s.id &&
            (isFrozen || timbratureEditorEligible);
          const pinRequiredForShiftEdits =
            canTeamTimesheetOps && featureFlags['unlock_with_pin'] !== false;
          const shiftEditsRevealUnlocked =
            !pinRequiredForShiftEdits || shiftEditsUnlockedShiftId === s.id;
          const punchAuditEntries = drawerData.punchAuditEntries;
          const shiftEdits = drawerData.shiftEdits;
          const drawerHistoryTotalCount = shiftEdits.length + punchAuditEntries.length;
          const drawerHistoryCardTitle =
            shiftEdits.length > 0 && punchAuditEntries.length > 0
              ? `${t.ts_drawer_shift_edits} · ${t.ts_drawer_punch_edits}`
              : shiftEdits.length > 0
                ? t.ts_drawer_shift_edits
                : t.ts_drawer_punch_edits;
          const { dot, border, bg, ring, label, labelCls } = getShiftCardStyle(
            s,
            punchAuditEntries.length,
            drawerData.dateStr,
            fullShift ?? null
          );
          const deltaColor =
            s.deltaMins > 5 ? 'text-accent' : s.deltaMins < -5 ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-neutral-400';
          const isEmployeeWeekReviewSheet = drawerReviewQueue?.reviewScope === 'employee_week';

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

          const pinRequiredForPlannedTimesEdit =
            featureFlags['unlock_with_pin'] !== false &&
            s.status === 'confirmed' &&
            canTeamTimesheetOps &&
            !isFrozen &&
            !isAbsentDraw;
          const showPublishedPlannedTimesEditor =
            s.status === 'confirmed' &&
            canTeamTimesheetOps &&
            !isFrozen &&
            !isAbsentDraw &&
            (!pinRequiredForPlannedTimesEdit || plannedTimesEditUnlockedShiftId === s.id);
          const showPublishedPlannedTimesPinButton =
            pinRequiredForPlannedTimesEdit && plannedTimesEditUnlockedShiftId !== s.id;

          return (
              <div className="flex min-h-0 max-h-full flex-1 flex-col overflow-hidden">
                {/* Drawer header — strip colorato in base allo stato */}
                <div className={`border-l-4 ${border} ${bg} ${ring}`}>
                  <div className="flex items-start justify-between gap-3 px-4 pb-2.5 pt-3 sm:px-5">
                    <div className="relative min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${labelCls}`}>
                          {label}
                        </span>
                        {drawerData.department && (
                          <span
                            className="truncate rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-sm"
                            style={departmentChipStyle(getDeptColor(drawerData.department))}
                          >
                            {translateDepartmentValue(drawerData.department, effectiveLanguage)}
                          </span>
                        )}
                        {isApproved && <Lock className="ml-auto h-3.5 w-3.5 shrink-0 text-accent" />}
                      </div>
                      <h3 className="truncate text-lg font-bold leading-tight text-slate-900 dark:text-neutral-100">
                        {drawerData.employeeName}
                      </h3>
                      <p className="absolute left-[208px] top-0 flex h-[45px] w-[232px] items-center gap-1.5 text-[12px] font-medium text-slate-600 dark:text-neutral-300">
                        <Calendar className="h-5 w-5 shrink-0 opacity-80" strokeWidth={2} />
                        <span className="min-w-0 truncate">
                          {safeFormatDate(drawerData.dateStr, 'EEEE d MMMM yyyy', { locale })}
                        </span>
                      </p>
                      {isEmployeeWeekReviewSheet && drawerReviewQueue && (
                        <p className="mt-1.5 text-[11px] font-semibold text-accent dark:text-accent-light">
                          {formatTrans(t.ts_employee_week_review_progress, {
                            current: String(drawerReviewQueue.currentIdx + 1),
                            total: String(drawerReviewQueue.items.length),
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex max-w-[min(88%,24rem)] shrink-0 items-center justify-end gap-2.5 pt-0.5">
                      <button
                        type="button"
                        onClick={closeTimesheetShiftDrawer}
                        className="shrink-0 rounded-xl p-1.5 transition-colors hover:bg-white/80 dark:hover:bg-white/10"
                        aria-label={t.close}
                      >
                        <X className="h-4 w-4 text-slate-600 dark:text-neutral-300" />
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
                  <div
                    className={
                      isEmployeeWeekReviewSheet
                        ? 'grid grid-cols-1 grid-rows-[auto_auto] items-stretch'
                        : 'grid grid-cols-1 md:grid-cols-2 md:items-stretch md:divide-x md:divide-slate-100 dark:md:divide-white/10'
                    }
                  >
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
                            {showPublishedPlannedTimesEditor ? (
                              <div className="space-y-2.5">
                                <div>
                                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/80">
                                    {t.ts_drawer_planned_start_field}
                                  </p>
                                  <TimeInputField
                                    value={drawerPlannedTimeStart}
                                    onChange={setDrawerPlannedTimeStart}
                                    aria-label={t.ts_drawer_planned_start_field}
                                    className="w-full focus-within:ring-emerald-500"
                                  />
                                </div>
                                <div>
                                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-300/80">
                                    {t.ts_drawer_planned_end_field}
                                  </p>
                                  <TimeInputField
                                    value={drawerPlannedTimeEnd}
                                    onChange={setDrawerPlannedTimeEnd}
                                    aria-label={t.ts_drawer_planned_end_field}
                                    className="w-full focus-within:ring-emerald-500"
                                  />
                                </div>
                                <button
                                  type="button"
                                  disabled={plannedTimesSaving}
                                  onClick={() => void handleSaveDrawerPlannedTimes()}
                                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-40 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                >
                                  {plannedTimesSaving ? (
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                  ) : (
                                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                                  )}
                                  {t.ts_drawer_planned_times_save}
                                </button>
                              </div>
                            ) : (
                              <>
                                <p className={`text-base font-bold tabular-nums ${plannedCardMainCls}`}>
                                  {s.plannedStart}–{s.plannedEnd}
                                </p>
                                <p className={`mt-0.5 text-[11px] ${plannedCardSubCls}`}>
                                  {fmtHM(s.plannedMins)}
                                  {s.breakMinutes > 0 ? (
                                    <span className="opacity-80">
                                      {' '}
                                      (−{fmtBreakDeductionShort(s.breakMinutes)})
                                    </span>
                                  ) : null}
                                </p>
                              </>
                            )}
                            {showPublishedPlannedTimesPinButton ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setPinGateModal({ shiftId: s.id, mode: 'enable_planned_times_edit' });
                                  setPinGatePin('');
                                  setPinGateError('');
                                }}
                                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600/35 bg-white/90 px-2.5 py-2 text-[11px] font-bold text-emerald-900 transition-colors hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-100 dark:hover:bg-emerald-950/50"
                              >
                                <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                {t.ts_drawer_edit_planned_times_btn}
                              </button>
                            ) : null}
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
                            {s.nightRolloverOk && s.actualEndFull && (
                              <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-neutral-400">
                                {formatTrans(t.ts_punch_out_next_calendar_day_hint, {
                                  time: format(new Date(s.actualEndFull), 'dd/MM HH:mm'),
                                })}
                              </p>
                            )}
                            <p
                              className={`mt-0.5 text-[11px] font-semibold ${s.actualMins > 0 && !s.isCrossDay ? deltaColor : 'text-amber-600 dark:text-amber-400'}`}
                            >
                              {s.isCrossDay ? (
                                <>
                                  {t.ts_fix_exit_time_label}
                                  {s.breakMinutes > 0 ? (
                                    <span className="mt-0.5 block font-semibold text-slate-600 dark:text-neutral-400">
                                      −{fmtBreakDeductionShort(s.breakMinutes)}
                                    </span>
                                  ) : null}
                                </>
                              ) : s.actualMins > 0 ? (
                                s.breakMinutesActual > 0 ? (
                                  `${fmtHM(s.actualMins)} (−${fmtBreakDeductionShort(s.breakMinutesActual)})`
                                ) : (
                                  `${fmtHM(s.actualMins)} (${s.deltaMins >= 0 ? '+' : ''}${fmtHM(s.deltaMins)})`
                                )
                              ) : (
                                <>
                                  {t.ts_out_missing_short}
                                  {s.breakMinutes > 0 ? (
                                    <span className="mt-0.5 block font-semibold text-slate-600 dark:text-neutral-400">
                                      −{fmtBreakDeductionShort(s.breakMinutes)}
                                    </span>
                                  ) : null}
                                </>
                              )}
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
                          <>
                            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">{t.ts_status_unpunched}</p>
                            {s.breakMinutes > 0 ? (
                              <p className="mt-1 text-[11px] font-semibold text-slate-600 dark:text-neutral-400">
                                −{fmtBreakDeductionShort(s.breakMinutes)}
                              </p>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>

                    {!isEmployeeWeekReviewSheet &&
                      fullShift &&
                      canTeamTimesheetOps &&
                      !isFrozen &&
                      !isAbsentDraw && (
                      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white/90 shadow-none dark:border-white/10 dark:bg-neutral-900/50">
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-semibold text-slate-800 dark:text-neutral-100">{t.deduct_break_label}</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-neutral-400">
                              {fullShift.deduct_break !== false
                                ? tv.wst_drawer_break_deducted_readout
                                : tv.wst_create_shift_no_deduct_badge}
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={fullShift.deduct_break !== false}
                            aria-label={t.deduct_break_label}
                            disabled={deductBreakSaving}
                            onClick={() =>
                              void handleDrawerDeductBreakChange(s.id, !(fullShift.deduct_break !== false))
                            }
                            className={`relative flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-45 ${
                              fullShift.deduct_break !== false ? 'bg-accent' : 'bg-slate-200 dark:bg-neutral-600'
                            }`}
                          >
                            <span
                              className={`toggle-knob absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                                fullShift.deduct_break !== false ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Ore effettive summary se complete */}
                    {!isEmployeeWeekReviewSheet && s.punched && s.actualEnd && (
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

                  {/* Storico: modifiche turno + audit timbrature — stessa scheda ambra, dettaglio dopo PIN */}
                  {!isEmployeeWeekReviewSheet && drawerHistoryTotalCount > 0 && (
                    <div className="border-b border-slate-100 p-3 dark:border-white/10">
                      <div className="overflow-hidden rounded-xl border-2 border-amber-400/90 bg-white/85 shadow-sm dark:border-amber-500/70 dark:bg-amber-950/50">
                        <button
                          type="button"
                          aria-expanded={shiftEditsRevealUnlocked && drawerShiftEditsExpanded}
                          aria-controls="timesheet-drawer-combined-history"
                          onClick={() => {
                            if (!shiftEditsRevealUnlocked) {
                              setPinGateModal({ shiftId: s.id, mode: 'unlock_shift_edits' });
                              setPinGatePin('');
                              setPinGateError('');
                              return;
                            }
                            setDrawerShiftEditsExpanded((v) => !v);
                          }}
                          className="flex w-full min-h-[2.75rem] items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-amber-50/80 dark:hover:bg-amber-950/40"
                        >
                          {shiftEdits.length === 0 && punchAuditEntries.length > 0 ? (
                            <ShieldAlert className="h-4 w-4 shrink-0 text-orange-500 dark:text-orange-400" aria-hidden />
                          ) : (
                            <History className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-slate-800 dark:text-neutral-100">
                              {drawerHistoryCardTitle}
                            </span>
                            {!shiftEditsRevealUnlocked ? (
                              <span className="mt-0.5 block truncate text-[10px] font-medium text-amber-900/80 dark:text-amber-200/85">
                                {t.ts_enter_manager_pin}
                              </span>
                            ) : null}
                          </div>
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                            {drawerHistoryTotalCount}
                          </span>
                          {shiftEditsRevealUnlocked ? (
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform dark:text-neutral-500 ${drawerShiftEditsExpanded ? 'rotate-180' : ''}`}
                              aria-hidden
                            />
                          ) : (
                            <Lock className="h-4 w-4 shrink-0 text-amber-700/80 dark:text-amber-300/90" aria-hidden />
                          )}
                        </button>
                        {shiftEditsRevealUnlocked && drawerShiftEditsExpanded && (
                          <div
                            id="timesheet-drawer-combined-history"
                            className="flex max-h-[min(48vh,380px)] flex-col gap-2 overflow-y-auto overscroll-contain border-t border-amber-200/80 px-3 pb-3 pt-2.5 dark:border-amber-800/40"
                          >
                            {shiftEdits.length > 0 && (
                              <div className="flex flex-col gap-2">
                                {punchAuditEntries.length > 0 && (
                                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800/90 dark:text-amber-300/90">
                                    <History className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                    {t.ts_drawer_shift_edits}
                                  </p>
                                )}
                                {shiftEdits.map((e) => (
                                  <div
                                    key={e.id}
                                    className="rounded-lg border border-amber-100 bg-amber-50/90 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/35"
                                  >
                                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-neutral-400">
                                      <span className="font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                                        {e.field}
                                      </span>
                                      <span>{format(new Date(e.timestamp), 'dd/MM HH:mm')}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                      <span className="rounded-lg bg-red-50 px-1.5 py-0.5 text-red-600 line-through dark:bg-red-950/50 dark:text-red-300">
                                        {e.oldValue}
                                      </span>
                                      <ArrowRight className="h-3 w-3 shrink-0 text-slate-400 dark:text-neutral-500" />
                                      <span className="rounded-lg bg-accent/10 px-1.5 py-0.5 font-semibold text-accent-dark dark:bg-accent/20 dark:text-accent-light">
                                        {e.newValue}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-[10px] text-slate-500 dark:text-neutral-400">da {e.actorName}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {punchAuditEntries.length > 0 && (
                              <div className="flex flex-col gap-2">
                                {shiftEdits.length > 0 && (
                                  <>
                                    <div
                                      className="my-1 border-t border-amber-200/70 dark:border-amber-800/50"
                                      role="separator"
                                    />
                                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-orange-800/90 dark:text-orange-300/90">
                                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                      {t.ts_drawer_punch_edits}
                                    </p>
                                  </>
                                )}
                                {punchAuditEntries.map((e) => (
                                  <div
                                    key={e.id}
                                    className="rounded-lg border border-orange-100 bg-orange-50/90 p-2.5 dark:border-orange-900/40 dark:bg-orange-950/35"
                                  >
                                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-neutral-400">
                                      <span className="font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                                        {e.field}
                                      </span>
                                      <span>{format(new Date(e.changed_at), 'dd/MM HH:mm')}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                      <span className="rounded-lg bg-red-50 px-1.5 py-0.5 text-red-600 line-through dark:bg-red-950/50 dark:text-red-300">
                                        {fmtAuditValue(e.old_value)}
                                      </span>
                                      <ArrowRight className="h-3 w-3 shrink-0 text-slate-400 dark:text-neutral-500" />
                                      <span className="rounded-lg bg-accent/10 px-1.5 py-0.5 font-semibold text-accent-dark dark:bg-accent/20 dark:text-accent-light">
                                        {fmtAuditValue(e.new_value)}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-[10px] text-slate-500 dark:text-neutral-400">da {e.actor_name}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!isEmployeeWeekReviewSheet &&
                    punchAuditEntries.length === 0 &&
                    shiftEdits.length === 0 && (
                    <div className="border-b border-slate-100 p-5 text-center text-sm text-slate-400 dark:border-white/10 dark:text-neutral-400">
                      <FileEdit className="mx-auto mb-2 h-8 w-8 text-slate-200 dark:text-neutral-600" />
                      {t.ts_drawer_no_edits}
                    </div>
                  )}
                  </div>
                  {!isEmployeeWeekReviewSheet && (
                  <div className="flex min-w-0 flex-col">
                  {/* Timbrature in alto a destra (desktop): form visibile senza scroll nella colonna destra */}
                  {!isAbsentDraw && (
                    <div className="border-b border-slate-100 p-5 dark:border-white/10">
                      <div className="space-y-2 rounded-xl border-2 border-amber-400/90 bg-white/85 p-3.5 shadow-sm dark:border-amber-500/70 dark:bg-amber-950/50">
                        <div
                          className={
                            timbraturePinGateTarget
                              ? '-m-0.5 cursor-pointer rounded-lg p-0.5 transition-colors hover:bg-amber-50/90 dark:hover:bg-amber-950/45'
                              : ''
                          }
                          role={timbraturePinGateTarget ? 'button' : undefined}
                          tabIndex={timbraturePinGateTarget ? 0 : undefined}
                          aria-label={
                            timbraturePinGateTarget
                              ? isFrozen
                                ? t.ts_btn_unlock_to_edit
                                : t.ts_drawer_manual_punches_title
                              : undefined
                          }
                          onClick={
                            timbraturePinGateTarget
                              ? () => {
                                  setPinGateModal({
                                    shiftId: s.id,
                                    mode: isFrozen ? 'unlock_frozen' : 'enable_timbrature',
                                  });
                                  setPinGatePin('');
                                  setPinGateError('');
                                }
                              : undefined
                          }
                          onKeyDown={
                            timbraturePinGateTarget
                              ? (e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setPinGateModal({
                                      shiftId: s.id,
                                      mode: isFrozen ? 'unlock_frozen' : 'enable_timbrature',
                                    });
                                    setPinGatePin('');
                                    setPinGateError('');
                                  }
                                }
                              : undefined
                          }
                        >
                        <div>
                          <h4 className="text-sm font-bold text-amber-950 dark:text-amber-100">{t.ts_drawer_manual_punches_title}</h4>
                          <p className="mt-0.5 text-[11px] font-medium text-amber-900/85 dark:text-amber-200/90">{t.ts_drawer_manual_punches_hint}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <div
                            onPointerDown={
                              showTimbratureEditForm
                                ? (e) => {
                                    if (e.button !== 0) return;
                                    if (e.pointerType === 'mouse') e.preventDefault();
                                    if (!drawerManualPunchFormExpanded) {
                                      setDrawerManualPunchFormExpanded(true);
                                      requestAnimationFrame(() => focusManualPunchHourFromSummary('in'));
                                      return;
                                    }
                                    focusManualPunchHourFromSummary('in');
                                  }
                                : undefined
                            }
                            className={`rounded-lg bg-white/80 px-3 py-2.5 ring-1 ring-amber-200/80 dark:bg-neutral-900/40 dark:ring-amber-800/50 ${
                              showTimbratureEditForm
                                ? 'cursor-pointer transition-colors hover:bg-amber-50/90 dark:hover:bg-amber-950/55'
                                : ''
                            }`}
                          >
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
                          <div
                            onPointerDown={
                              showTimbratureEditForm
                                ? (e) => {
                                    if (e.button !== 0) return;
                                    if (e.pointerType === 'mouse') e.preventDefault();
                                    if (!drawerManualPunchFormExpanded) {
                                      setDrawerManualPunchFormExpanded(true);
                                      requestAnimationFrame(() => focusManualPunchHourFromSummary('out'));
                                      return;
                                    }
                                    focusManualPunchHourFromSummary('out');
                                  }
                                : undefined
                            }
                            className={`rounded-lg bg-white/80 px-3 py-2.5 ring-1 ring-amber-200/80 dark:bg-neutral-900/40 dark:ring-amber-800/50 ${
                              showTimbratureEditForm
                                ? 'cursor-pointer transition-colors hover:bg-amber-50/90 dark:hover:bg-amber-950/55'
                                : ''
                            }`}
                          >
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
                            {s.nightRolloverOk && s.actualEndFull && s.actualEnd && (
                              <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-neutral-400">
                                {formatTrans(t.ts_punch_out_next_calendar_day_hint, {
                                  time: format(new Date(s.actualEndFull), 'dd/MM HH:mm'),
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                        </div>
                      {showTimbratureEditForm && drawerManualPunchFormExpanded && (
                        <div className="space-y-3 border-t border-amber-200/80 pt-3 dark:border-amber-800/40">
                          <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800/70 dark:text-amber-300/80">
                              {t.ts_drawer_manual_punch_in}
                            </p>
                            <TimeInputField
                              value={manualPunchIn}
                              onChange={setManualPunchIn}
                              hourInputRef={manualPunchInHourRef}
                              onMinutesEnter={() => {
                                manualPunchOutHourRef.current?.focus();
                                manualPunchOutHourRef.current?.select();
                              }}
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
                              tabIndex={-1}
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
                              hourInputRef={manualPunchOutHourRef}
                              onMinutesEnter={() => {
                                if (manualPunchSaving) return;
                                void handleDrawerSaveTimbratures();
                              }}
                              aria-label={t.ts_drawer_manual_punch_out}
                              className="w-full focus-within:ring-amber-500"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={manualPunchSaving}
                            onClick={() => void handleDrawerSaveTimbratures()}
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
                      {canTeamTimesheetOps &&
                        !isFrozen &&
                        !isAbsentDraw &&
                        (s.punched || !!s.punchInId) &&
                        drawerData.dateStr <= todayStr && (
                          <div className="border-t border-amber-200/80 pt-3 dark:border-amber-800/40">
                            <button
                              type="button"
                              disabled={manualPunchSaving}
                              onClick={() => {
                                if (featureFlags['unlock_with_pin'] !== false) {
                                  setPinGateModal({ shiftId: s.id, mode: 'delete_punches' });
                                  setPinGatePin('');
                                  setPinGateError('');
                                  return;
                                }
                                if (!window.confirm(t.ts_delete_punches_confirm)) return;
                                void (async () => {
                                  try {
                                    await deletePunchRecordsForShift(s.id);
                                    showSuccess?.(t.ts_toast_punches_deleted);
                                    closeTimesheetShiftDrawer();
                                  } catch {
                                    showError?.(t.save_error);
                                  }
                                })();
                              }}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-40 dark:border-red-900/55 dark:bg-amber-950/30 dark:text-red-300 dark:hover:bg-red-950/40"
                            >
                              <Trash2 className="h-3.5 w-3.5 shrink-0" />
                              {t.ts_drawer_delete_punches_btn}
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
                  </div>
                  )}
                  </div>
                </div>

                {/* Drawer footer – azioni (barra revisione inclusa nello stesso pannello) */}
                {canTeamTimesheetOps &&
                  !isApproved &&
                  (!isAbsentDraw ||
                    (drawerReviewQueue?.reviewScope === 'employee_week' && isAbsentDraw)) && (
                  <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] dark:border-white/10 dark:bg-neutral-900 sm:gap-2.5 sm:p-3.5">
                    {drawerReviewQueue &&
                      (() => {
                        const hasMissingInReview = !s.punchInId;
                        const inHm = (manualPunchIn || '').trim().slice(0, 5);
                        const outHm = (manualPunchOut || '').trim().slice(0, 5);
                        const inOk = /^\d{1,2}:\d{2}$/.test(inHm);
                        const outOk = /^\d{1,2}:\d{2}$/.test(outHm);
                        const resolvedReviewOutDate = resolveTimesheetPunchOutDateStr(
                          drawerData.dateStr,
                          manualPunchOutDate || undefined,
                          manualPunchIn,
                          manualPunchOut
                        );
                        const dateOk =
                          !!resolvedReviewOutDate && /^\d{4}-\d{2}-\d{2}$/.test(resolvedReviewOutDate);
                        const reviewFormComplete = inOk && outOk && dateOk;
                        const skipAbsentInWeekQueue =
                          isEmployeeWeekReviewSheet && s.status === 'absent';
                        const canReviewSave =
                          skipAbsentInWeekQueue ||
                          (reviewFormComplete &&
                            (hasMissingInReview
                              ? isEmployeeWeekReviewSheet || showTimbratureEditForm
                              : true));
                        return (
                          <div
                            className={
                              isEmployeeWeekReviewSheet
                                ? ''
                                : 'border-b border-slate-100 pb-2 dark:border-white/10'
                            }
                          >
                            <div
                              className={
                                isEmployeeWeekReviewSheet
                                  ? 'flex w-full flex-col gap-2'
                                  : 'flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2'
                              }
                            >
                              {!isEmployeeWeekReviewSheet ? (
                                <p className="text-[9px] font-medium leading-snug text-slate-500 dark:text-neutral-400 sm:max-w-[50%] sm:pr-1">
                                  {t.ts_review_queue_bar_hint}
                                </p>
                              ) : (
                                <span className="sr-only">{t.ts_review_queue_bar_hint}</span>
                              )}
                              <div
                                className={
                                  isEmployeeWeekReviewSheet
                                    ? 'flex w-full shrink-0 items-stretch justify-stretch'
                                    : 'flex shrink-0 items-stretch gap-1.5 sm:justify-end'
                                }
                              >
                                {!isEmployeeWeekReviewSheet && (
                                  <button
                                    type="button"
                                    onClick={() => handleDrawerReviewNavigate(-1)}
                                    disabled={drawerReviewQueue.currentIdx === 0 || reviewQueueSaving}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700/80"
                                  >
                                    ←
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={reviewQueueSaving || manualPunchSaving || !canReviewSave}
                                  onClick={() => void handleDrawerReviewSaveAndNext()}
                                  className={
                                    isEmployeeWeekReviewSheet
                                      ? 'flex h-10 min-h-10 w-full items-center justify-center gap-1 rounded-lg bg-accent px-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50'
                                      : 'flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-accent px-2.5 text-xs font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50 sm:min-w-[9.5rem] sm:flex-none sm:px-3'
                                  }
                                >
                                  {reviewQueueSaving || manualPunchSaving ? (
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5 shrink-0" />
                                  )}
                                  <span className="truncate">
                                    {drawerReviewQueue.currentIdx < drawerReviewQueue.items.length - 1
                                      ? t.ts_btn_save_and_next
                                      : t.ts_btn_save_and_close}
                                  </span>
                                </button>
                                {!isEmployeeWeekReviewSheet &&
                                  drawerReviewQueue.currentIdx < drawerReviewQueue.items.length - 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleDrawerReviewNavigate(1)}
                                      disabled={reviewQueueSaving}
                                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700/80"
                                    >
                                      →
                                    </button>
                                  )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    {!isEmployeeWeekReviewSheet && canMarkAbsentTimesheet && (
                      <button
                        type="button"
                        disabled={markAbsentSaving}
                        onClick={() => {
                          if (!window.confirm(t.shift_mark_absent_confirm)) return;
                          void (async () => {
                            setMarkAbsentSaving(true);
                            try {
                              await updateShift(s.id, { approval_status: 'absent' });
                              showSuccess?.(t.shift_marked_absent_toast);
                              closeTimesheetShiftDrawer();
                            } catch (e) {
                              const raw =
                                e && typeof e === 'object' && 'message' in e
                                  ? String((e as { message?: string }).message || '')
                                  : '';
                              const low = raw.toLowerCase();
                              const dbHint =
                                low.includes('check') ||
                                low.includes('constraint') ||
                                low.includes('violates') ||
                                low.includes('absent');
                              showError?.(
                                dbHint && (t as Record<string, string>).shift_mark_absent_db_hint
                                  ? `${(t as Record<string, string>).shift_mark_absent_db_hint} ${raw ? `(${raw})` : ''}`
                                  : raw || t.save_error
                              );
                            } finally {
                              setMarkAbsentSaving(false);
                            }
                          })();
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/55"
                      >
                        {markAbsentSaving ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-rose-400/50 border-t-rose-800 dark:border-t-rose-100" />
                        ) : (
                          <UserX className="h-4 w-4" />
                        )}
                        {t.shift_mark_absent}
                      </button>
                    )}

                    {!isEmployeeWeekReviewSheet && canClose && (
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
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600">
                        <LogOut className="w-4 h-4" />
                        {t.ts_btn_close_shift_insert_out}
                      </button>
                    )}
                    {!isEmployeeWeekReviewSheet && !canClose && !canMarkAbsentTimesheet && (
                      <p className="py-0.5 text-center text-[11px] text-slate-400 dark:text-neutral-400">
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
                        <button
                          type="button"
                          onClick={() => {
                            setPinGateModal({ shiftId: s.id, mode: 'unlock_frozen' });
                            setPinGatePin('');
                            setPinGateError('');
                          }}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          {t.ts_btn_unlock_to_edit}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
          );
        })()}
      </CenteredModalPortal>
    )}

      <CenteredModalPortal
        open={!!pinGateModal}
        onClose={() => {
          if (pinGateUnlocking) return;
          setPinGateModal(null);
          setPinGatePin('');
          setPinGateError('');
        }}
        overlayZClass="z-[10060]"
        ariaLabel={t.ts_enter_manager_pin}
        maxWidthClass="max-w-sm"
        panelClassName="p-0"
      >
        {pinGateModal ? (
          <div
            className="p-5"
            onMouseDown={(e) => {
              const t = e.target as HTMLElement;
              if (t.closest('button') || t.closest('#timesheet-pin-gate-input')) return;
              pinGateKeyboardInputRef.current?.focus({ preventScroll: true });
            }}
          >
            <label htmlFor="timesheet-pin-gate-input" className="sr-only">
              {t.ts_enter_manager_pin}
            </label>
            <input
              id="timesheet-pin-gate-input"
              ref={pinGateKeyboardInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              aria-invalid={!!pinGateError}
              disabled={pinGateUnlocking}
              value={pinGatePin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPinGatePin(v);
                setPinGateError('');
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (pinGateUnlocking || pinGatePin.length < 4) return;
                void submitTimbraturePinGate(pinGatePin);
              }}
              className="sr-only"
              tabIndex={0}
            />
            <h3 className="text-center text-base font-bold text-slate-900 dark:text-neutral-100">
              {pinGateModal.mode === 'unlock_frozen'
                ? t.ts_btn_unlock_to_edit
                : pinGateModal.mode === 'unlock_shift_edits'
                  ? t.ts_drawer_shift_edits
                  : pinGateModal.mode === 'delete_punches'
                    ? t.ts_delete_punches_pin_title
                    : pinGateModal.mode === 'enable_planned_times_edit'
                      ? t.ts_drawer_edit_planned_times_pin_title
                      : t.ts_drawer_manual_punches_title}
            </h3>
            {pinGateModal.mode === 'delete_punches' ? (
              <p className="mt-2 px-1 text-center text-[11px] font-medium leading-snug text-red-600/95 dark:text-red-300/90">
                {t.ts_delete_punches_confirm}
              </p>
            ) : null}
            <p className="mt-1 text-center text-[11px] text-slate-500 dark:text-neutral-400">{t.ts_enter_manager_pin}</p>
            <div className="mt-4 flex justify-center gap-2">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full border-2 ${
                    i < pinGatePin.length
                      ? 'border-accent bg-accent dark:border-accent-light dark:bg-accent-light'
                      : 'border-slate-300 bg-transparent dark:border-neutral-600'
                  }`}
                />
              ))}
            </div>
            {pinGateError ? (
              <p className="mt-2 text-center text-xs font-semibold text-red-500">{pinGateError}</p>
            ) : null}
            {pinGateUnlocking ? (
              <p className="mt-2 text-center text-[11px] text-accent">{t.ts_unlocking}</p>
            ) : null}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={pinGateUnlocking || pinGatePin.length >= 4}
                  onClick={() => {
                    if (pinGatePin.length >= 4) return;
                    setPinGateError('');
                    setPinGatePin((p) => (p + d).slice(0, 4));
                    queueMicrotask(() =>
                      pinGateKeyboardInputRef.current?.focus({ preventScroll: true })
                    );
                  }}
                  className="rounded-xl border border-slate-200 bg-white py-3 text-lg font-bold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                disabled={pinGateUnlocking}
                onClick={() => {
                  setPinGatePin((p) => p.slice(0, -1));
                  setPinGateError('');
                  queueMicrotask(() =>
                    pinGateKeyboardInputRef.current?.focus({ preventScroll: true })
                  );
                }}
                className="rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                ⌫
              </button>
              <button
                type="button"
                disabled={pinGateUnlocking || pinGatePin.length >= 4}
                onClick={() => {
                  if (pinGatePin.length >= 4) return;
                  setPinGateError('');
                  setPinGatePin((p) => (p + '0').slice(0, 4));
                  queueMicrotask(() =>
                    pinGateKeyboardInputRef.current?.focus({ preventScroll: true })
                  );
                }}
                className="rounded-xl border border-slate-200 bg-white py-3 text-lg font-bold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
              >
                0
              </button>
              <button
                type="button"
                disabled={pinGateUnlocking || pinGatePin.length < 4}
                onClick={() => void submitTimbraturePinGate(pinGatePin)}
                className="rounded-xl bg-accent py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
              >
                OK
              </button>
            </div>
            <button
              type="button"
              disabled={pinGateUnlocking}
              onClick={() => {
                setPinGateModal(null);
                setPinGatePin('');
                setPinGateError('');
              }}
              className="mt-4 w-full text-center text-[11px] text-slate-400 transition-colors hover:text-slate-600 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              {t.cancel}
            </button>
          </div>
        ) : null}
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
          const clockOutComplete = /^\d{2}:\d{2}$/.test((clockOutTime || '').trim());
          const showHoursPreview = clockOutComplete && !!shiftObj && !!userObj;
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

                {showHoursPreview && (
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

      {/* ── Modal conferma congelo: portal su body così sta sopra CenteredModalPortal (z-10050); #root ha stacking separato. */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {approvalConfirm && (() => {
              const ac = approvalConfirm;
              return (
                <PinPadModal
                  title={t.sync_lock_title}
                  subtitle={t.ts_enter_manager_pin}
                  pinLabel={t.ts_approval_pin_label}
                  pin={approvalPin}
                  onPinChange={(p) => (setApprovalPin(p), setApprovalPinError(''))}
                  onConfirm={async () => {
                    const verifier = findFreezeVerifierByPin(users, approvalPin);
                    if (!verifier) {
                      setApprovalPinError(t.ts_approval_pin_invalid);
                      setApprovalPin('');
                      return;
                    }
                    setApprovalConfirm(null);
                    await handleApproveShift(ac.shiftId, verifier, {
                      afterSuccess:
                        ac.afterFreeze === 'advance_review' ? 'advance_review' : 'close_drawer',
                    });
                  }}
                  onCancel={() => {
                    setApprovalConfirm(null);
                    setApprovalPin('');
                    setApprovalPinError('');
                  }}
                  error={approvalPinError}
                  isLoading={approvingShiftId === ac.shiftId}
                  confirmLabel={t.ts_btn_yes_approve_freeze}
                  cancelLabel={t.cancel}
                />
              );
            })()}
            {employeeWeekFreezeBatch && (() => {
              const batch = employeeWeekFreezeBatch;
              const tv = t as Record<string, string>;
              return (
                <PinPadModal
                  title={t.sync_lock_title}
                  subtitle={tv.ts_employee_week_freeze_batch_title ?? 'Congela turni revisionati'}
                  pinLabel={t.ts_approval_pin_label}
                  pin={approvalPin}
                  onPinChange={(p) => (setApprovalPin(p), setApprovalPinError(''))}
                  onConfirm={() => void runEmployeeWeekBatchFreeze()}
                  onCancel={() => {
                    setEmployeeWeekFreezeBatch(null);
                    setApprovalPin('');
                    setApprovalPinError('');
                    showSuccess?.(
                      tv.ts_employee_week_review_skipped_freeze ??
                        'Revisione completata senza congelare i turni.'
                    );
                  }}
                  error={approvalPinError}
                  isLoading={employeeWeekFreezeBusy}
                  confirmLabel={tv.ts_employee_week_freeze_batch_cta ?? t.ts_btn_yes_approve_freeze}
                  cancelLabel={t.cancel}
                />
              );
            })()}
          </AnimatePresence>,
          document.body
        )}

    </>
  );
}
