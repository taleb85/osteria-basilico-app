import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays, AlertTriangle, Check, Lock, Plus, Clock,
  ChevronLeft, ChevronRight, Copy, Send, Filter, FileDown,
  Trash2, Save, X, ShieldAlert, ChevronDown, Unlock, Menu,
} from 'lucide-react';
import { CenteredModalPortal } from './ui/CenteredModalPortal';
import type { Shift, PunchRecord, User } from '../types';
import type { BreakRule } from '../utils/breakRules';
import {
  format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, parseISO,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { getTranslations, getDateLocale } from '../utils/translations';
import { formatMinutesToHoursAndMinutes, calculateShiftMinutesGross, getBreakLabels, hasShiftConflictSameDay } from '../utils/timeCalculations';
import { getBreakMinutesForShift, getNetShiftMinutes, DEFAULT_AUTO_BREAK_MINUTES, AUTO_BREAK_THRESHOLD_MINUTES } from '../utils/breakRules';
import { shiftPastPlannedEndWithoutClockIn, punchTimeHHMM, getResolvedStartEndForHours } from '../utils/shiftResolvedClockTimes';
import { exportSchedulePDF } from '../utils/exportSchedulePDF';
import { TimeInputField } from './ui/TimeInputField';
import { ShiftSlotPresetsSection } from './shifts/ShiftSlotPresetsSection';
import { database } from '../lib/database';
import { useApp } from '../context/AppContext';
import { isManagementRole, isPurelyManagementRole, canEditTeamShifts, canPublishScheduleDrafts, canApproveShiftActions, findFreezeVerifierByPin } from '../utils/permissions';
import { getShiftViolations, DEFAULT_WORK_RULES } from '../utils/workRules';
import { isShiftPayrollFrozen } from '../utils/timesheetFreezeCriteria';
import { PinPadModal } from './ui/PinPadModal';
import {
  loadPeriodConfig, savePeriodConfig, getPeriodStartDate, getPeriodEndDate,
  nextPeriodConfig, prevPeriodConfig, periodConfigForMonth,
  type PeriodConfig,
} from '../utils/periodConfig';
import {
  getShiftSlotFromStartTime,
  getShiftTypeFromStartTime,
  loadShiftSlotPresets,
} from '../utils/shiftSlotPresets';

export type GridMode = 'planning' | 'realtime';
type ViewMode = 'week' | 'period';

interface DayShiftGroup {
  shift: Shift;
  punchIn?: PunchRecord;
  punchOut?: PunchRecord;
  actualMinutes: number;
  deltaMinutes: number;
  isAbsent: boolean;
  isMissingPunch: boolean;
  breakMinutes: number;
  actualBreakMinutes: number;
  netMinutes: number;
  violations?: ReturnType<typeof getShiftViolations>;
}

function isFrozen(shift: Shift) {
  return (shift as any).approval_status === 'approved' || ((shift as any).approval_status === 'confirmed' && !!(shift as any).approved_at);
}

function splitDayGroupsBySlot(groups: DayShiftGroup[]) {
  const lunchGroups = groups.filter(g => getShiftSlotFromStartTime(g.shift.start_time ?? '10:00') === 'lunch');
  const eveningGroups = groups.filter(g => getShiftSlotFromStartTime(g.shift.start_time ?? '18:00') === 'evening');
  return {
    lunch: lunchGroups[0] ?? null,
    evening: eveningGroups[0] ?? null,
    extraLunchGroups: lunchGroups.slice(1),
    extraEveningGroups: eveningGroups.slice(1),
  };
}

function isExtraShiftInDay(shift: Shift, dayShifts: Shift[]): boolean {
  const slot = getShiftSlotFromStartTime(shift.start_time ?? '10:00');
  const sameSlot = dayShifts
    .filter(s => getShiftSlotFromStartTime(s.start_time ?? '10:00') === slot)
    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
  return sameSlot.length > 1 && sameSlot[0]?.id !== shift.id;
}

function formatShiftTimeRangeCompact(start?: string | null, end?: string | null): string {
  const fmt = (raw?: string | null) => {
    const t = (raw || '').slice(0, 5);
    if (!t) return '?';
    const [h, m] = t.split(':');
    return m === '00' ? h : t;
  };
  return `${fmt(start)}-${fmt(end)}`;
}

function formatShiftTimeRangeFull(start?: string | null, end?: string | null): string {
  const s = (start || '').slice(0, 5) || '--';
  const e = (end || '').slice(0, 5) || '--';
  return `${s}-${e}`;
}

type ShiftCellDisplay = {
  main: string;
  title?: string;
  breakSuffix?: string;
  missingOut?: boolean;
};

function getShiftCellDisplay(
  g: DayShiftGroup,
  mode: GridMode,
  punchRecords: PunchRecord[],
  compact = false,
): ShiftCellDisplay {
  const planned = formatShiftTimeRangeFull(g.shift.start_time, g.shift.end_time);
  if (g.isAbsent) return { main: 'Assente' };

  if (mode === 'planning') {
    return {
      main: compact ? formatShiftTimeRangeCompact(g.shift.start_time, g.shift.end_time) : planned,
      breakSuffix: g.breakMinutes > 0 ? `−${g.breakMinutes}m` : undefined,
    };
  }

  const shift = g.shift;
  const approvedStart = shift.approved_start_time?.slice(0, 5);
  const approvedEnd = shift.approved_end_time?.slice(0, 5);
  if (shift.approved_at && approvedStart && approvedEnd) {
    return {
      main: compact
        ? formatShiftTimeRangeCompact(approvedStart, approvedEnd)
        : formatShiftTimeRangeFull(approvedStart, approvedEnd),
      title: `Pianificato: ${planned}`,
      breakSuffix: g.actualBreakMinutes > 0 ? `−${g.actualBreakMinutes}m` : undefined,
    };
  }

  const inT = g.punchIn ? punchTimeHHMM(g.punchIn.calculated_time || g.punchIn.timestamp) ?? null : null;
  const outT = g.punchOut ? punchTimeHHMM(g.punchOut.calculated_time || g.punchOut.timestamp) ?? null : null;

  if (inT && outT) {
    const mainFull = `${inT}-${outT}`;
    return {
      main: compact ? formatShiftTimeRangeCompact(inT, outT) : mainFull,
      title: mainFull !== planned ? `Pianificato: ${planned}` : undefined,
      breakSuffix: g.actualBreakMinutes > 0 ? `−${g.actualBreakMinutes}m` : undefined,
    };
  }

  if (inT) {
    return {
      main: `${inT}→`,
      title: `Pianificato: ${planned}`,
      missingOut: true,
    };
  }

  if (g.isMissingPunch) {
    return {
      main: compact ? formatShiftTimeRangeCompact(shift.start_time, shift.end_time) : planned,
      title: 'Timbratura mancante',
    };
  }

  const { start, end } = getResolvedStartEndForHours(shift, punchRecords);
  return {
    main: compact ? formatShiftTimeRangeCompact(start, end) : formatShiftTimeRangeFull(start, end),
    breakSuffix: g.breakMinutes > 0 ? `−${g.breakMinutes}m` : undefined,
  };
}
type ShiftDetailTab = 'details' | 'punches' | 'history' | 'breaks';
const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function useT() {
  const { effectiveLanguage } = useApp();
  return getTranslations(effectiveLanguage);
}

export default function UnifiedShiftGrid({ mode, onModeChange, filterUserId }: { mode: GridMode; onModeChange: (m: GridMode) => void; filterUserId?: string }) {
  const t = useT();
  const {
    currentUser, users, shifts: allShifts, punchRecords: allPunchRecords,
    effectiveLanguage, showSuccess, showError, breakRules,
    deleteShift, approveShift, bulkCopyPreviousWeek, publishWeekShifts,
    addPunchRecord, updatePunchRecord, addShift, updateShift, featureFlags,
  } = useApp();
  const locale = getDateLocale(effectiveLanguage) ?? it;
  const today = new Date();
  const canEdit = currentUser ? canEditTeamShifts(currentUser) : false;
  const canPublish = currentUser ? canPublishScheduleDrafts(currentUser) : false;
  const canApprove = currentUser ? canApproveShiftActions(currentUser) : false;
  const isMgmt = currentUser ? isManagementRole(currentUser.role) : false;
  const canDeleteShift = useCallback((shift: Shift) => {
    if (!canEdit) return false;
    if (shift.approval_status === 'absent') return false;
    if (isMgmt) return true;
    return !isShiftPayrollFrozen(shift);
  }, [canEdit, isMgmt]);
  const effectiveWorkRules = DEFAULT_WORK_RULES;
  const violationChromeEnabled = featureFlags?.violation_rules !== false;

  const [periodConfig, setPeriodConfigState] = useState<PeriodConfig>(() => loadPeriodConfig());
  const [periodNavOffset, setPeriodNavOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const effectivePeriod = periodNavOffset === 0 ? periodConfig
    : periodNavOffset > 0
      ? Array.from({ length: periodNavOffset }, () => null).reduce((p) => nextPeriodConfig(p), periodConfig)
      : Array.from({ length: -periodNavOffset }, () => null).reduce((p) => prevPeriodConfig(p), periodConfig);

  const periodStart = getPeriodStartDate(effectivePeriod);
  const periodEnd = getPeriodEndDate(effectivePeriod);

  const weekDays = viewMode === 'period'
    ? eachDayOfInterval({ start: periodStart, end: periodEnd })
    : eachDayOfInterval({ start: weekStart, end: weekEnd });

  const [showPeriodPopover, setShowPeriodPopover] = useState(false);
  const [periodPopoverYear, setPeriodPopoverYear] = useState(today.getFullYear());
  const [periodPopoverStyle, setPeriodPopoverStyle] = useState<React.CSSProperties>({});
  const periodTriggerRef = useRef<HTMLButtonElement>(null);
  const periodPopoverRef = useRef<HTMLDivElement>(null);

  // ── Department filter ──
  const [deptFilter, setDeptFilter] = useState<string | null>(null);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPeriodPopover) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!periodPopoverRef.current?.contains(t) && !periodTriggerRef.current?.contains(t)) {
        setShowPeriodPopover(false);
      }
    };
    const id = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => { clearTimeout(id); document.removeEventListener('click', handler); };
  }, [showPeriodPopover]);

  useEffect(() => {
    if (!deptDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!deptDropdownRef.current?.contains(e.target as Node)) {
        setDeptDropdownOpen(false);
      }
    };
    const id = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => { clearTimeout(id); document.removeEventListener('click', handler); };
  }, [deptDropdownOpen]);

  const togglePeriodPopover = useCallback(() => {
    setShowPeriodPopover(prev => {
      if (!prev && periodTriggerRef.current) {
        const rect = periodTriggerRef.current.getBoundingClientRect();
        const popoverWidth = Math.min(340, window.innerWidth - 32);
        const popoverHeight = 300;
        const gap = 6;

        let top: number;
        if (rect.bottom + gap + popoverHeight > window.innerHeight) {
          top = Math.max(8, rect.top - gap - popoverHeight);
        } else {
          top = rect.bottom + gap;
        }

        const centerX = rect.left + rect.width / 2;
        const minLeft = popoverWidth / 2 + 16;
        const maxLeft = window.innerWidth - popoverWidth / 2 - 16;
        const left = Math.min(maxLeft, Math.max(minLeft, centerX));

        setPeriodPopoverStyle({ top, left });
      }
      return !prev;
    });
  }, []);

  const applyPeriod = useCallback((cfg: PeriodConfig) => {
    savePeriodConfig(cfg);
    setPeriodConfigState(cfg);
    setPeriodNavOffset(0);
    setWeekStart(startOfWeek(getPeriodStartDate(cfg), { weekStartsOn: 1 }));
    setShowPeriodPopover(false);
  }, []);

  // ── Detail drawer state ──
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerIsExtraShift, setDrawerIsExtraShift] = useState(false);
  const [drawerDeleteConfirm, setDrawerDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!drawerOpen) setDrawerDeleteConfirm(false);
  }, [drawerOpen]);
  const [detailTab, setDetailTab] = useState<ShiftDetailTab>('details');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  // ── Create shift modal state ──
  const [createModal, setCreateModal] = useState<{ userId: string; date: string } | null>(null);
  const [createStart, setCreateStart] = useState('10:00');
  const [createEnd, setCreateEnd] = useState('16:00');

  // ── Manual punch / break edit state ──
  const [editIn, setEditIn] = useState('');
  const [editOut, setEditOut] = useState('');
  const [saving, setSaving] = useState(false);
  const [deductBreak, setDeductBreak] = useState(true);
  const [isAutoBreak, setIsAutoBreak] = useState(true);
  const editOutHourRef = useRef<HTMLInputElement>(null);

  // ── Selection / Bulk edit ──
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditStatus, setBulkEditStatus] = useState<string>('');

  // ── Template state ──
  const [templatesList, setTemplatesList] = useState<string[]>([]);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [actionsDrawerOpen, setActionsDrawerOpen] = useState(false);
  const [actionsDrawerSection, setActionsDrawerSection] = useState<'templates' | null>(null);
  const actionsDrawerTriggerRef = useRef<HTMLDivElement>(null);
  const actionsDrawerPanelRef = useRef<HTMLDivElement>(null);

  const closeActionsDrawer = useCallback(() => {
    setActionsDrawerOpen(false);
    setActionsDrawerSection(null);
  }, []);

  useEffect(() => {
    if (!actionsDrawerOpen) return;
    const handler = (e: MouseEvent) => {
      const tgt = e.target as Node;
      if (
        !actionsDrawerPanelRef.current?.contains(tgt) &&
        !actionsDrawerTriggerRef.current?.contains(tgt)
      ) {
        closeActionsDrawer();
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [actionsDrawerOpen, closeActionsDrawer]);

  // ── Freeze / PinPad state ──
  const [panelPinModalOpen, setPanelPinModalOpen] = useState(false);
  const [panelPinTargetShiftId, setPanelPinTargetShiftId] = useState<string | null>(null);
  const [panelPinError, setPanelPinError] = useState('');
  const [panelPin, setPanelPin] = useState('');

  useEffect(() => {
    try {
      if (typeof database !== 'undefined' && database?.shiftTemplates?.listAll) {
        database.shiftTemplates.listAll().then((list: any) => {
          if (Array.isArray(list)) setTemplatesList(list);
        }).catch(() => {});
      }
    } catch {}
  }, []);

  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));
  const goToday = () => {
    setPeriodNavOffset(0);
    setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
  };

  const visibleUsers = filterUserId
    ? users.filter(u => u.id === filterUserId)
    : users.filter(u => u.status === 'active')
      .filter(u => !isPurelyManagementRole(u.role))
      .filter(u => !deptFilter || u.department === deptFilter);

  const weekDateStrings = weekDays.map(d => format(d, 'yyyy-MM-dd'));
  const weekShifts = allShifts.filter(s => weekDateStrings.includes(s.date) && (!filterUserId || s.user_id === filterUserId));
  const weekPunchRecords = allPunchRecords.filter(pr => weekDateStrings.some(ds => pr.timestamp?.startsWith(ds)));
  const departments = [...new Set(users.filter(u => u.department).map(u => u.department as string))];

  const dayCount = weekDays.length;
  const isPeriodView = viewMode === 'period';
  const employeeColWidth = 112;
  const totalColWidth = 72;
  const dayColMinWidth = isPeriodView ? 80 : 112;
  const tableMinWidth = employeeColWidth + totalColWidth + dayCount * dayColMinWidth;
  const dayColCalc = `calc((100% - ${employeeColWidth + totalColWidth}px) / ${dayCount})`;
  const slotCellHeight = isPeriodView ? 56 : dayCount > 7 ? 56 : 72;
  const slotRowHeight = Math.floor(slotCellHeight / 2);
  const extraRowHeight = 16;
  const compactGrid = isPeriodView || dayCount > 7;

  function getPunchForShift(shift: Shift) {
    const exact = weekPunchRecords.filter(pr => pr.shift_id === shift.id);
    if (exact.length > 0) {
      const sorted = [...exact].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const pIn = sorted.find(p => p.type === 'in');
      const pOut = [...sorted].reverse().find(p => p.type === 'out');
      if (pIn && !pIn.timestamp?.startsWith(shift.date)) {
        return { in: undefined, out: undefined };
      }
      return { in: pIn, out: pOut };
    }
    return { in: undefined, out: undefined };
  }

  function getDayGroup(userId: string, dateStr: string): DayShiftGroup[] {
    return weekShifts.filter(s => s.user_id === userId && s.date === dateStr).map(shift => {
      const { in: punchIn, out: punchOut } = getPunchForShift(shift);
      const plannedMins = calculateShiftMinutesGross(shift.start_time ?? '', shift.end_time ?? '');
      const actualMins = punchIn && punchOut
        ? Math.abs(new Date(punchOut.calculated_time || punchOut.timestamp).getTime() - new Date(punchIn.calculated_time || punchIn.timestamp).getTime()) / 60000 : 0;
      const breakMins = getBreakMinutesForShift(shift, plannedMins, null, breakRules);
      const actualBreakMins = (() => {
        const gross = Math.round(actualMins);
        if (gross < AUTO_BREAK_THRESHOLD_MINUTES) return 0;
        if (shift.deduct_break === false) return 0;
        const st = (shift.start_time || '').slice(0, 5);
        const en = (shift.end_time || '').slice(0, 5);
        if (!st || !en) return 0;
        const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
        if (toMin(en) <= toMin(st)) return 0;
        const mealKeys = getBreakLabels(st, en);
        return mealKeys.length > 0 ? mealKeys.length * DEFAULT_AUTO_BREAK_MINUTES : DEFAULT_AUTO_BREAK_MINUTES;
      })();
      const actualNet = Math.max(0, Math.round(actualMins) - actualBreakMins);
      const plannedNet = Math.max(0, plannedMins - breakMins);
      const violations = violationChromeEnabled ? getShiftViolations(shift, weekShifts, weekDateStrings[0] ?? '', weekDateStrings[weekDateStrings.length - 1] ?? '', effectiveWorkRules, { breakRules }) : undefined;
      return {
        shift, punchIn, punchOut, actualMinutes: actualNet, deltaMinutes: actualNet - plannedNet,
        isAbsent: shift.approval_status === 'absent', isMissingPunch: !punchIn && shiftPastPlannedEndWithoutClockIn(shift, allPunchRecords),
        breakMinutes: breakMins, actualBreakMinutes: actualBreakMins, netMinutes: plannedNet, violations,
      };
    }).sort((a, b) => {
      const slotA = getShiftSlotFromStartTime(a.shift.start_time ?? '00:00') === 'lunch' ? 0 : 1;
      const slotB = getShiftSlotFromStartTime(b.shift.start_time ?? '00:00') === 'lunch' ? 0 : 1;
      if (slotA !== slotB) return slotA - slotB;
      return (a.shift.start_time?.slice(0, 5) ?? '00:00').localeCompare(b.shift.start_time?.slice(0, 5) ?? '00:00');
    });
  }

  function getTotalPlanned(userId: string) {
    return weekDateStrings.reduce((acc, ds) => acc + getDayGroup(userId, ds).reduce((s, g) => s + g.netMinutes, 0), 0);
  }

  function getTotalActual(userId: string) {
    return weekDateStrings.reduce((acc, ds) => acc + getDayGroup(userId, ds).reduce((s, g) => s + (g.actualMinutes > 0 ? g.actualMinutes : g.netMinutes), 0), 0);
  }

  const handlePublishWeek = useCallback(async () => {
    if (!confirm(t.confirm_publish_week ?? 'Pubblicare tutti i turni della settimana?')) return;
    try { await publishWeekShifts(weekStart); showSuccess(t.week_published ?? 'Settimana pubblicata.'); }
    catch { showError(t.error_generic ?? 'Errore.'); }
  }, [publishWeekShifts, weekStart, showSuccess, showError, t]);

  const handleCopyWeek = useCallback(async () => {
    try {
      const n = await bulkCopyPreviousWeek(weekStart);
      showSuccess(n > 0 ? (t.copied_n_shifts ?? '{n} turni copiati.').replace('{n}', String(n)) : (t.no_shifts_to_copy ?? 'Nessun turno da copiare.'));
    } catch { showError(t.error_generic ?? 'Errore.'); }
  }, [bulkCopyPreviousWeek, weekStart, showSuccess, showError, t]);

  const handleExportPdf = useCallback(async () => {
    try {
      await exportSchedulePDF(weekStart, weekDays, visibleUsers, weekShifts, { breakRules, language: effectiveLanguage });
      showSuccess(t.pdf_exported ?? 'PDF esportato.');
    } catch { showError(t.error_generic ?? 'Errore.'); }
  }, [weekStart, weekDays, visibleUsers, weekShifts, breakRules, effectiveLanguage, showSuccess, showError, t]);

  const handleDeleteShift = useCallback(async (shift: Shift, opts?: { skipConfirm?: boolean }) => {
    if (!canDeleteShift(shift)) {
      showError(t.shift_delete_blocked_frozen ?? 'Turno non eliminabile.');
      return;
    }
    if (!opts?.skipConfirm && !confirm(t.delete_shift_confirm ?? 'Eliminare questo turno?')) return;
    try {
      await deleteShift(shift.id);
      showSuccess(t.shift_deleted ?? 'Turno eliminato.');
      setDrawerDeleteConfirm(false);
      setDrawerOpen(false);
    } catch {
      showError(t.shift_delete_bulk_error ?? t.error_generic ?? 'Errore eliminazione turno.');
    }
  }, [deleteShift, showSuccess, showError, t, canDeleteShift]);

  const handleSaveShiftEdit = useCallback(async () => {
    if (!selectedShift) return;
    setSaving(true);
    try {
      await updateShift(selectedShift.id, { start_time: editStartTime + ':00', end_time: editEndTime + ':00' });
      showSuccess(t.shift_updated ?? 'Turno aggiornato.');
    } catch { showError(t.error_generic ?? 'Errore.'); }
    finally { setSaving(false); }
  }, [selectedShift, editStartTime, editEndTime, updateShift, showSuccess, showError, t]);

  const handleApproveShift = useCallback(async (shift: Shift) => {
    try { await approveShift(shift.id, {}); showSuccess(t.shift_approved ?? 'Turno approvato.'); }
    catch { showError(t.error_generic ?? 'Errore.'); }
  }, [approveShift, showSuccess, showError, t]);

  const handleFreezeShift = useCallback(async (shift: Shift) => {
    requestAnimationFrame(() => {
      setPanelPinTargetShiftId(shift.id);
      setPanelPinError('');
      setPanelPinModalOpen(true);
    });
  }, []);

  const handleUnfreezeWithPin = useCallback(async () => {
    if (!panelPinTargetShiftId) return;
    setSaving(true);
    try {
      const verifier = findFreezeVerifierByPin(users, panelPin);
      if (!verifier) {
        setPanelPinError(t.wst_unfreeze_pin_invalid ?? 'PIN non valido');
        setSaving(false);
        return;
      }
      await updateShift(panelPinTargetShiftId, { approval_status: 'confirmed' } as any);
      showSuccess(t.wst_unfreeze_success ?? 'Turno sbloccato.');
      setPanelPinModalOpen(false);
      setPanelPinTargetShiftId(null);
      setPanelPin('');
      setPanelPinError('');
    } catch { showError(t.error_generic ?? 'Errore.'); }
    finally { setSaving(false); }
  }, [panelPinTargetShiftId, panelPin, users, updateShift, showSuccess, showError, t]);

  const handleSaveManualPunch = useCallback(async () => {
    if (!selectedShift) return;
    setSaving(true);
    try {
      const shift = selectedShift;
      const todayStr = today.toISOString().slice(0, 10);
      const punchDate = shift.date <= todayStr ? shift.date : todayStr;
      const existingIn = allPunchRecords.find(pr => pr.shift_id === shift.id && pr.type === 'in');
      const existingOut = allPunchRecords.find(pr => pr.shift_id === shift.id && pr.type === 'out');
      if (editIn) {
        if (existingIn) {
          await updatePunchRecord(existingIn.id, { timestamp: new Date(`${punchDate}T${editIn}:00`).toISOString() });
        } else {
          await addPunchRecord(shift.user_id, 'in', {
            shift_id: shift.id,
            timestamp: `${punchDate}T${editIn}:00`,
            source: 'manual',
          });
        }
      }
      if (editOut) {
        if (existingOut) {
          await updatePunchRecord(existingOut.id, { timestamp: new Date(`${punchDate}T${editOut}:00`).toISOString() });
        } else {
          await addPunchRecord(shift.user_id, 'out', {
            shift_id: shift.id,
            timestamp: `${punchDate}T${editOut}:00`,
            source: 'manual',
          });
        }
      }
      showSuccess(t.punch_saved ?? 'Timbratura salvata.');
    } catch { showError(t.error_generic ?? 'Errore.'); }
    finally { setSaving(false); }
  }, [selectedShift, editIn, editOut, allPunchRecords, addPunchRecord, updatePunchRecord, showSuccess, showError, t]);

  const handleCreateShift = useCallback(async () => {
    if (!createModal) return;
    setSaving(true);
    try {
      await addShift({
        user_id: createModal.userId, date: createModal.date,
        start_time: createStart + ':00', end_time: createEnd + ':00',
        type: getShiftTypeFromStartTime(createStart),
        approval_status: 'draft' as const,
        department: users.find(u => u.id === createModal.userId)?.department ?? undefined,
      });
      showSuccess(t.shift_created ?? 'Turno creato.'); setCreateModal(null);
    } catch { showError(t.error_generic ?? 'Errore.'); }
    finally { setSaving(false); }
  }, [createModal, createStart, createEnd, addShift, showSuccess, showError, t, users]);

  const openCreateShiftModal = useCallback((userId: string, date: string, preferredSlot?: 'lunch' | 'evening') => {
    const existing = weekShifts.filter((s) => s.user_id === userId && s.date === date);
    if (existing.length >= 2) {
      showError(t.max_two_shifts_same_day ?? 'Massimo 2 turni nello stesso giorno.');
      return;
    }
    const defaultForSlot = (slot: 'lunch' | 'evening') =>
      slot === 'lunch' ? { start: '10:00', end: '16:00' } : { start: '18:00', end: '23:00' };
    if (existing.length === 1) {
      const first = existing[0];
      const oppositeSlot = getShiftSlotFromStartTime(first.start_time ?? '10:00') === 'lunch' ? 'evening' : 'lunch';
      const slot = preferredSlot ?? oppositeSlot;
      const presets = loadShiftSlotPresets(slot);
      const pick = presets.find((p) =>
        !hasShiftConflictSameDay(existing, { start_time: p.start, end_time: p.end })
      ) ?? defaultForSlot(slot);
      setCreateStart(pick.start);
      setCreateEnd(pick.end);
    } else {
      const slot = preferredSlot ?? 'lunch';
      const presets = loadShiftSlotPresets(slot);
      const pick = presets[0] ?? defaultForSlot(slot);
      setCreateStart(pick.start);
      setCreateEnd(pick.end);
    }
    setCreateModal({ userId, date });
  }, [weekShifts, showError, t]);

  const handleDeductBreakToggle = useCallback(async () => {
    if (!selectedShift) return;
    setDeductBreak(prev => !prev);
    try { await updateShift(selectedShift.id, { deduct_break: !deductBreak }); }
    catch { showError(t.error_generic ?? 'Errore.'); }
  }, [selectedShift, deductBreak, updateShift, showError, t]);

  const handleAutoBreakToggle = useCallback(async () => {
    if (!selectedShift) return;
    const next = !isAutoBreak;
    setIsAutoBreak(next);
    try {
      const gross = calculateShiftMinutesGross(selectedShift.start_time ?? '', selectedShift.end_time ?? '');
      if (next) await updateShift(selectedShift.id, { is_auto_break: true, break_minutes: 30 });
      else await updateShift(selectedShift.id, { is_auto_break: false, break_minutes: 0 });
    } catch { showError(t.error_generic ?? 'Errore.'); }
  }, [selectedShift, isAutoBreak, updateShift, showError, t]);

  const handleBulkEdit = useCallback(async () => {
    if (selectedShiftIds.size === 0) return;
    setSaving(true);
    try {
      let skipped = 0;
      for (const id of selectedShiftIds) {
        const updates: any = {};
        if (bulkEditStatus) updates.approval_status = bulkEditStatus;
        if (Object.keys(updates).length > 0) {
          const s = allShifts.find(x => x.id === id);
          if (s && isFrozen(s)) { skipped++; continue; }
          await updateShift(id, updates);
        }
      }
      if (skipped > 0) showError((t.n_shifts_skipped_frozen ?? '{n} turni congelati saltati.').replace('{n}', String(skipped)));
      else showSuccess(t.bulk_edit_done ?? 'Modifiche applicate.');
      setBulkEditOpen(false); setSelectedShiftIds(new Set());
    } catch { showError(t.error_generic ?? 'Errore.'); }
    finally { setSaving(false); }
  }, [selectedShiftIds, bulkEditStatus, updateShift, allShifts, showSuccess, showError, t]);

  const handleSaveTemplate = useCallback(async () => {
    if (!saveTemplateName.trim() || !database.shiftTemplates?.save) return;
    setSavingTemplate(true);
    try {
      const entries = weekShifts.filter(s => s.user_id).map(s => ({
        day_of_week: new Date(s.date).getDay(),
        user_id: s.user_id,
        start_time: s.start_time,
        end_time: s.end_time,
        type: s.type,
      }));
      await database.shiftTemplates.save(saveTemplateName.trim(), entries);
      const list = await database.shiftTemplates.listAll?.() ?? [];
      if (Array.isArray(list)) setTemplatesList(list);
      setSaveTemplateName('');
      closeActionsDrawer();
      showSuccess(t.template_saved ?? 'Template salvato.');
    } catch { showError(t.error_generic ?? 'Errore.'); }
    finally { setSavingTemplate(false); }
  }, [saveTemplateName, weekStart, weekShifts, showSuccess, showError, t, closeActionsDrawer]);

  const handleApplyTemplate = useCallback(async (name: string) => {
    if (!database.shiftTemplates?.load) return;
    try {
      const loaded = (await database.shiftTemplates.load(name)) as any[];
      if (Array.isArray(loaded)) {
        for (const s of loaded) {
          await addShift({ ...s, id: undefined, date: weekDateStrings[0] });
        }
        showSuccess(t.template_applied ?? 'Template applicato.');
        closeActionsDrawer();
      }
    } catch { showError(t.error_generic ?? 'Errore.'); }
  }, [addShift, weekDateStrings, showSuccess, showError, t, closeActionsDrawer]);

  const handleOpenDrawer = useCallback((shift: Shift, opts?: { isExtra?: boolean }) => {
    const u = users.find(us => us.id === shift.user_id) ?? null;
    const { in: punchIn, out: punchOut } = getPunchForShift(shift);
    const dayShifts = weekShifts.filter(s => s.user_id === shift.user_id && s.date === shift.date);
    setSelectedShift(shift); setSelectedUser(u);
    setDrawerIsExtraShift(opts?.isExtra ?? isExtraShiftInDay(shift, dayShifts));
    setDrawerDeleteConfirm(false);
    setDetailTab('details');
    setEditStartTime(String(shift.start_time ?? '').slice(0, 5));
    setEditEndTime(String(shift.end_time ?? '').slice(0, 5));
    setEditIn(punchIn ? punchTimeHHMM(punchIn.calculated_time || punchIn.timestamp) ?? '' : String(shift.start_time ?? '').slice(0, 5));
    setEditOut(punchOut ? punchTimeHHMM(punchOut.calculated_time || punchOut.timestamp) ?? '' : String(shift.end_time ?? '').slice(0, 5));
    setDeductBreak(shift.deduct_break !== false);
    setIsAutoBreak(shift.is_auto_break !== false);
    setDrawerOpen(true);
  }, [users, weekPunchRecords, weekShifts]);

  const renderExtraShiftRows = (extraGroups: DayShiftGroup[], layout: 'desktop' | 'mobile') => {
    if (extraGroups.length === 0) return null;
    const stacked = layout === 'desktop';
    return extraGroups.map((ex) => {
      const label = formatShiftTimeRangeFull(ex.shift.start_time, ex.shift.end_time);
      const title = `${t.extra_shift ?? 'Turno aggiuntivo'}: ${label}`;
      const compactLabel = formatShiftTimeRangeCompact(ex.shift.start_time, ex.shift.end_time);
      return (
        <button
          key={ex.shift.id}
          type="button"
          title={title}
          aria-label={title}
          onClick={() => handleOpenDrawer(ex.shift, { isExtra: true })}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); void handleDeleteShift(ex.shift); }}
          className={
            stacked
              ? 'w-full flex shrink-0 items-center justify-center gap-0.5 rounded-md border-2 border-dashed border-accent bg-accent px-1 text-[10px] font-extrabold tabular-nums leading-none text-white shadow-[0_1px_4px_rgba(0,0,0,0.35)] hover:brightness-110 transition-all'
              : 'w-full rounded-lg border-2 border-dashed border-accent bg-accent/80 px-2 py-1.5 text-[11px] font-extrabold tabular-nums text-white hover:bg-accent transition-all'
          }
          style={stacked ? { height: extraRowHeight, minHeight: extraRowHeight } : undefined}
        >
          <Plus className={stacked ? 'h-2.5 w-2.5 shrink-0 stroke-[3]' : 'hidden'} aria-hidden />
          <span className="truncate">{stacked ? compactLabel : label}</span>
        </button>
      );
    });
  };

  const renderGroupButton = (g: DayShiftGroup, layout: 'desktop' | 'mobile', compact = false, extraGroups: DayShiftGroup[] = []) => {
    const isDraft = g.shift.approval_status === 'draft';
    const isApproved = g.shift.approval_status === 'approved';
    const isConfirmed = g.shift.approval_status === 'confirmed';
    const display = getShiftCellDisplay(g, mode, weekPunchRecords, compact || isPeriodView);
    let borderColor = 'border-cyan-400/50';
    let bgColor = 'bg-white/[0.06]';
    let glow = '';
    if (isDraft) { borderColor = 'border-blue-400/60'; bgColor = 'bg-white/[0.08]'; }
    if (isApproved) { borderColor = 'border-emerald-400/60'; bgColor = 'bg-emerald-500/10'; }
    if (g.isAbsent) { borderColor = 'border-rose-400/60'; bgColor = 'bg-rose-500/10'; }
    if (g.isMissingPunch) { borderColor = 'border-amber-400/60'; bgColor = 'bg-amber-500/10'; }
    if (g.violations?.length && g.violations.length > 0) glow = 'ring-1 ring-rose-400/40';

    const timeOnly = (
      <span className={`font-bold tabular-nums whitespace-nowrap ${layout === 'mobile' ? 'text-xs' : compact || isPeriodView ? 'text-[11px]' : 'text-xs'} ${g.isAbsent ? 'text-rose-400 line-through' : display.missingOut ? 'text-red-400' : 'text-white'}`}>
        {display.main}
      </span>
    );
    const breakBadge = display.breakSuffix ? (
      <span className="shrink-0 text-[10px] font-bold tabular-nums text-amber-400 leading-none">
        {display.breakSuffix}
      </span>
    ) : null;
    const breakBesideIcons = layout === 'desktop' && !isPeriodView;
    const timeLabel = breakBesideIcons ? timeOnly : (
      <span className="inline-flex items-center gap-0.5 max-w-full">
        {timeOnly}
        {breakBadge}
      </span>
    );

    if (layout === 'mobile') {
      return (
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => handleOpenDrawer(g.shift)} title={display.title}
            onContextMenu={(e) => { e.preventDefault(); void handleDeleteShift(g.shift); }}
            className={`w-full text-left rounded-lg border-l-4 ${borderColor} ${bgColor} ${glow} px-2.5 py-2 hover:brightness-125 transition-all active:scale-[0.98]`}>
            <div className="flex items-center justify-between gap-1">
              {timeLabel}
              <div className="flex items-center gap-1 shrink-0">
                {isFrozen(g.shift) ? <Lock className="h-3 w-3 text-amber-400" /> : isApproved ? <Lock className="h-3 w-3 text-emerald-400" /> : null}
                {isConfirmed && <Check className="h-3 w-3 text-cyan-300" />}
                {g.isMissingPunch && <AlertTriangle className="h-3 w-3 text-amber-400" />}
              </div>
            </div>
          </button>
          {renderExtraShiftRows(extraGroups, 'mobile')}
        </div>
      );
    }
    const hasExtras = extraGroups.length > 0;
    const mainRowHeight = hasExtras
      ? Math.max(18, slotRowHeight - extraGroups.length * extraRowHeight - (extraGroups.length > 0 ? 2 : 0))
      : slotRowHeight - (layout === 'desktop' && isPeriodView ? 2 : 4);

    if (layout === 'desktop' && isPeriodView) {
      let accent = 'border-cyan-400';
      if (isDraft) accent = 'border-blue-400';
      else if (isApproved) accent = 'border-emerald-400';
      else if (g.isAbsent) accent = 'border-rose-400';
      else if (g.isMissingPunch) accent = 'border-amber-400';
      else if (display.missingOut) accent = 'border-red-400';
      else if (mode === 'realtime' && g.punchIn) accent = 'border-emerald-400/80';
      return (
        <div className={`flex w-full min-w-0 flex-col ${hasExtras ? 'gap-0.5 justify-center' : ''}`} style={{ minHeight: slotRowHeight - 2 }}>
          <button
            type="button"
            title={display.title ?? formatShiftTimeRangeFull(g.shift.start_time, g.shift.end_time)}
            onClick={() => handleOpenDrawer(g.shift)}
            onContextMenu={(e) => { e.preventDefault(); void handleDeleteShift(g.shift); }}
            className={`w-full flex items-center justify-center rounded-md border-l-[3px] ${accent} bg-white/[0.07] hover:bg-white/[0.12] transition-colors ${g.isAbsent ? 'opacity-70' : ''} ${isDraft ? 'border-dashed' : ''}`}
            style={{ height: mainRowHeight, minHeight: mainRowHeight }}
          >
            {timeLabel}
          </button>
          {renderExtraShiftRows(extraGroups, 'desktop')}
        </div>
      );
    }
    return (
      <div className={`flex w-full min-w-0 flex-col ${hasExtras ? 'gap-0.5 justify-center' : ''}`}>
        <button type="button" onClick={() => handleOpenDrawer(g.shift, { isExtra: false })} title={display.title}
          onContextMenu={(e) => { e.preventDefault(); void handleDeleteShift(g.shift); }}
          className={`relative w-full min-w-0 text-left rounded-lg border-2 ${borderColor} ${bgColor} ${glow} hover:brightness-125 transition-all ${isDraft ? 'border-dashed' : ''} px-0.5 py-0.5`}>
          <input type="checkbox" checked={selectedShiftIds.has(g.shift.id)} onChange={() => setSelectedShiftIds(prev => { const n = new Set(prev); n.has(g.shift.id) ? n.delete(g.shift.id) : n.add(g.shift.id); return n; })}
            className={`absolute left-0.5 top-0.5 z-10 w-3 h-3 rounded border-white/30 accent-accent transition-opacity ${selectedShiftIds.has(g.shift.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={e => e.stopPropagation()} />
          <div
            className="flex items-center justify-center w-full gap-1 pl-3 pr-1 whitespace-nowrap overflow-hidden"
            style={{ minHeight: mainRowHeight, height: mainRowHeight }}
          >
            <span className={`${hasExtras ? 'text-[10px]' : 'text-xs'} font-bold tabular-nums ${g.isAbsent ? 'text-rose-400 line-through' : display.missingOut ? 'text-red-400' : 'text-white'}`}>
              {display.main}
            </span>
            {breakBadge}
          </div>
          <div className="pointer-events-none absolute right-0.5 top-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {isFrozen(g.shift) ? <Lock className={`${compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} text-amber-400`} /> : isApproved ? <Lock className={`${compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} text-emerald-400`} /> : null}
            {isConfirmed && <Check className={`${compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} text-cyan-300`} />}
            {g.isMissingPunch && <AlertTriangle className={`${compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} text-amber-400`} />}
          </div>
        </button>
        {renderExtraShiftRows(extraGroups, 'desktop')}
      </div>
    );
  };

  return (
    <div className="w-full min-w-0 font-sans">
      {/* ── Toolbar ── */}
      <div className="ui-toolbar-page-band ui-toolbar-page-band-presences !h-auto !max-h-none min-h-0 mb-3 w-full min-w-0">
        <div className="ui-toolbar-row-tight flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={prevWeek} aria-label="Settimana precedente"
              className="rounded-lg bg-white/10 px-1.5 py-1 text-white/60 hover:text-white transition-colors md:px-2"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={goToday}
              className="rounded-lg bg-white/10 px-2 py-1 text-white/60 hover:text-white transition-colors text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">{t.today_btn ?? 'Oggi'}</button>
            <button type="button" onClick={nextWeek} aria-label="Settimana successiva"
              className="rounded-lg bg-white/10 px-1.5 py-1 text-white/60 hover:text-white transition-colors md:px-2"><ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <span
            className="min-w-0 max-w-full truncate text-[11px] md:text-sm font-semibold text-white/50 tabular-nums"
            title={`${format(weekStart, 'd MMM yyyy', { locale })} — ${format(weekEnd, 'd MMM yyyy', { locale })}`}
          >
            {format(weekStart, 'd MMM', { locale })}
            <span className="hidden min-[420px]:inline"> — {format(weekEnd, 'd MMM', { locale })}</span>
            <span className="hidden md:inline"> {format(weekEnd, 'yyyy', { locale })}</span>
          </span>
          {departments.length > 1 && (
            <div className="relative ml-auto sm:ml-0" ref={deptDropdownRef}>
              <button type="button" onClick={() => setDeptDropdownOpen(!deptDropdownOpen)}
                className="relative flex max-w-[min(100%,7.5rem)] sm:max-w-none items-center gap-1 truncate rounded-lg bg-white/10 py-1.5 pl-2 pr-6 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/60 transition-colors hover:text-white sm:px-2.5 sm:pr-7">
                <Filter className="h-3 w-3 shrink-0 text-white/40" aria-hidden />
                <span className="truncate">{deptFilter ?? (t.department_filter_all ?? 'Tutti')}</span>
                <ChevronDown className={`pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/40 transition-transform ${deptDropdownOpen ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {deptDropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[130px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl"
                  style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                  <button type="button" onClick={() => { setDeptFilter(null); setDeptDropdownOpen(false); }}
                    className="w-full px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10">
                    {t.department_filter_all ?? 'Tutti'}
                  </button>
                  {departments.map(d => (
                    <button key={d} type="button" onClick={() => { setDeptFilter(d); setDeptDropdownOpen(false); }}
                      className="w-full px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10">
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ui-toolbar-row-tight flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2 lg:ml-auto lg:justify-end">
          <div className="flex shrink-0 items-center gap-1 rounded-lg bg-white/5 p-0.5">
            <button type="button" onClick={() => setViewMode('week')}
              className={`rounded-md px-1.5 md:px-2.5 py-1 text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'week' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}>
              <span className="sm:hidden">{t.view_week_short ?? 'Sett.'}</span>
              <span className="hidden sm:inline">{t.view_week ?? 'Settimana'}</span>
            </button>
            <button type="button" onClick={() => setViewMode('period')}
              className={`rounded-md px-1.5 md:px-2.5 py-1 text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'period' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}>
              {t.view_period ?? 'Periodo'}
            </button>
          </div>

          <button ref={periodTriggerRef} type="button" onClick={togglePeriodPopover}
            className="flex max-w-[min(100%,11rem)] sm:max-w-none min-w-0 items-center gap-1 truncate rounded-lg bg-white/5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50 transition-colors hover:text-white">
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span className="truncate sm:hidden">
              {format(periodStart, 'd/M', { locale })}–{format(periodEnd, 'd/M', { locale })}
            </span>
            <span className="hidden truncate sm:inline">
              {format(periodStart, 'd MMM', { locale })} — {format(periodEnd, 'd MMM', { locale })}
            </span>
            <ChevronDown className="ml-0.5 h-3 w-3 shrink-0" />
          </button>

          {isMgmt && (
            <button
              type="button"
              onClick={() => void handlePublishWeek()}
              aria-label={t.publish_week ?? 'Pubblica settimana'}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600/20 px-2 py-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-300 transition-colors hover:bg-emerald-600/30 sm:px-2.5"
            >
              <Send className="h-3 w-3 shrink-0" />
              <span className="hidden min-[520px]:inline lg:hidden">Pubblica</span>
              <span className="hidden lg:inline">{t.publish_week ?? 'Pubblica settimana'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleExportPdf()}
            aria-label="Esporta PDF"
            className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/60 transition-colors hover:text-white sm:px-2.5"
          >
            <FileDown className="h-3 w-3 shrink-0" />
            <span className="hidden min-[400px]:inline">PDF</span>
          </button>

          {(isMgmt || canEdit) && (
          <>
          <div className="relative shrink-0" ref={actionsDrawerTriggerRef}>
            <button
              type="button"
              onClick={() => setActionsDrawerOpen((open) => !open)}
              className={`flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-colors sm:px-2.5 ${
                actionsDrawerOpen ? 'text-white' : 'text-white/60 hover:text-white'
              }`}
              aria-expanded={actionsDrawerOpen}
              aria-haspopup="true"
              aria-label={(t as Record<string, string>).wst_toolbar_hamburger_aria ?? 'Apri menu azioni'}
              title={t.actions ?? 'Azioni'}
            >
              <Menu className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
              <span className="hidden min-[400px]:inline">{t.actions ?? 'Azioni'}</span>
            </button>
          </div>

          {actionsDrawerOpen && (
            <CenteredModalPortal
              open
              onClose={closeActionsDrawer}
              panelRef={actionsDrawerPanelRef}
              backdropAriaLabel={t.cancel ?? 'Chiudi'}
              ariaLabel={t.actions ?? 'Azioni'}
              maxWidthClass="max-w-md"
              maxHeightClass="max-h-[min(90dvh,720px)]"
              panelClassName="py-1"
            >
              <div className="border-b border-white/10 px-4 py-2.5 text-sm font-semibold text-white">
                {t.actions ?? 'Azioni'}
              </div>

              {isMgmt && (
                <button
                  type="button"
                  onClick={() => {
                    closeActionsDrawer();
                    void handleCopyWeek();
                  }}
                  className="flex w-full items-center gap-2 border-b border-white/10 px-4 py-2.5 text-left text-sm text-white/85 transition-colors hover:bg-white/10"
                >
                  <Copy className="h-4 w-4 shrink-0 text-white/50" strokeWidth={2.25} />
                  {t.copy_week ?? 'Copia settimana'}
                </button>
              )}

              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActionsDrawerSection((sec) => (sec === 'templates' ? null : 'templates'))
                    }
                    className="flex w-full items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5 text-left transition-colors hover:bg-white/10"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
                      <Save className="h-4 w-4 shrink-0 text-white/50" strokeWidth={2.25} />
                      {t.templates ?? 'Template'}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${
                        actionsDrawerSection === 'templates' ? '-rotate-180' : ''
                      }`}
                      strokeWidth={2.25}
                      aria-hidden
                    />
                  </button>
                  {actionsDrawerSection === 'templates' && (
                    <div className="border-b border-white/10 px-4 py-3">
                      <div className="mb-2 flex items-center gap-1">
                        <input
                          value={saveTemplateName}
                          onChange={(e) => setSaveTemplateName(e.target.value)}
                          placeholder={t.save_current_as ?? 'Salva come...'}
                          className="flex-1 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-[11px] font-bold text-white outline-none placeholder:text-white/30"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveTemplate()}
                          disabled={savingTemplate || !saveTemplateName.trim()}
                          className="rounded-lg bg-accent px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-40"
                        >
                          <Save className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {templatesList.length > 0 ? (
                        <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                          {templatesList.map((name) => (
                            <li key={name}>
                              <button
                                type="button"
                                onClick={() => void handleApplyTemplate(name)}
                                className="w-full truncate rounded-lg px-2 py-1.5 text-left text-[11px] font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                              >
                                {name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="py-2 text-center text-[10px] text-white/40">
                          {t.no_templates ?? 'Nessun template'}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </CenteredModalPortal>
          )}
          </>
          )}
        </div>
      </div>

      {/* ── Period Popover ── */}
      {showPeriodPopover && createPortal(
          <div ref={periodPopoverRef}
            className="fixed z-[10050] mt-1 rounded-2xl border border-white/10 p-3 sm:p-4 w-[calc(100vw-32px)] max-w-[340px] max-h-[85vh] overflow-y-auto"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', top: periodPopoverStyle.top, left: periodPopoverStyle.left, transform: 'translateX(-50%)' }}>
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setPeriodPopoverYear(y => y - 1)}
              className="rounded-lg bg-white/10 px-2 py-1 text-white/60 hover:text-white transition-colors"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <span className="text-sm font-bold text-white">{periodPopoverYear}</span>
            <button type="button" onClick={() => setPeriodPopoverYear(y => y + 1)}
              className="rounded-lg bg-white/10 px-2 py-1 text-white/60 hover:text-white transition-colors"><ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {Array.from({ length: 12 }, (_, i) => {
              const refDate = new Date(periodPopoverYear, i, 15);
              const cfg = periodConfigForMonth(refDate);
              const start = getPeriodStartDate(cfg);
              const end = getPeriodEndDate(cfg);
              const isActive = periodNavOffset === 0 && cfg.startDate === periodConfig.startDate && cfg.numWeeks === periodConfig.numWeeks;
              return (
                <button key={i} type="button" onClick={() => applyPeriod(cfg)}
                  className={`rounded-xl border px-2.5 py-2 text-left transition-all ${isActive ? 'border-accent/50 bg-accent/10' : 'border-white/10 bg-white/[0.04] hover:border-white/20'}`}>
                  <div className={`text-[11px] font-bold ${isActive ? 'text-accent' : 'text-white'}`}>{MONTHS_IT[i]}</div>
                  <div className="text-[9px] text-white/40 mt-0.5 leading-tight tabular-nums">
                    {format(start, 'd MMM', { locale })}<br />— {format(end, 'd MMM', { locale })}
                  </div>
                  <div className="text-[8px] text-white/30 mt-0.5 font-bold uppercase">{cfg.numWeeks} sett.</div>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}

      {selectedShiftIds.size > 0 && (
        <div className="mb-2 flex items-center gap-2 text-[10px] text-white/40">
          <span className="text-[10px] text-white/50 font-semibold">{selectedShiftIds.size} selezionati</span>
          {!bulkEditOpen ? (
            <button type="button" onClick={() => setBulkEditOpen(true)}
              className="rounded-lg bg-accent/20 px-2.5 py-1 text-[10px] font-bold text-accent hover:bg-accent/30 transition-colors uppercase tracking-wider">
              {t.bulk_edit ?? 'Modifica'}
            </button>
          ) : (
            <>
              <select value={bulkEditStatus} onChange={e => setBulkEditStatus(e.target.value)}
                className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold text-white/70 uppercase outline-none">
                <option value="">{t.status ?? 'Stato'}</option>
                <option value="draft">Draft</option>
                <option value="confirmed">Confermato</option>
                <option value="approved">Approvato</option>
              </select>
              <button type="button" onClick={handleBulkEdit}
                className="rounded-lg bg-emerald-600/20 px-2.5 py-1 text-[10px] font-bold text-emerald-300 hover:bg-emerald-600/30 transition-colors uppercase tracking-wider">
                <Check className="h-3 w-3 inline-block mr-0.5" />{t.apply ?? 'Applica'}
              </button>
              <button type="button" onClick={() => { setBulkEditOpen(false); setBulkEditStatus(''); }}
                className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/50 hover:text-white transition-colors uppercase tracking-wider">
                <X className="h-3 w-3" />
              </button>
            </>
          )}
          <button type="button" onClick={async () => {
            for (const id of selectedShiftIds) {
              const s = allShifts.find(x => x.id === id);
              if (s && canDeleteShift(s)) {
                try { await deleteShift(id); } catch { /* toast già mostrato */ }
              }
            }
            setSelectedShiftIds(new Set());
          }}
            className="rounded-lg bg-rose-600/20 px-2.5 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-600/30 transition-colors uppercase tracking-wider">
            <Trash2 className="h-3 w-3 inline-block mr-0.5" />{t.delete ?? 'Elimina'}
          </button>
        </div>
      )}

      {/* ── Mobile Card View ── */}
      <div className="md:hidden space-y-4 px-1 pb-4">
        {visibleUsers.map((user) => {
          const totalNet = getTotalPlanned(user.id);
          const totalActual = getTotalActual(user.id);
          const userHasShifts = weekDays.some(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            return getDayGroup(user.id, dateStr).length > 0;
          });
          return (
            <div key={user.id} className="rounded-xl border border-neutral-500 overflow-hidden p-4 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-lg text-white">{user.first_name} {user.last_name?.[0] ?? ''}</h4>
                  {user.department && (
                    <p className="text-[11px] text-white/50 font-medium uppercase tracking-wider">{user.department}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold text-white/40 uppercase tracking-tight">{t.total_hours ?? 'Ore'}</div>
                  <div className="text-sm font-bold text-accent tabular-nums">
                    {formatMinutesToHoursAndMinutes(totalActual)}
                  </div>
                  <div className={`text-[10px] font-bold tabular-nums ${totalActual > totalNet ? 'text-accent' : 'text-emerald-400'}`}>
                    {totalActual > totalNet ? '+' : ''}{formatMinutesToHoursAndMinutes(Math.abs(totalActual - totalNet))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {!userHasShifts ? (
                  <div className="py-4 text-center border-2 border-dashed border-white/10 rounded-xl">
                    <p className="text-xs text-white/50 italic">{t.no_shifts_this_week ?? 'Nessun turno'}</p>
                  </div>
                ) : (
                  weekDays.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const groups = getDayGroup(user.id, dateStr);
                    if (groups.length === 0) return null;

                    const todayDate = isToday(day);
                    return (
                      <div key={dateStr} className={`flex items-start gap-3 p-2.5 rounded-xl ${todayDate ? 'bg-accent/5 ring-1 ring-accent/20' : 'bg-white/[0.04]'}`}>
                        <div className="w-10 shrink-0 text-center pt-0.5">
                          <div className={`text-[10px] font-bold uppercase ${todayDate ? 'text-accent' : 'text-white/50'}`}>
                            {format(day, 'EEE', { locale })}
                          </div>
                          <div className={`text-sm font-bold ${todayDate ? 'text-accent' : 'text-white/70'}`}>
                            {format(day, 'd')}
                          </div>
                        </div>

                        <div className="flex-1 flex flex-col gap-1">
                          {(() => {
                            const { lunch, evening, extraLunchGroups, extraEveningGroups } = splitDayGroupsBySlot(groups);
                            const canAddSecond = canEdit && groups.length < 2;
                            return (
                              <>
                                <div className="min-h-[28px]">
                                  {lunch ? renderGroupButton(lunch, 'mobile', false, extraLunchGroups) : canAddSecond ? (
                                    <button type="button" onClick={() => openCreateShiftModal(user.id, dateStr, 'lunch')}
                                      className="w-full rounded-lg border border-dashed border-white/15 py-1.5 text-[10px] font-bold text-white/40 transition-all hover:border-white/30 hover:text-white/70 active:scale-[0.98]">
                                      <Plus className="mb-0.5 inline-block h-3 w-3" /> {t.add_shift ?? 'Aggiungi'}
                                    </button>
                                  ) : null}
                                </div>
                                <div className="min-h-[28px]">
                                  {evening ? renderGroupButton(evening, 'mobile', false, extraEveningGroups) : canAddSecond ? (
                                    <button type="button" onClick={() => openCreateShiftModal(user.id, dateStr, 'evening')}
                                      className="w-full rounded-lg border border-dashed border-white/15 py-1.5 text-[10px] font-bold text-white/40 transition-all hover:border-white/30 hover:text-white/70 active:scale-[0.98]">
                                      <Plus className="mb-0.5 inline-block h-3 w-3" /> {t.add_second_shift ?? '2° turno'}
                                    </button>
                                  ) : null}
                                </div>
                              </>
                            );
                          })()}
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

      {/* ── Desktop Grid ── */}
      {isPeriodView && (
        <p className="hidden md:block mb-2 text-[10px] font-medium text-white/40">
          {t.period_scroll_hint ?? 'Scorri orizzontalmente per vedere tutti i giorni del periodo.'}
        </p>
      )}
      <div
        className="hidden md:block w-full min-w-0 overflow-auto rounded-2xl border border-white/10"
        style={{ maxHeight: 'calc(100dvh - 12rem)' }}
      >
        <table
          className={`table-fixed border-collapse ${isPeriodView ? '' : 'w-full'}`}
          style={{ minWidth: tableMinWidth, width: isPeriodView ? tableMinWidth : undefined }}
        >
          <colgroup>
            <col style={{ width: employeeColWidth }} />
            {weekDays.map((_, i) => (
              <col key={i} style={{ width: isPeriodView ? dayColMinWidth : dayColCalc }} />
            ))}
            <col style={{ width: totalColWidth }} />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-neutral-950/90 backdrop-blur-sm">
            <tr>
              <th className="sticky left-0 z-30 bg-white/8 backdrop-blur-sm text-left px-2 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/50 border-b border-white/10">
                {t.employee ?? 'Dipendente'}
              </th>
              {weekDays.map((day, i) => {
                const weekStripe = isPeriodView && Math.floor(i / 7) % 2 === 1;
                const weekEnd = isPeriodView && day.getDay() === 0;
                return (
                  <th
                    key={i}
                    title={format(day, 'EEEE d MMMM', { locale })}
                    className={`px-0.5 py-1.5 text-center border-b border-white/10 ${isToday(day) ? 'bg-accent/10' : weekStripe ? 'bg-white/[0.03]' : 'bg-transparent'} ${weekEnd ? 'border-r-2 border-r-white/20' : ''}`}
                  >
                    {isPeriodView ? (
                      <>
                        <div className="text-[9px] font-bold uppercase text-white/35 leading-none">{format(day, 'EEEEE', { locale })}</div>
                        <div className={`text-sm font-black leading-tight ${isToday(day) ? 'text-accent' : 'text-white/85'}`}>{format(day, 'd')}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">{format(day, 'EEE', { locale })}</div>
                        <div className={`text-sm font-black ${isToday(day) ? 'text-accent' : 'text-white/80'}`}>{format(day, 'd')}</div>
                      </>
                    )}
                  </th>
                );
              })}
              <th className="px-1 py-2.5 text-center border-b border-white/10 bg-transparent">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">{t.total_hours ?? 'Ore'}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((user, uIdx) => {
              const totalNet = getTotalPlanned(user.id);
              const totalActual = getTotalActual(user.id);
              return (
                <tr key={user.id} className={uIdx % 2 === 0 ? 'bg-white/[0.03]' : ''}>
                  <td className={`sticky left-0 z-10 backdrop-blur-sm px-2 py-1.5 border-b border-white/5 ${uIdx % 2 === 0 ? 'bg-white/[0.06]' : 'bg-white/[0.03]'}`}>
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-xs font-bold text-white truncate">{user.first_name} {user.last_name?.[0] ?? ''}</span>
                    </div>
                    <div className="flex items-center gap-0.5 mt-0.5 min-w-0">
                      <span className="text-[10px] font-semibold text-white/40 tabular-nums truncate">{formatMinutesToHoursAndMinutes(totalNet)}P</span>
                      <span className="text-[10px] font-semibold text-white/40 shrink-0">/</span>
                      <span className={`text-[10px] font-bold tabular-nums truncate ${totalActual > totalNet ? 'text-accent' : 'text-emerald-400'}`}>{formatMinutesToHoursAndMinutes(totalActual)}E</span>
                    </div>
                  </td>
                  {weekDays.map((day, dIdx) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const groups = getDayGroup(user.id, dateStr);
                    const weekStripe = isPeriodView && Math.floor(dIdx / 7) % 2 === 1;
                    const weekEnd = isPeriodView && day.getDay() === 0;
                    return (
                      <td key={dIdx} className={`px-0.5 py-0.5 border-b border-white/5 align-top group min-w-0 ${isToday(day) ? 'bg-accent/[0.04]' : weekStripe ? 'bg-white/[0.02]' : ''} ${weekEnd ? 'border-r-2 border-r-white/15' : ''}`}>
                        {groups.length === 0 ? (
                          <div className="flex items-center justify-center h-full" style={{ minHeight: slotCellHeight }}>
                            {canEdit ? (
                              <button type="button" onClick={() => openCreateShiftModal(user.id, dateStr)}
                                className={`rounded-lg border border-dashed border-white/20 flex items-center justify-center text-[10px] font-bold text-white/30 hover:text-white/60 hover:border-white/40 transition-all opacity-0 group-hover:opacity-100 ${isPeriodView ? 'w-7 h-7' : 'px-3 py-2'}`}>
                                <Plus className="h-3 w-3 inline-block" />{!isPeriodView && <span className="ml-1">{t.add_shift ?? 'Aggiungi'}</span>}
                              </button>
                            ) : (
                              <span className="text-[10px] text-white/20 font-medium">&mdash;</span>
                            )}
                          </div>
                        ) : (
                          (() => {
                            const { lunch, evening, extraLunchGroups, extraEveningGroups } = splitDayGroupsBySlot(groups);
                            const canAddSecond = canEdit && groups.length < 2;
                            const emptySlot = (slot: 'lunch' | 'evening', label: string) => (
                              canAddSecond && !(slot === 'lunch' ? lunch : evening) ? (
                                <button type="button" onClick={() => openCreateShiftModal(user.id, dateStr, slot)}
                                  className={`w-full rounded-md border border-dashed border-white/15 flex items-center justify-center text-white/35 transition-all hover:border-white/30 hover:text-white/60 opacity-0 group-hover:opacity-100 ${isPeriodView ? '' : 'text-[10px] font-bold'}`}
                                  style={{ height: isPeriodView ? slotRowHeight - 2 : slotRowHeight }}
                                  title={label}
                                >
                                  <Plus className={`${isPeriodView ? 'h-3 w-3' : 'inline-block h-3 w-3 mr-0.5'}`} />
                                  {!isPeriodView && label}
                                </button>
                              ) : (
                                <div style={{ height: isPeriodView ? slotRowHeight - 2 : slotRowHeight }} />
                              )
                            );
                            return (
                              <div className={`flex flex-col ${isPeriodView ? 'gap-px' : ''}`} style={{ height: slotCellHeight }}>
                                <div className="flex items-center" style={{ height: '50%', ...(isPeriodView ? {} : { borderBottom: '1px solid rgba(255,255,255,0.10)', paddingLeft: '1px', paddingRight: '1px' }) }}>
                                  {lunch ? (
                                    <div className="relative w-full min-w-0 overflow-visible">
                                      {renderGroupButton(lunch, 'desktop', compactGrid, extraLunchGroups)}
                                    </div>
                                  ) : emptySlot('lunch', t.add_shift ?? 'Aggiungi')}
                                </div>
                                <div className={`flex items-center ${isPeriodView ? 'border-t border-white/[0.08]' : ''}`} style={{ height: '50%', ...(isPeriodView ? {} : { paddingLeft: '1px', paddingRight: '1px' }) }}>
                                  {evening ? (
                                    <div className="relative w-full min-w-0 overflow-visible">
                                      {renderGroupButton(evening, 'desktop', compactGrid, extraEveningGroups)}
                                    </div>
                                  ) : emptySlot('evening', t.add_second_shift ?? '2° turno')}
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </td>
                    );
                  })}
                  <td className={`px-1 py-1 border-b border-white/5 text-center align-middle ${compactGrid ? 'text-[10px]' : ''}`}>
                    <div className={`${compactGrid ? 'text-[10px]' : 'text-xs'} font-bold text-white tabular-nums`}>{formatMinutesToHoursAndMinutes(totalActual)}</div>
                    <div className={`${compactGrid ? 'text-[9px]' : 'text-[10px]'} font-bold tabular-nums ${totalActual > totalNet ? 'text-accent' : 'text-emerald-400'}`}>
                      {totalActual > totalNet ? '+' : ''}{formatMinutesToHoursAndMinutes(Math.abs(totalActual - totalNet))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Detail Drawer ── */}
      {drawerOpen && selectedShift && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={() => setDrawerOpen(false)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md supports-[backdrop-filter]:bg-black/50" />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/15 p-5 shadow-2xl max-h-[85vh] z-10 flex flex-col" style={{ backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: `2px solid ${isFrozen(selectedShift) ? '#fbbf24' : selectedShift.approval_status === 'approved' ? '#34d399' : selectedShift.approval_status === 'confirmed' ? '#67e8f9' : 'rgba(255,255,255,0.2)'}40`, boxShadow: `0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.08), 0 0 24px ${isFrozen(selectedShift) ? '#fbbf24' : selectedShift.approval_status === 'approved' ? '#34d399' : selectedShift.approval_status === 'confirmed' ? '#67e8f9' : 'rgba(255,255,255,0.2)'}20` }} onClick={e => e.stopPropagation()}>
            <div className="shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedUser?.first_name ?? ''} {selectedUser?.last_name ?? ''}</h3>
                {drawerIsExtraShift && (
                  <span className="inline-block mt-0.5 rounded-md bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
                    {t.extra_shift ?? 'Turno aggiuntivo'}
                  </span>
                )}
                <p className="text-[11px] text-white font-semibold mt-1">{format(parseISO(selectedShift.date), 'EEEE d MMMM', { locale })} — {selectedShift.start_time?.slice(0, 5)}-{selectedShift.end_time?.slice(0, 5)}</p>
                {(() => {
                  const dayShifts = weekShifts
                    .filter(s => s.user_id === selectedShift.user_id && s.date === selectedShift.date)
                    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
                  if (dayShifts.length <= 1) return null;
                  return (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {dayShifts.map(s => {
                        const isActive = s.id === selectedShift.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleOpenDrawer(s, { isExtra: isExtraShiftInDay(s, dayShifts) })}
                            className={`rounded-md px-2 py-1 text-[10px] font-bold tabular-nums transition-all ${isActive ? 'bg-accent text-white' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'}`}
                          >
                            {formatShiftTimeRangeFull(s.start_time, s.end_time)}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg bg-white/10 p-2 text-white/50 hover:text-white hover:bg-white/20 transition-all"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex gap-1 rounded-lg bg-gradient-to-r from-indigo-500/15 to-purple-500/15 p-1 mb-4">
              {(['details', 'punches', 'breaks', 'history'] as ShiftDetailTab[]).map(tab => (
                <button key={tab} type="button" onClick={() => setDetailTab(tab)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${detailTab === tab ? 'bg-accent text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
                  {tab === 'details' ? (t.details ?? 'Dettagli') : tab === 'punches' ? (t.punches ?? 'Timbrature') : tab === 'breaks' ? (t.break_plural ?? 'Pause') : (t.history ?? 'Storico')}
                </button>
              ))}
            </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
            {/* Details tab */}
            {detailTab === 'details' && (
              <div className="space-y-3">
                {canEdit && !isFrozen(selectedShift) && (
                  <div className="rounded-xl bg-gradient-to-br from-sky-500/10 to-blue-600/10 p-3 space-y-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">{t.start_time ?? 'Inizio'}</label>
                      <TimeInputField value={editStartTime} onChange={setEditStartTime} size="md" className="w-full" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">{t.end_time ?? 'Fine'}</label>
                      <TimeInputField value={editEndTime} onChange={setEditEndTime} size="md" className="w-full" />
                    </div>
                    <button type="button" onClick={handleSaveShiftEdit} disabled={saving}
                      className="w-full rounded-lg bg-accent px-3 py-2 text-[11px] font-bold text-white hover:bg-accent-hover disabled:opacity-40 transition-all">
                      {saving ? (t.saving ?? 'Salvataggio...') : <><Save className="h-3.5 w-3.5 inline-block mr-1.5" />{t.save_changes ?? 'Salva modifiche'}</>}
                    </button>
                  </div>
                )}
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-600/10 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">{t.status ?? 'Stato'}</span>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${isFrozen(selectedShift) ? 'text-amber-400' : selectedShift.approval_status === 'approved' ? 'text-emerald-400' : selectedShift.approval_status === 'confirmed' ? 'text-cyan-300' : 'text-white/70'}`}>
                      {isFrozen(selectedShift) ? (t.wst_frozen_badge ?? 'Congelato') : selectedShift.approval_status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">{t.department ?? 'Reparto'}</span>
                    <span className="text-[11px] font-bold text-white uppercase">{selectedShift.department || selectedUser?.department || '—'}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canEdit && !isShiftPayrollFrozen(selectedShift) && selectedShift.approval_status === 'draft' && (
                    <button type="button" onClick={() => handleApproveShift(selectedShift)}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-2 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/30 transition-colors border border-transparent hover:border-emerald-600/30">
                      <Check className="h-3.5 w-3.5" />{t.approve ?? 'Approva'}
                    </button>
                  )}
                  {canDeleteShift(selectedShift) && (
                    drawerDeleteConfirm ? (
                      <div className="flex w-full gap-2">
                        <button type="button" onClick={() => setDrawerDeleteConfirm(false)}
                          className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-[11px] font-bold text-white/70 hover:bg-white/20 transition-colors">
                          {t.cancel ?? 'Annulla'}
                        </button>
                        <button type="button" onClick={() => void handleDeleteShift(selectedShift, { skipConfirm: true })}
                          className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-rose-700 transition-colors">
                          {t.wst_confirm_delete_btn ?? 'Conferma elimina'}
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setDrawerDeleteConfirm(true)}
                        className="flex items-center gap-1.5 rounded-lg bg-rose-600/20 px-3 py-2 text-[11px] font-bold text-rose-300 hover:bg-rose-600/30 transition-colors border border-transparent hover:border-rose-600/30">
                        <Trash2 className="h-3.5 w-3.5" />{drawerIsExtraShift ? (t.delete_extra_shift ?? 'Elimina turno aggiuntivo') : (t.delete ?? 'Elimina')}
                      </button>
                    )
                  )}
                  {canEdit && !isShiftPayrollFrozen(selectedShift) && selectedShift.approval_status === 'confirmed' && (
                    <button type="button" onClick={() => handleFreezeShift(selectedShift)}
                      className="flex items-center gap-1.5 rounded-lg bg-amber-600/20 px-3 py-2 text-[11px] font-bold text-amber-300 hover:bg-amber-600/30 transition-colors border border-transparent hover:border-amber-600/30">
                      <Lock className="h-3.5 w-3.5" />{t.wst_freeze_btn ?? 'Congela'}
                    </button>
                  )}
                  {canEdit && isShiftPayrollFrozen(selectedShift) && (
                    <button type="button" onClick={() => handleFreezeShift(selectedShift)}
                      className="flex items-center gap-1.5 rounded-lg bg-accent/20 px-3 py-2 text-[11px] font-bold text-accent hover:bg-accent/30 transition-colors border border-transparent hover:border-accent/30">
                      <Unlock className="h-3.5 w-3.5" />{t.wst_unfreeze_btn ?? 'Sblocca'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Punches tab */}
            {detailTab === 'punches' && selectedShift && (() => {
              const { in: punchIn, out: punchOut } = getPunchForShift(selectedShift);
              const hasIn = !!punchIn; const hasOut = !!punchOut;
              const showEditFields = canEdit && !isFrozen(selectedShift);
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">{t.status ?? 'Stato'}:</span>
                    {!hasIn && !hasOut ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400"><AlertTriangle className="h-3 w-3" />{t.not_clocked ?? 'Non timbrato'}</span>
                    ) : hasIn && !hasOut ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-accent"><Clock className="h-3 w-3" />{t.clocked_in_only ?? 'Solo entrata'}</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400"><Check className="h-3 w-3" />{t.clocked_complete ?? 'Timbratura completa'}</span>
                    )}
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 p-3 space-y-3">
                    {showEditFields ? (
                      <>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">
                            {t.punch_in ?? 'Entrata'}
                            <span className="ml-2 text-[9px] text-white/30 font-normal normal-case">({t.planned ?? 'pianificato'}: {selectedShift.start_time?.slice(0, 5)})</span>
                          </label>
                          <TimeInputField value={editIn} onChange={setEditIn} size="md" onMinutesEnter={() => { editOutHourRef.current?.focus(); editOutHourRef.current?.select(); }} className={`w-full ${editIn ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/20 bg-white/10'}`} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">
                            {t.punch_out ?? 'Uscita'}
                            <span className="ml-2 text-[9px] text-white/30 font-normal normal-case">({t.planned ?? 'pianificato'}: {selectedShift.end_time?.slice(0, 5)})</span>
                          </label>
                          <TimeInputField value={editOut} onChange={setEditOut} size="md" hourInputRef={editOutHourRef} onMinutesEnter={handleSaveManualPunch} className={`w-full ${editOut ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/20 bg-white/10'}`} />
                        </div>
                        <button type="button" onClick={handleSaveManualPunch} disabled={saving || (!editIn && !editOut)}
                          className="w-full rounded-lg bg-accent px-4 py-2.5 text-[11px] font-bold text-white hover:bg-accent-hover disabled:opacity-40 transition-all uppercase tracking-wider">
                          {saving ? (t.saving ?? 'Salvataggio...') : <><Save className="h-3.5 w-3.5 inline-block mr-1.5" />{t.save_punches ?? 'Salva timbrature'}</>}
                        </button>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">{t.punch_in ?? 'Entrata'}</span>
                          <span className="text-[11px] font-bold text-white tabular-nums">{editIn || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">{t.punch_out ?? 'Uscita'}</span>
                          <span className="text-[11px] font-bold text-white tabular-nums">{editOut || '—'}</span>
                        </div>
                        {isFrozen(selectedShift) && (
                          <p className="text-[10px] text-amber-400/70 text-center pt-2">{t.wst_frozen_readonly_hint ?? 'Turno congelato — sola lettura'}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Breaks tab */}
            {detailTab === 'breaks' && selectedShift && (() => {
              const grossMins = calculateShiftMinutesGross(selectedShift.start_time ?? '', selectedShift.end_time ?? '');
              const breakMins = getBreakMinutesForShift({ ...selectedShift, deduct_break: deductBreak }, grossMins, selectedUser ?? null, breakRules);
              const netMins = Math.max(0, grossMins - breakMins);
              const hasAutoBreak = grossMins >= AUTO_BREAK_THRESHOLD_MINUTES && isAutoBreak;
              return (
                <div className="space-y-3">
                  <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-pink-600/10 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">{t.gross_hours ?? 'Ore lorde'}</span>
                      <span className="text-[11px] font-bold text-white tabular-nums">{formatMinutesToHoursAndMinutes(grossMins)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">{t.break_deduction ?? 'Detrazione pausa'}</span>
                      <span className="text-[11px] font-bold text-amber-400 tabular-nums">-{breakMins}'</span>
                    </div>
                    <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">{t.net_hours ?? 'Ore nette'}</span>
                      <span className="text-sm font-black text-emerald-400 tabular-nums">{formatMinutesToHoursAndMinutes(netMins)}</span>
                    </div>
                  </div>
                  {!isFrozen(selectedShift) && (
                  <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-pink-600/10 p-3 space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={deductBreak} onChange={handleDeductBreakToggle}
                        className="w-4 h-4 rounded border-white/30 bg-white/10 accent-accent" />
                      <div>
                        <span className="text-[11px] font-bold text-white">{t.deduct_break_label ?? 'Detrae pausa'}</span>
                        <p className="text-[9px] text-white/40">{deductBreak ? (t.break_deducted_readout ?? 'La pausa viene detratta dalle ore nette.') : (t.break_not_deducted ?? 'Pausa non detratta.')}</p>
                      </div>
                    </label>
                    {deductBreak && hasAutoBreak && (
                      <label className="flex items-center gap-3 cursor-pointer ml-4 mt-1">
                        <input type="checkbox" checked={isAutoBreak} onChange={handleAutoBreakToggle}
                          className="w-4 h-4 rounded border-white/30 bg-white/10 accent-accent" />
                        <div>
                          <span className="text-[10px] font-bold text-amber-400 animate-pulse">{t.auto_break_label ?? 'Pausa automatica (≥6h)'}</span>
                          <p className="text-[8px] text-white/40">{t.auto_break_hint ?? 'Turni di almeno 6 ore: -30 min per fascia pasto'}</p>
                        </div>
                      </label>
                    )}
                  </div>
                  )}
                </div>
              );
            })()}

            {/* History tab */}
            {detailTab === 'history' && (
              <div className="rounded-xl bg-gradient-to-br from-slate-600/20 to-slate-700/20 p-4 text-center">
                <p className="text-xs text-white/40">{t.history_empty ?? 'Cronologia non disponibile per questo turno.'}</p>
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {/* ── Create Shift Modal ── */}
      {createModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setCreateModal(null)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/15 p-5 shadow-2xl z-10 bg-white/[0.04]" style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-4">{t.create_shift ?? 'Nuovo turno'}</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">{t.start_time ?? 'Inizio'}</label>
                <TimeInputField value={createStart} onChange={setCreateStart} size="md" className="w-full border-white/20 bg-white/10" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">{t.end_time ?? 'Fine'}</label>
                <TimeInputField value={createEnd} onChange={setCreateEnd} size="md" className="w-full border-white/20 bg-white/10" />
              </div>
              <ShiftSlotPresetsSection
                startTime={createStart}
                endTime={createEnd}
                onApply={(start, end) => {
                  setCreateStart(start);
                  setCreateEnd(end);
                }}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCreateModal(null)}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2.5 text-[11px] font-bold text-white/70 hover:text-white transition-colors uppercase tracking-wider">{t.cancel ?? 'Annulla'}</button>
              <button type="button" onClick={handleCreateShift} disabled={saving}
                className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-[11px] font-bold text-white hover:bg-accent-hover disabled:opacity-40 transition-all uppercase tracking-wider">
                <Plus className="h-3.5 w-3.5 inline-block mr-1.5" />{t.create ?? 'Crea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PinPad Modal per sbloccare turno congelato ── */}
      {panelPinModalOpen && (
        <PinPadModal
          title={t.wst_freeze_pin_title ?? 'Sblocca turno'}
          subtitle={t.wst_freeze_pin_subtitle ?? 'Inserisci il PIN del manager/assistant per sbloccare il turno'}
          pinLabel={t.wst_pin_label ?? 'PIN'}
          pin={panelPin}
          onPinChange={setPanelPin}
          onConfirm={handleUnfreezeWithPin}
          onCancel={() => { setPanelPinModalOpen(false); setPanelPinTargetShiftId(null); setPanelPin(''); setPanelPinError(''); }}
          error={panelPinError}
          isLoading={saving}
          confirmLabel={t.confirm ?? 'Conferma'}
          cancelLabel={t.cancel ?? 'Annulla'}
        />
      )}
    </div>
  );
}
