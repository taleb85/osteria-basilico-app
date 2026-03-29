import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { format, startOfWeek, endOfWeek, addDays, parseISO, isToday, eachDayOfInterval, getDay } from 'date-fns';
import { database } from '../lib/database';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ChevronUp, Plus, X, Check, Cloud, Loader2, MessageSquare, Pencil, Clock, Trash2, ChevronDown, Copy, Download, Info, EyeOff, Eye, History, Filter, UserCheck, UserX, FileEdit, Lock, Menu } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useMinViewportMd } from '../hooks/useMinViewportMd';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { CenteredModalPortal } from './ui/CenteredModalPortal';
import { Shift, type ApprovalStatus, type PunchAuditEntry, type ShiftType } from '../types';
import {
  calculateShiftMinutesGross,
  getActualShiftTime,
  getPunchDelayMinutes,
  formatMinutesToHoursAndMinutes,
  hasShiftConflictSameDay,
  normalizeTimeInputToHHmm as toHHmm,
} from '../utils/timeCalculations';
import {
  getPunchPairForShift,
  getResolvedStartEndForHours,
  punchTimeHHMM,
  shiftPastPlannedEndWithoutClockIn,
  type PunchRecordLike,
} from '../utils/shiftResolvedClockTimes';
import { isShiftPayrollFrozen } from '../utils/timesheetFreezeCriteria';
import { getTranslations, getDateLocale, getIntlLocale, formatTrans } from '../utils/translations';
import { getShiftViolations, DEFAULT_WORK_RULES } from '../utils/workRules';
import { getBreakMinutesForShift, getNetShiftMinutes } from '../utils/breakRules';
import {
  isPurelyManagementRole,
  isManagementRole,
  isUserVisibleOnTeamSchedule,
  canEditTeamShifts,
  canPublishScheduleDrafts,
  canApproveShiftActions,
} from '../utils/permissions';
import { isUiWidgetVisible } from '../utils/uiScreenWidgets';
import { isFeatureEnabled, isAdminModuleEnabled } from '../utils/enabledFeatures';
import { getHiddenDates, toggleHiddenDate } from '../utils/hiddenPeriods';
import { getHistory, type HistoryEntry } from '../utils/scheduleHistory';
import { getDepartments, getDeptColor } from '../utils/departments';
import { translateDepartmentValue } from '../utils/departmentLabels';
import {
  loadPeriodConfig,
  savePeriodConfig as persistPeriodConfig,
  getPeriodStartDate,
  getPeriodEndDate,
  weekIndexForDateInPeriod,
  dispatchPeriodConfigUpdated,
  type PeriodConfig,
} from '../utils/periodConfig';
import { exportSchedulePDF } from '../utils/exportSchedulePDF';
import { getPayrollPaymentDateForCalendarMonth } from '../utils/payrollSchedule';
import { safeFormatDate } from '../utils/safeDateFormat';
import { saveTimesheetPeriodToSupabase } from '../utils/timesheetPeriodSupabase';
import { motion, AnimatePresence } from 'framer-motion';
import DatePickerField from './DatePickerField';
import { TimeInputField } from './ui/TimeInputField';
import { isDatePickerPortalClick } from '../utils/datePickerPortal';
import { HorizontalScrollArea } from './HorizontalScrollArea';

/**
 * ── WEB vs MOBILE (breakpoint sm = 640px) ─────────────────────────────────────
 * WEB (sm e oltre): settimana intera visibile, niente scroll orizzontale, checkbox
 *   selezione solo al hover, orari estesi "10:00 – 16:00".
 * MOBILE (sotto sm): ~3 giorni visibili, scroll orizzontale fluido (sync barra date ↔ tabelle,
 *   overscroll contenuto, niente cambio settimana da swipe), orari compatti "10–16", checkbox
 *   sempre visibile e più grande, celle più alte e padding maggiore. Settimana: frecce in barra.
 * Le modifiche responsive usano il prefisso sm: per “solo web”.
 *
 * Creazione / modifica turni (management): solo viewport ≥ md (768px) — tablet e PC, non telefono.
 */

/** Stato turno dal DB (case / spazi / null). */
function normalizedApprovalStatus(status: Shift['approval_status'] | undefined | null): string {
  return (status ?? '').toString().trim().toLowerCase();
}

function isShiftDraftLike(shift: Pick<Shift, 'approval_status'>): boolean {
  const s = normalizedApprovalStatus(shift.approval_status);
  return s === 'draft' || s === '';
}

function isShiftFrozenRecord(shift: Pick<Shift, 'approval_status' | 'approved_at'>): boolean {
  return isShiftPayrollFrozen(shift);
}

function isShiftAbsentRecord(shift: Pick<Shift, 'approval_status'>): boolean {
  return normalizedApprovalStatus(shift.approval_status) === 'absent';
}

type DrawerTimbratureMode = 'device' | 'manual' | 'frozen';

function punchAuditTouches(
  audits: PunchAuditEntry[],
  punchId: string | undefined,
  fields: readonly string[]
): boolean {
  if (!punchId) return false;
  return audits.some((a) => a.punch_record_id === punchId && fields.includes(a.field));
}

/** Dettaglio drawer: orari timbratura effettivi (timestamp dispositivo) o valori congelati; modalità da audit. */
function computeDrawerTimbratureDisplay(
  shift: Shift,
  punchRecords: PunchRecordLike[],
  audits: PunchAuditEntry[]
): {
  inTime: string;
  outTime: string;
  inMode: DrawerTimbratureMode | null;
  outMode: DrawerTimbratureMode | null;
} {
  const pair = getPunchPairForShift(shift, punchRecords);
  const resolved = getResolvedStartEndForHours(shift, punchRecords);
  const inPid = pair.punchIn?.id;
  const outPid = pair.punchOut?.id;

  let inTime = '—';
  let outTime = '—';
  let inMode: DrawerTimbratureMode | null = null;
  let outMode: DrawerTimbratureMode | null = null;

  if (pair.punchIn) {
    inTime = punchTimeHHMM(pair.punchIn.timestamp) ?? '—';
    inMode = punchAuditTouches(audits, inPid, ['timestamp', 'calculated_time']) ? 'manual' : 'device';
  } else if (resolved.source === 'frozen') {
    const aS = (shift.approved_start_time || '').trim().slice(0, 5);
    if (aS) {
      inTime = aS;
      inMode = 'frozen';
    }
  }

  const clockOut = pair.punchIn?.clock_out_time;
  if (clockOut) {
    outTime = punchTimeHHMM(clockOut) ?? '—';
    outMode = punchAuditTouches(audits, inPid, ['clock_out_time']) ? 'manual' : 'device';
  } else if (pair.punchOut) {
    outTime = punchTimeHHMM(pair.punchOut.timestamp) ?? '—';
    outMode = punchAuditTouches(audits, outPid, ['timestamp', 'calculated_time']) ? 'manual' : 'device';
  } else if (resolved.source === 'frozen') {
    const aE = (shift.approved_end_time || '').trim().slice(0, 5);
    if (aE) {
      outTime = aE;
      outMode = 'frozen';
    }
  }

  return { inTime, outTime, inMode, outMode };
}

/** Formato compatto per mobile: "10:00" -> "10", "10:30" -> "10:30", "___" o vuoto -> "–". */
function toShortTime(t: string): string {
  const s = (t || '').trim().slice(0, 5);
  if (!/^\d{1,2}:\d{2}$/.test(s)) return '–';
  const [, min] = s.split(':');
  return min === '00' ? s.slice(0, 2) : s;
}

/**
 * Parsifica input rapido stile "10-16" o "10:00-16:00" o "19:30" in {start, end}.
 * Supporta separatori: - – spazio. Digits-only h "1016" → "10:00"-"16:00".
 * Se non c'è end, applica la regola 10→16.
 */
function parseCellTimeInput(raw: string): { start: string; end: string } | null {
  const v = raw.trim();
  if (!v) return null;

  // Full "10:00-16:00" or "10:30 – 23:00"
  const fullRe = /^(\d{1,2}):(\d{2})\s*[-–\s]\s*(\d{1,2}):(\d{2})$/;
  const fm = v.match(fullRe);
  if (fm) {
    const h1 = parseInt(fm[1], 10), m1 = parseInt(fm[2], 10);
    const h2 = parseInt(fm[3], 10), m2 = parseInt(fm[4], 10);
    if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;
    return {
      start: `${fm[1].padStart(2,'0')}:${fm[2]}`,
      end:   `${fm[3].padStart(2,'0')}:${fm[4]}`,
    };
  }
  // Simple hours "10-16" or "10 16"
  const simpleRe = /^(\d{1,2})\s*[-–\s]\s*(\d{1,2})$/;
  const sm = v.match(simpleRe);
  if (sm) {
    const h1 = parseInt(sm[1], 10), h2 = parseInt(sm[2], 10);
    if (h1 > 23 || h2 > 23) return null;
    return {
      start: `${sm[1].padStart(2,'0')}:00`,
      end:   `${sm[2].padStart(2,'0')}:00`,
    };
  }
  // Compact "1016" → "10:00"-"16:00"
  const compactRe = /^(\d{2})(\d{2})$/;
  const cm = v.match(compactRe);
  if (cm) {
    const h1 = parseInt(cm[1], 10), h2 = parseInt(cm[2], 10);
    if (h1 > 23 || h2 > 23) return null;
    return { start: `${cm[1]}:00`, end: `${cm[2]}:00` };
  }
  // Single start "10" or "10:30"
  const singleRe = /^(\d{1,2})(?::(\d{2}))?$/;
  const xm = v.match(singleRe);
  if (xm) {
    const start = `${xm[1].padStart(2,'0')}:${xm[2] ?? '00'}`;
    return { start, end: start === '10:00' ? '16:00' : '' };
  }
  return null;
}

// ── Open shift helpers ──────────────────────────────────────────────────────
/** Vero se il turno è aperto (non assegnato) o in richiesta di assegnazione. */
const OPEN_SHIFTS_BAR_COLLAPSED_KEY = 'osteria_wst_open_shifts_bar_collapsed';

/** Etichetta ruolo breve — allineata allo stile UserAvatarMenu (toolbar). */
function scheduleDrawerRoleLabel(role: string | undefined): string {
  const m: Record<string, string> = {
    admin: 'Admin',
    proprietario: 'Manager',
    manager: 'Manager',
    assistant_manager: 'Ass. Manager',
    waiter: 'Sala',
    server: 'Sala',
    capo: 'Capo',
    cook: 'Cucina',
    chef: 'Cucina',
    bartender: 'Bar',
    dishwasher: 'Pulizie',
  };
  return m[(role || '').toLowerCase().trim()] ?? (role ? role.slice(0, 12) : '');
}

const isOpenShiftRecord = (s: { notes?: string }) =>
  !!(s.notes && (s.notes.startsWith('__OPEN__') || s.notes.startsWith('__OPEN_REQ__')));

/** Vero se qualcuno ha già richiesto il turno aperto. */
const isRequestedShift = (s: { notes?: string }) =>
  !!(s.notes && s.notes.startsWith('__OPEN_REQ__'));

/** Restituisce id e nome del richiedente, o null. */
const getRequester = (s: { notes?: string }): { id: string; name: string } | null => {
  if (!isRequestedShift(s)) return null;
  // Format: __OPEN_REQ__:userId:nome[:nota]
  const after = (s.notes ?? '').slice('__OPEN_REQ__:'.length);
  const colonIdx = after.indexOf(':');
  if (colonIdx === -1) return null;
  const id = after.slice(0, colonIdx);
  const rest = after.slice(colonIdx + 1);
  const name = rest.split(':')[0] ?? '?';
  return id ? { id, name } : null;
};

/** Primo antenato con scroll verticale (pannello staff); altrimenti null = viewport. */
function findVerticalScrollParent(el: HTMLElement | null): Element | null {
  if (typeof window === 'undefined' || !el) return null;
  let p: HTMLElement | null = el.parentElement;
  while (p && p !== document.documentElement) {
    const { overflowY } = window.getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
    p = p.parentElement;
  }
  return null;
}

/** Sentinel sopra la barra date: non più visibile sopra il bordo superiore del root ⇒ barra sticky “agganciata”. */
function isDateBarStuckPast(entry: IntersectionObserverEntry): boolean {
  if (entry.isIntersecting) return false;
  const rootTop = entry.rootBounds?.top ?? 0;
  return entry.boundingClientRect.bottom < rootTop;
}

/** Estrae la nota pubblica originale dal turno aperto (rimuove i prefissi). */
const getOpenShiftPublicNote = (s: { notes?: string }): string => {
  const n = s.notes ?? '';
  if (n.startsWith('__OPEN_REQ__:')) {
    const parts = n.split(':');
    // [0]=__OPEN_REQ__, [1]=userId, [2]=nome, [3+]=nota
    return parts.slice(3).join(':');
  }
  return n.replace(/^__OPEN__:?/, '');
};
// ────────────────────────────────────────────────────────────────────────────

interface WeeklyShiftsTableProps {
  filterUserId?: string;
  /** Se true, la tabella sta in un contenitore con overflow-y (es. app staff): sticky barra date con top-0 sul pannello, non offset viewport. */
  stickyDateBarInScrollPane?: boolean;
}

export default function WeeklyShiftsTable({ filterUserId, stickyDateBarInScrollPane = false }: WeeklyShiftsTableProps = {}) {
  const initialPeriod = loadPeriodConfig();
  const [periodConfig, setPeriodConfig] = useState(initialPeriod);
  const [periodDraftStart, setPeriodDraftStart] = useState<string>(initialPeriod.startDate);
  const [periodDraftNumWeeks, setPeriodDraftNumWeeks] = useState<4 | 5>(initialPeriod.numWeeks);
  const [periodDraftSaved, setPeriodDraftSaved] = useState(true);
  const [weekIndex, setWeekIndex] = useState(() => weekIndexForDateInPeriod(initialPeriod));

  // Quando la scheda diventa attiva, riporta la visualizzazione alla settimana corrente
  useEffect(() => {
    const currentWeekIdx = weekIndexForDateInPeriod(periodConfig);
    if (weekIndex !== currentWeekIdx) {
      setWeekIndex(currentWeekIdx);
    }
  }, [periodConfig]);
  const [viewMode, setViewMode] = useState<'week' | '2weeks' | 'day' | 'month'>('week');
  /** Vista periodo: offset in settimane; frecce spostano di un intero periodo di paga (4 o 5 sett.). */
  const [periodPanOffsetWeeks, setPeriodPanOffsetWeeks] = useState(0);

  useEffect(() => {
    const handler = () => {
      const cfg = loadPeriodConfig();
      setPeriodConfig(cfg);
      setPeriodDraftStart(cfg.startDate);
      setPeriodDraftNumWeeks(cfg.numWeeks);
      setPeriodDraftSaved(true);
    };
    window.addEventListener('osteria_period_updated', handler);
    return () => window.removeEventListener('osteria_period_updated', handler);
  }, []);

  const [wstToolbarDrawerOpen, setWstToolbarDrawerOpen] = useState(false);
  const [wstToolbarDrawerSection, setWstToolbarDrawerSection] = useState<
    null | 'filters' | 'legend' | 'department'
  >(null);
  const [templatesList, setTemplatesList] = useState<string[]>([]);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const wstToolbarDrawerRef = useRef<HTMLDivElement | null>(null);
  const wstDeptDrawerRef = useRef<HTMLDivElement | null>(null);
  const wstToolbarModalRef = useRef<HTMLDivElement | null>(null);
  /** Pannello modale dettaglio turno (portal su body): escluso da clear selezione su pointerdown fuori tabella. */
  const shiftDetailModalPanelRef = useRef<HTMLDivElement | null>(null);
  const closeWstToolbarDrawer = useCallback(() => {
    setWstToolbarDrawerOpen(false);
    setWstToolbarDrawerSection(null);
  }, []);
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [bulkEditStart, setBulkEditStart] = useState('');
  const [bulkEditEnd, setBulkEditEnd] = useState('');
  const [bulkEditStatus, setBulkEditStatus] = useState<'' | 'draft' | 'confirmed'>('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [hiddenDates, setHiddenDates] = useState<Set<string>>(() => getHiddenDates());
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showHiddenPeriodsModal, setShowHiddenPeriodsModal] = useState(false);
  const [clipboardShifts, setClipboardShifts] = useState<{
    shifts: Array<{
      user_id: string;
      start_time: string;
      end_time: string;
      type: ShiftType;
      deduct_break?: boolean;
      dayOffset: number;
    }>;
    sourceDays: number;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarDay, setSidebarDay] = useState<string>('');
  const [sidebarEdits, setSidebarEdits] = useState<Record<string, { start: string; end: string; deduct_break?: boolean }>>({});
  const [sidebarSaving, setSidebarSaving] = useState(false);
  const [sidebarMenuShiftId, setSidebarMenuShiftId] = useState<string | null>(null);
  const [sidebarStatusSubmenuShiftId, setSidebarStatusSubmenuShiftId] = useState<string | null>(null);
  /** Audit punch per il drawer singolo turno (modalità manuale vs dispositivo). */
  const [drawerPunchAudits, setDrawerPunchAudits] = useState<PunchAuditEntry[]>([]);
  const [drawerDeleteConfirm, setDrawerDeleteConfirm] = useState<string | null>(null);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const sidebarMenuRef = useRef<HTMLDivElement | null>(null);
  const [dragSelect, setDragSelect] = useState<{ userIdx: number; dayIdx: number; slotIdx: number } | null>(null);
  const dragStartRef = useRef<{ userIdx: number; dayIdx: number; slotIdx: number } | null>(null);
  const dragSelectRef = useRef(dragSelect);
  dragSelectRef.current = dragSelect;
  const [creatingShift, setCreatingShift] = useState<{ userId: string; date: string; defaultTime: string } | null>(null);
  const [creatingOpenShift, setCreatingOpenShift] = useState<{ date: string } | null>(null);
  const [openShiftsBarCollapsed, setOpenShiftsBarCollapsed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const dateBarScrollRef = useRef<HTMLDivElement>(null);
  const dateBarSentinelRef = useRef<HTMLDivElement | null>(null);
  const [dateBarStuck, setDateBarStuck] = useState(false);
  const footerTotalsScrollRef = useRef<HTMLDivElement | null>(null);
  const cardScrollRefs = useRef<(HTMLDivElement | null)[]>([]);
  const syncScrollFromProgrammatic = useRef(false);
  const syncScrollLeft = useCallback((source: HTMLDivElement | null) => {
    if (!source || syncScrollFromProgrammatic.current) return;
    const maxS = source.scrollWidth - source.clientWidth;
    const ratio = maxS <= 0 ? 0 : source.scrollLeft / maxS;

    syncScrollFromProgrammatic.current = true;
    requestAnimationFrame(() => {
      const apply = (el: HTMLDivElement | null) => {
        if (!el || el === source) return;
        const maxT = el.scrollWidth - el.clientWidth;
        const next = maxT <= 0 ? 0 : ratio * maxT;
        if (Math.abs(el.scrollLeft - next) > 0.5) el.scrollLeft = next;
      };
      apply(dateBarScrollRef.current);
      apply(footerTotalsScrollRef.current);
      cardScrollRefs.current.forEach(apply);
      syncScrollFromProgrammatic.current = false;
    });
  }, []);

  /** Periodo pianificazione effettivo (bozza in Azioni finché non salvato). Vista mese: giorni attivi solo qui. */
  const displayPeriodConfig: PeriodConfig = useMemo(() => {
    if (periodDraftSaved) return periodConfig;
    const startStr = periodDraftStart.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr)) {
      return { startDate: periodConfig.startDate, numWeeks: periodDraftNumWeeks };
    }
    const d = parseISO(startStr);
    if (Number.isNaN(d.getTime())) {
      return { startDate: periodConfig.startDate, numWeeks: periodDraftNumWeeks };
    }
    return { startDate: startStr, numWeeks: periodDraftNumWeeks };
  }, [periodDraftSaved, periodConfig, periodDraftStart, periodDraftNumWeeks]);

  useEffect(() => {
    setPeriodPanOffsetWeeks(0);
  }, [displayPeriodConfig.startDate, displayPeriodConfig.numWeeks]);

  const periodStartDate = getPeriodStartDate(periodConfig);
  const maxWeekIndex = periodConfig.numWeeks - 1;
  const weekStart = addDays(periodStartDate, Math.min(weekIndex, maxWeekIndex) * 7);
  const weekStr = format(weekStart, 'yyyy-MM-dd');

  useEffect(() => {
    setWeekIndex((i) => Math.min(i, maxWeekIndex));
  }, [maxWeekIndex]);

  useEffect(() => {
    syncScrollFromProgrammatic.current = true;
    if (dateBarScrollRef.current) dateBarScrollRef.current.scrollLeft = 0;
    if (footerTotalsScrollRef.current) footerTotalsScrollRef.current.scrollLeft = 0;
    cardScrollRefs.current.forEach((ref) => { if (ref) ref.scrollLeft = 0; });
    requestAnimationFrame(() => { syncScrollFromProgrammatic.current = false; });
  }, [weekIndex]);

  /** Ombra più marcata quando la barra date è in sticky (scroll verso il basso). */
  useLayoutEffect(() => {
    const sentinel = dateBarSentinelRef.current;
    if (!sentinel) return;

    const root = findVerticalScrollParent(sentinel);
    const observer = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        setDateBarStuck(isDateBarStuckPast(e));
      },
      {
        root: root instanceof Element ? root : null,
        threshold: 0,
        rootMargin: '0px',
      }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [weekIndex, viewMode, displayPeriodConfig.startDate, displayPeriodConfig.numWeeks, periodPanOffsetWeeks, stickyDateBarInScrollPane]);

  // GestioneTurni: click-to-filter by employee
  const [localFilterUserId, setLocalFilterUserId] = useState<string | null>(null);
  // Filtro per reparto (sala, kitchen, bar)
  const [localFilterDepartment, setLocalFilterDepartment] = useState<string>('');
  const [localFilterStatus, setLocalFilterStatus] = useState<
    'all' | 'approved' | 'confirmed' | 'draft' | 'absent' | 'unpunched'
  >('all');
  // Cloud sync indicator
  const [pendingSaves, setPendingSaves] = useState(0);
  const [justSynced, setJustSynced] = useState(false);
  // Drag-to-reorder employee rows
  const [userOrderOverride, setUserOrderOverride] = useState<string[] | null>(null);
  const [draggingUserIdx, setDraggingUserIdx] = useState<number | null>(null);
  const [dropUserIdx, setDropUserIdx] = useState<number | null>(null);
  const [editingNameUserId, setEditingNameUserId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [showEditViewModal, setShowEditViewModal] = useState(false);
  const [draggingEditViewUserId, setDraggingEditViewUserId] = useState<string | null>(null);
  const [dropTargetEditViewIdx, setDropTargetEditViewIdx] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  void setSavingOrder; // reserved for future drag-reorder save
  const isWideShiftViewport = useMinViewportMd();
  const { users, shifts, holidays, availability, toggleAvailability, updateShift, updateUser, currentUser, punchRecords, addShift, deleteShifts, showError, showSuccess, silentRefreshData, requestConfirmAndSaveOrder, requestConfirmAndPublishWeek, postRefreshLocked, effectiveLanguage, workRules, breakRules, featureFlags, departmentsRevision } = useApp();
  void departmentsRevision;
  const t = getTranslations(effectiveLanguage);
  const tv = t as Record<string, string>;
  const breakComputeOpts = useMemo(
    () => ({ autoBreaksFeatureEnabled: featureFlags['auto_breaks'] !== false }),
    [featureFlags]
  );

  /** Merge con default: stessi valori della UI Impostazioni; niente `!== false` su 0/null che tengono il chrome acceso con switch spenti. */
  const effectiveWorkRules = useMemo(
    () => ({ ...DEFAULT_WORK_RULES, ...workRules }),
    [workRules]
  );

  /** Stesso criterio di HolidayRequests: refresh DB senza check revisione cloud (niente blocco PIN aprendo la scheda). */
  useEffect(() => {
    void silentRefreshData({ skipRemoteRevisionCheck: true });
  }, [silentRefreshData]);

  /** Allo sblocco dopo conferma PIN (o annullamento), usa l'ordine dal server. */
  useEffect(() => {
    if (!postRefreshLocked) setUserOrderOverride(null);
  }, [postRefreshLocked]);


  /** Finestra vista periodo (frecce = ± un periodo di paga, stessa lunghezza di Azioni). */
  const monthViewPeriodStart = useMemo(
    () => addDays(getPeriodStartDate(displayPeriodConfig), periodPanOffsetWeeks * 7),
    [displayPeriodConfig, periodPanOffsetWeeks]
  );
  const monthViewPeriodEnd = useMemo(
    () => addDays(getPeriodEndDate(displayPeriodConfig), periodPanOffsetWeeks * 7),
    [displayPeriodConfig, periodPanOffsetWeeks]
  );

  const isDayInMonthViewWindow = useCallback(
    (d: Date) => {
      const s = format(d, 'yyyy-MM-dd');
      return s >= format(monthViewPeriodStart, 'yyyy-MM-dd') && s <= format(monthViewPeriodEnd, 'yyyy-MM-dd');
    },
    [monthViewPeriodStart, monthViewPeriodEnd]
  );

  const allWeekDays = useMemo(() => {
    if (viewMode === 'month') {
      const calStart = startOfWeek(monthViewPeriodStart, { weekStartsOn: 1 });
      const calEnd = endOfWeek(monthViewPeriodEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: calStart, end: calEnd });
    }
    if (viewMode === 'day') {
      return [weekStart];
    }
    const n = viewMode === '2weeks' ? 14 : 7;
    const periodEndDate = addDays(periodStartDate, periodConfig.numWeeks * 7 - 1);
    const lastDay = addDays(weekStart, n - 1);
    const capped = lastDay > periodEndDate ? Math.max(1, Math.ceil((periodEndDate.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000))) : n;
    return Array.from({ length: capped }, (_, i) => addDays(weekStart, i));
  }, [weekStart, periodStartDate, periodConfig.numWeeks, viewMode, monthViewPeriodStart, monthViewPeriodEnd]);

  /** Data pagamento unica per la finestra (mese civile della fine periodo visibile), come Presenze. */
  const periodViewPrimaryPayrollStr = useMemo(
    () => format(getPayrollPaymentDateForCalendarMonth(monthViewPeriodEnd), 'yyyy-MM-dd'),
    [monthViewPeriodEnd]
  );

  const periodPayrollChipDatesWst = useMemo(() => {
    const pay = getPayrollPaymentDateForCalendarMonth(monthViewPeriodEnd);
    const loc = getDateLocale(effectiveLanguage) ?? it;
    return format(pay, 'd MMM yyyy', { locale: loc });
  }, [monthViewPeriodEnd, effectiveLanguage]);

  /** Settimana / 2 sett. / giorno: solo la paga del mese della **fine** periodo. Vista mese periodo: stesso criterio sulla finestra (fine periodo visibile). */
  const weekSchedulePayrollDayStr = useMemo(
    () => format(getPayrollPaymentDateForCalendarMonth(getPeriodEndDate(displayPeriodConfig)), 'yyyy-MM-dd'),
    [displayPeriodConfig]
  );

  /** Template: carica lista nomi da Supabase */
  const loadTemplatesList = useCallback(async () => {
    try {
      const names = await database.shiftTemplates.listAll();
      setTemplatesList(names);
    } catch { /* ignora */ }
  }, []);

  /** Template: salva la settimana corrente come template */
  const handleSaveTemplate = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setSavingTemplate(true);
    try {
      const weekStr = format(weekStart, 'yyyy-MM-dd');
      const n = viewMode === 'day' ? 1 : viewMode === '2weeks' ? 14 : 7;
      const weekEnd = format(addDays(weekStart, n), 'yyyy-MM-dd');
      const weekShifts = shifts.filter((s) => s.date >= weekStr && s.date < weekEnd);
      const entries = weekShifts.map((s) => ({
        day_of_week: getDay(parseISO(s.date)),
        user_id: s.user_id,
        start_time: s.start_time,
        end_time: s.end_time,
        type: s.type,
      }));
      await database.shiftTemplates.save(name.trim(), entries);
      setSaveTemplateName('');
      await loadTemplatesList();
      (showSuccess || showError)(t.template_saved);
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      const detail = [err.message, err.code].filter(Boolean).join(' — ');
      if (import.meta.env.DEV) console.warn('[shift template save]', e);
      (showError ?? (() => {}))(detail ? `${t.template_save_error} (${detail})` : t.template_save_error);
    }
    setSavingTemplate(false);
  }, [weekStart, viewMode, shifts, loadTemplatesList, showSuccess, showError, t]);

  /** Template: applica un template alla settimana corrente (crea turni in bozza) */
  const handleApplyTemplate = useCallback(async (name: string) => {
    try {
      const entries = await database.shiftTemplates.load(name);
      if (!entries) return;
      let created = 0;
      let skipped = 0;
      for (const entry of entries) {
        const targetDay = allWeekDays.find((d) => getDay(d) === entry.day_of_week);
        if (!targetDay) { skipped++; continue; }
        const dateStr = format(targetDay, 'yyyy-MM-dd');
        try {
          const res = await addShift({ user_id: entry.user_id, date: dateStr, start_time: entry.start_time, end_time: entry.end_time, type: entry.type as 'lunch' | 'dinner', approval_status: 'draft' });
          if (res) created++; else skipped++;
        } catch { skipped++; }
      }
      const msg = skipped > 0
        ? formatTrans(t.template_applied_with_skipped, { base: t.template_applied, created, skipped })
        : formatTrans(t.template_applied_created_only, { base: t.template_applied, created });
      (showSuccess || showError)(msg);
    } catch { (showError ?? (() => {}))(t.template_apply_error); }
  }, [allWeekDays, addShift, showSuccess, showError, t]);

  /** Template: elimina un template */
  const handleDeleteTemplate = useCallback(async (name: string) => {
    if (!window.confirm(t.template_delete_confirm)) return;
    try {
      await database.shiftTemplates.delete(name);
      await loadTemplatesList();
    } catch { (showError ?? (() => {}))(t.template_delete_error); }
  }, [loadTemplatesList, showError, t]);

  /** Traccia salvataggi in corso (per spinner cloud). Spostato prima degli useCallback che lo usano. */
  const trackSave = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setPendingSaves(n => n + 1);
    try { return await fn(); }
    finally { setPendingSaves(n => n - 1); }
  }, []);

  /** Persist solo pianificazione (orari + pausa) dal drawer, solo in bozza. Timbrature solo da Scheda presenze. */
  const persistDrawerSingleShift = useCallback(
    async (shiftId: string): Promise<boolean> => {
      const shift = shifts.find((s) => s.id === shiftId);
      if (!shift) return false;
      if (isShiftFrozenRecord(shift)) return false;
      if (isShiftAbsentRecord(shift)) return false;
      if (!isShiftDraftLike(shift)) return true;

      const stored = sidebarEdits[shiftId];
      const edits = stored ?? {
        start: (shift.start_time || '').slice(0, 5),
        end: (shift.end_time || '').slice(0, 5),
        deduct_break: shift.deduct_break !== false,
      };
      const startVal = toHHmm(edits.start) || shift.start_time || '';
      const endVal = toHHmm(edits.end) || shift.end_time || '';
      const deductBreakVal = edits.deduct_break ?? (shift.deduct_break !== false);
      const shiftUpdates: Partial<import('../types').Shift> = {};
      if (startVal) {
        const others = shifts.filter((s) => s.user_id === shift.user_id && s.date === shift.date && s.id !== shiftId);
        if (hasShiftConflictSameDay(others, { start_time: startVal, end_time: endVal }, shiftId)) {
          showError?.(t.shift_conflict_same_day);
          return false;
        }
        shiftUpdates.start_time = startVal;
        shiftUpdates.end_time = endVal;
      }
      shiftUpdates.deduct_break = deductBreakVal;
      if (Object.keys(shiftUpdates).length > 0) {
        await updateShift(shiftId, shiftUpdates);
      }
      return true;
    },
    [shifts, sidebarEdits, updateShift, showError, t]
  );

  /** Staff: invia richiesta per un turno aperto (non assegna direttamente). */
  const handleClaimOpenShift = useCallback(async (shiftId: string) => {
    if (!currentUser) return;
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    // Evita doppie richieste
    if (getRequester(shift)?.id === currentUser.id) return;
    const publicNote = getOpenShiftPublicNote(shift);
    const newNotes = publicNote
      ? `__OPEN_REQ__:${currentUser.id}:${currentUser.first_name}:${publicNote}`
      : `__OPEN_REQ__:${currentUser.id}:${currentUser.first_name}`;
    await trackSave(async () => {
      try {
        await updateShift(shiftId, { notes: newNotes });
        showSuccess?.(t.open_shift_request_sent);
      } catch { showError?.(t.open_shift_request_send_error); }
    });
  }, [currentUser, shifts, updateShift, trackSave, showSuccess, showError, t]);

  /** Manager: approva la richiesta → assegna turno al richiedente. */
  const handleApproveOpenShift = useCallback(async (shiftId: string) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    const requester = getRequester(shift);
    if (!requester) return;
    const publicNote = getOpenShiftPublicNote(shift);
    await trackSave(async () => {
      try {
        await updateShift(shiftId, { user_id: requester.id, notes: publicNote || undefined });
        showSuccess?.(formatTrans(t.shift_assigned_to, { name: requester.name }));
      } catch { showError?.(t.open_shift_approve_error); }
    });
  }, [shifts, updateShift, trackSave, showSuccess, showError, t]);

  /** Manager: rifiuta la richiesta → turno torna disponibile come aperto. */
  const handleRejectOpenShift = useCallback(async (shiftId: string) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    const publicNote = getOpenShiftPublicNote(shift);
    const newNotes = publicNote ? `__OPEN__:${publicNote}` : '__OPEN__';
    await trackSave(async () => {
      try {
        await updateShift(shiftId, { notes: newNotes });
        showSuccess?.(t.open_shift_reject_success);
      } catch { showError?.(t.open_shift_reject_error); }
    });
  }, [shifts, updateShift, trackSave, showSuccess, showError, t]);

  const isManagement = currentUser ? isManagementRole(currentUser.role) : false;
  const canShiftOps =
    !!currentUser &&
    canEditTeamShifts(currentUser) &&
    (currentUser.role === 'admin' || isFeatureEnabled(currentUser, 'edit_shifts'));
  const canEditShifts = canShiftOps;
  /** Tablet / desktop (≥768px): tabellone interattivo (drag, lasso, crea da cella). */
  const canEditInApp = canEditShifts && isWideShiftViewport;
  /** Strumenti gestione (template, drag nomi, ecc.): stessa soglia viewport. */
  const canUseShiftManagementChrome = canShiftOps && isWideShiftViewport;
  const canViewTotalHours = currentUser ? isFeatureEnabled(currentUser, 'view_stats') : false;
  const canManageDrafts =
    !!currentUser &&
    canEditTeamShifts(currentUser) &&
    canPublishScheduleDrafts(currentUser) &&
    (currentUser.role === 'admin' || isFeatureEnabled(currentUser, 'edit_shifts'));
  const canApproveShifts =
    !!currentUser &&
    canApproveShiftActions(currentUser) &&
    (currentUser.role === 'admin' || isFeatureEnabled(currentUser, 'approve_shifts'));
  const isStaff = !isManagement;

  useEffect(() => {
    if (isStaff || !canManageDrafts) return;
    void loadTemplatesList();
  }, [isStaff, canManageDrafts, loadTemplatesList]);

  const closeShiftDetailPanel = useCallback(() => {
    setSidebarOpen(false);
    setSelectedShiftIds([]);
    setDrawerDeleteConfirm(null);
    setSidebarEdits({});
  }, []);

  const handleSavePeriodConfigWst = useCallback(() => {
    const cfg = { startDate: periodDraftStart, numWeeks: periodDraftNumWeeks };
    persistPeriodConfig(cfg);
    setPeriodConfig(cfg);
    setPeriodDraftSaved(true);
    setWeekIndex(0);
    dispatchPeriodConfigUpdated();
    showSuccess?.(t.ts_period_saved);
    void saveTimesheetPeriodToSupabase(cfg).catch(() => {
      showError?.(t.ts_period_cloud_failed);
    });
  }, [periodDraftStart, periodDraftNumWeeks, showSuccess, showError, t]);

  const wTurniToolbar = !isStaff && currentUser ? isUiWidgetVisible(currentUser, 'turni.toolbar_block') : true;
  const wTurniDate = !isStaff && currentUser ? isUiWidgetVisible(currentUser, 'turni.date_nav_bar') : true;
  const wTurniGrid = !isStaff && currentUser ? isUiWidgetVisible(currentUser, 'turni.schedule_grid') : true;
  const wStaffTable = isStaff && currentUser ? isUiWidgetVisible(currentUser, 'staff_shifts.table') : true;

  /** Numero di turni in bozza nella settimana visibile (per mostrare azione Pubblica). */
  const draftCountInWeek = useMemo(() => {
    const weekStr = format(weekStart, 'yyyy-MM-dd');
    const n = viewMode === '2weeks' ? 14 : viewMode === 'day' ? 1 : 7;
    const weekEnd = format(addDays(weekStart, n), 'yyyy-MM-dd');
    return shifts.filter((s) => s.approval_status === 'draft' && s.date >= weekStr && s.date < weekEnd).length;
  }, [shifts, weekStart, viewMode]);

  // Staff vede SOLO turni approvati o confermati (non bozze). Admin/Manager vedono tutto.
  // Filtro attivi: nascondi dalla tabella chiunque abbia status !== 'active'.
  const visibleUserIds = useMemo(
    () => new Set(users.filter((u) => isUserVisibleOnTeamSchedule(u, shifts)).map((u) => u.id)),
    [users, shifts]
  );
  const visibleShifts = useMemo(() => {
    let list = shifts.filter(s => visibleUserIds.has(s.user_id));
    if (isStaff)
      list = list.filter(
        (s) => s.approval_status === 'approved' || s.approval_status === 'confirmed' || s.approval_status === 'absent'
      );
    // I dipendenti non vedono turni in giorni nascosti dal manager
    if (isStaff) list = list.filter(s => !hiddenDates.has(s.date));
    if (filterUserId || localFilterUserId) list = list.filter(s => s.user_id === (localFilterUserId || filterUserId));
    if (localFilterStatus === 'approved') list = list.filter(s => s.approval_status === 'approved');
    if (localFilterStatus === 'confirmed') list = list.filter(s => s.approval_status === 'confirmed');
    if (localFilterStatus === 'draft') list = list.filter(s => s.approval_status === 'draft');
    if (localFilterStatus === 'absent') list = list.filter(s => s.approval_status === 'absent');
    return list;
  }, [shifts, visibleUserIds, isStaff, filterUserId, localFilterUserId, localFilterStatus, hiddenDates]);

  /** Allinea `sidebarDay` alla selezione; chiudi il popup solo se nessun turno o selezione su più giorni (es. drag rettangolo). */
  useEffect(() => {
    if (selectedShiftIds.length === 0) {
      setSidebarOpen(false);
      return;
    }
    const resolved = selectedShiftIds
      .map((id) => shifts.find((s) => s.id === id))
      .filter((s): s is Shift => !!s);
    if (resolved.length === 0) return;
    const dates = new Set(resolved.map((s) => s.date));
    if (dates.size > 1) {
      setSidebarOpen(false);
      return;
    }
    setSidebarDay([...dates][0]);
  }, [selectedShiftIds, shifts]);

  /** Bozza: inizializza subito `sidebarEdits` così orari e salvataggio non dipendono solo dal blur dei campi. */
  useEffect(() => {
    if (!sidebarOpen || !sidebarDay) return;
    const allDay = visibleShifts
      .filter((s) => s.date === sidebarDay)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    const selectedDayIds = selectedShiftIds.filter((id) => allDay.some((s) => s.id === id));
    const dayList =
      selectedDayIds.length > 0 ? allDay.filter((s) => selectedDayIds.includes(s.id)) : allDay;
    if (dayList.length !== 1) return;
    const shift = dayList[0];
    if (!isShiftDraftLike(shift)) return;
    setSidebarEdits((prev) => {
      if (prev[shift.id]) return prev;
      return {
        ...prev,
        [shift.id]: {
          start: (shift.start_time || '').slice(0, 5),
          end: (shift.end_time || '').slice(0, 5),
          deduct_break: shift.deduct_break !== false,
        },
      };
    });
  }, [sidebarOpen, sidebarDay, selectedShiftIds, visibleShifts]);

  /** Carica audit timbrature per un solo turno nel drawer (etichette «manuale» / dispositivo). */
  useEffect(() => {
    if (!sidebarOpen || !sidebarDay) {
      setDrawerPunchAudits([]);
      return;
    }
    const allDay = visibleShifts
      .filter((s) => s.date === sidebarDay)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    const selectedDayIds = selectedShiftIds.filter((id) => allDay.some((s) => s.id === id));
    const dayList =
      selectedDayIds.length > 0 ? allDay.filter((s) => selectedDayIds.includes(s.id)) : allDay;
    if (dayList.length !== 1) {
      setDrawerPunchAudits([]);
      return;
    }
    const shift = dayList[0];
    const pair = getPunchPairForShift(shift, punchRecords);
    const ids: string[] = [];
    if (pair.punchIn?.id) ids.push(pair.punchIn.id);
    if (pair.punchOut?.id) ids.push(pair.punchOut.id);
    if (ids.length === 0) {
      setDrawerPunchAudits([]);
      return;
    }
    let cancelled = false;
    database.punchAuditLog.getByPunchIds(ids).then((entries) => {
      if (!cancelled) setDrawerPunchAudits(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [sidebarOpen, sidebarDay, selectedShiftIds, visibleShifts, punchRecords]);

  /** Chiudi menu a comparsa sidebar al click fuori */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sidebarMenuRef.current && !sidebarMenuRef.current.contains(e.target as Node)) {
        setSidebarMenuShiftId(null);
        setSidebarStatusSubmenuShiftId(null);
      }
      if (wstToolbarDrawerOpen) {
        const tgt = e.target as Node;
        if (
          !wstToolbarModalRef.current?.contains(tgt) &&
          !wstToolbarDrawerRef.current?.contains(tgt) &&
          !wstDeptDrawerRef.current?.contains(tgt) &&
          !isDatePickerPortalClick(e.target)
        ) {
          setWstToolbarDrawerOpen(false);
          setWstToolbarDrawerSection(null);
        }
      }
    };
    if (sidebarMenuShiftId || sidebarStatusSubmenuShiftId || wstToolbarDrawerOpen) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [sidebarMenuShiftId, sidebarStatusSubmenuShiftId, wstToolbarDrawerOpen]);


  const activeUsers = useMemo(() => {
    let list = users.filter((u) => isUserVisibleOnTeamSchedule(u, shifts));
    
    // Filtro reparto (se attivo)
    if (localFilterDepartment) {
      list = list.filter((u) => {
        const d = (u.department || '').toLowerCase();
        const filterLc = localFilterDepartment.toLowerCase();
        
        // Se il filtro è "sala_bar", includi utenti con reparto "sala_bar", "sala" o "bar"
        if (filterLc === 'sala_bar') {
          return d === 'sala_bar' || d === 'sala' || d === 'bar';
        }
        
        return d === filterLc;
      });
    }

    if (filterUserId || localFilterUserId) {
      const fid = localFilterUserId || filterUserId;
      list = list.filter((u) => u.id === fid);
    }
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

      if (userOrderOverride) {
        const ai = userOrderOverride.indexOf(a.id);
        const bi = userOrderOverride.indexOf(b.id);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      }
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    return list;
  }, [users, filterUserId, localFilterUserId, userOrderOverride, localFilterDepartment, shifts]);

  // Holiday lookup: Set of "userId_yyyy-MM-dd" for approved holiday days
  const approvedHolidayDates = useMemo(() => {
    const s = new Set<string>();
    holidays
      .filter((h) => h.status === 'approved')
      .forEach((h) => {
        try {
          eachDayOfInterval({ start: parseISO(h.start_date), end: parseISO(h.end_date) }).forEach(
            (d) => s.add(`${h.user_id}_${format(d, 'yyyy-MM-dd')}`)
          );
        } catch { /* invalid date range — skip */ }
      });
    return s;
  }, [holidays]);

  /** Turni "aperti" (non assegnati) o in attesa di approvazione richiesta. */
  const openVisibleShifts = useMemo(() => visibleShifts.filter(isOpenShiftRecord), [visibleShifts]);
  /** Turni regolari (esclude turni aperti e in richiesta). */
  const regularVisibleShifts = useMemo(() => visibleShifts.filter((s) => !isOpenShiftRecord(s)), [visibleShifts]);

  useEffect(() => {
    try {
      if (localStorage.getItem(OPEN_SHIFTS_BAR_COLLAPSED_KEY) === '1') setOpenShiftsBarCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleOpenShiftsBarCollapsed = useCallback(() => {
    setOpenShiftsBarCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(OPEN_SHIFTS_BAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const shiftToPos = useMemo(() => {
    const m = new Map<string, { userIdx: number; dayIdx: number; slotIdx: number }>();
    activeUsers.forEach((u, ui) => {
      allWeekDays.forEach((day, di) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayShifts = regularVisibleShifts.filter((s) => s.user_id === u.id && s.date === dayStr);
        const dayShift = dayShifts.find((s) => parseInt(s.start_time.split(':')[0], 10) < 16);
        const eveningShift = dayShifts.find((s) => parseInt(s.start_time.split(':')[0], 10) >= 16);
        if (dayShift) m.set(dayShift.id, { userIdx: ui, dayIdx: di, slotIdx: 0 });
        if (eveningShift) m.set(eveningShift.id, { userIdx: ui, dayIdx: di, slotIdx: 1 });
      });
    });
    return m;
  }, [activeUsers, allWeekDays, regularVisibleShifts]);

  useEffect(() => {
    setSelectedShiftIds([]);
  }, []);

  const validShiftIds = useMemo(() => new Set(shiftToPos.keys()), [shiftToPos]);
  useEffect(() => {
    setSelectedShiftIds((prev) => {
      const next = prev.filter((id) => validShiftIds.has(id));
      if (next.length === prev.length && next.every((id, i) => prev[i] === id)) return prev;
      return next;
    });
  }, [validShiftIds]);

  const getShiftsInRect = useCallback((r1: number, c1: number, s1: number, r2: number, c2: number, s2: number) => {
    const ids: string[] = [];
    const ruMin = Math.min(r1, r2);
    const ruMax = Math.max(r1, r2);
    const rdMin = Math.min(c1, c2);
    const rdMax = Math.max(c1, c2);
    const rsMin = Math.min(s1, s2);
    const rsMax = Math.max(s1, s2);
    shiftToPos.forEach((pos, id) => {
      if (pos.userIdx >= ruMin && pos.userIdx <= ruMax && pos.dayIdx >= rdMin && pos.dayIdx <= rdMax && pos.slotIdx >= rsMin && pos.slotIdx <= rsMax) {
        ids.push(id);
      }
    });
    return ids;
  }, [shiftToPos]);

  const handleCellMouseDown = (e: React.MouseEvent, userIdx: number, dayIdx: number, slotIdx: number) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    const dragHost = t.closest('[draggable]') as HTMLElement | null;
    if (dragHost?.draggable) return;
    dragStartRef.current = { userIdx, dayIdx, slotIdx };
  };

  const handleCellMouseEnter = (userIdx: number, dayIdx: number, slotIdx: number) => {
    if (!dragStartRef.current) return;
    setDragSelect({ userIdx, dayIdx, slotIdx });
  };

  const handleCellMouseUp = useCallback(() => {
    if (dragStartRef.current && dragSelect) {
      const ids = getShiftsInRect(
        dragStartRef.current.userIdx, dragStartRef.current.dayIdx, dragStartRef.current.slotIdx,
        dragSelect.userIdx, dragSelect.dayIdx, dragSelect.slotIdx
      );
      if (ids.length > 0) setSelectedShiftIds(ids);
    }
    dragStartRef.current = null;
    setDragSelect(null);
  }, [dragSelect, getShiftsInRect]);

  useEffect(() => {
    window.addEventListener('mouseup', handleCellMouseUp);
    return () => window.removeEventListener('mouseup', handleCellMouseUp);
  }, [handleCellMouseUp]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedShiftIds([]);
        setLocalFilterUserId(null);
      }
      const tag = (e.target as HTMLElement).tagName;
      const isInputFocused = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
      if (!isInputFocused) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (viewMode === 'month') setPeriodPanOffsetWeeks((p) => p - displayPeriodConfig.numWeeks);
          else setWeekIndex((prev) => Math.max(0, prev - 1));
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (viewMode === 'month') setPeriodPanOffsetWeeks((p) => p + displayPeriodConfig.numWeeks);
          else setWeekIndex((prev) => Math.min(maxWeekIndex, prev + 1));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, maxWeekIndex, displayPeriodConfig.numWeeks]);

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      const tgt = e.target as Node;
      if (shiftDetailModalPanelRef.current?.contains(tgt)) return;
      if (wstToolbarModalRef.current?.contains(tgt)) return;
      if (tableContainerRef.current && !tableContainerRef.current.contains(tgt)) {
        setSelectedShiftIds([]);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  const needsCambioWarning = (shift: Shift) => {
    const endParts = (shift.end_time ?? '').split(':');
    const endHour = parseInt(endParts[0] ?? '0', 10);
    const endMin = parseInt(endParts[1] ?? '0', 10);
    if (endHour !== 16 || endMin !== 0) return false;
    const dayShifts = visibleShifts.filter((s) => s.date === shift.date && s.id !== shift.id);
    const hasCambio = dayShifts.some((s) => {
      const startHour = parseInt(s.start_time.split(':')[0], 10);
      return startHour <= 16;
    });
    return !hasCambio;
  };

  /** Restituisce le violazioni per uno shift (usa regole da context, sync su tutti i profili). */
  const getViolations = useCallback((shift: Shift) => {
    return getShiftViolations(shift, shifts, weekStr, format(addDays(weekStart, 7), 'yyyy-MM-dd'), effectiveWorkRules, {
      users,
      breakRules,
      autoBreaksFeatureEnabled: breakComputeOpts.autoBreaksFeatureEnabled,
    });
  }, [shifts, weekStr, weekStart, effectiveWorkRules, users, breakRules, breakComputeOpts]);

  /** Converte "HH:mm" in minuti dal mezzanotte. */
  const toMinutes = (t: string) => {
    const parts = (t || '').slice(0, 5).split(':');
    return (parseInt(parts[0] ?? '0', 10) || 0) * 60 + (parseInt(parts[1] ?? '0', 10) || 0);
  };

  /** Restituisce true se due turni dello stesso dipendente si sovrappongono in tempo. */
  const shiftsOverlap = useCallback((s1: Shift, s2: Shift): boolean => {
    if (isShiftAbsentRecord(s1) || isShiftAbsentRecord(s2)) return false;
    const s1s = toMinutes(s1.start_time);
    const s1e = s1.end_time && s1.end_time !== s1.start_time ? toMinutes(s1.end_time) : s1s + 360;
    const s2s = toMinutes(s2.start_time);
    const s2e = s2.end_time && s2.end_time !== s2.start_time ? toMinutes(s2.end_time) : s2s + 360;
    const e1 = s1e <= s1s ? s1e + 1440 : s1e;
    const e2 = s2e <= s2s ? s2e + 1440 : s2e;
    return s1s < e2 && s2s < e1;
  }, []);

  // Colori cella (chiarezza): bozza = grigio tratteggiato | pubblicato tabellone = smeraldo | non timbrato / attesa = ambra | congelato = accent pieno | assenza = rosa
  type ShiftColorVariant = 'planned' | 'inprogress' | 'approved' | 'punchMissing' | 'absent';

  const getShiftColorVariant = (shift: Shift): ShiftColorVariant => {
    if (isShiftAbsentRecord(shift)) return 'absent';
    if (shift.approval_status === 'approved' && shift.approved_at) return 'approved';
    if (shiftPastPlannedEndWithoutClockIn(shift, punchRecords)) return 'punchMissing';
    if (shift.approval_status === 'draft') return 'planned'; // Draft – tratteggiato grigio
    if (shift.approval_status === 'approved') return 'inprogress'; // pubblicato / in approvazione (smeraldo)
    if (shift.approval_status === 'confirmed') return 'inprogress';
    const actualTimes = getActualShiftTime(shift, punchRecords);
    const endNorm = (shift.end_time || '').trim().slice(0, 5);
    const hasValidEnd = !!endNorm && endNorm !== (shift.start_time || '').slice(0, 5);
    if (actualTimes.isCompleted && !hasValidEnd) return 'inprogress';
    return 'planned';
  };

  /**
   * Chrome violazioni: flag globale + modulo profilo + almeno un layer **truthy** (solo `true` conta dopo merge default).
   * Evita `!== false` che lasciava il chrome acceso con valori come `0` o `null` mentre gli switch risultano spenti.
   */
  const violationChromeEnabled =
    (featureFlags?.violation_rules !== false) &&
    !!currentUser &&
    isAdminModuleEnabled(currentUser, 'violation_rules') &&
    (!!effectiveWorkRules.criticEnabled ||
      !!effectiveWorkRules.attentionEnabled ||
      !!effectiveWorkRules.overlapEnabled);

  const VARIANT_CLASSES: Record<ShiftColorVariant, { bg: string; text: string; selRing: string; border?: string; borderBottom?: string }> = {
    planned: {
      bg: 'bg-slate-50 hover:bg-slate-100 dark:bg-neutral-950/85 dark:hover:bg-neutral-900/90',
      text: 'text-slate-900 dark:text-white',
      selRing: 'ring-slate-300/50',
      border: 'border-2 border-dashed border-slate-400 dark:border-white/75 rounded-xl shadow-sm',
    },
    inprogress: {
      bg: 'bg-emerald-50/95 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/55',
      text: 'text-emerald-900 dark:text-emerald-50',
      selRing: 'ring-emerald-400/55',
      border: 'border-2 border-emerald-500/80 dark:border-emerald-500/50 rounded-xl shadow-sm',
    },
    approved: {
      bg: 'bg-accent hover:bg-accent-hover',
      text: 'text-white',
      selRing: 'ring-white/80',
      border: 'border-2 border-accent rounded-xl',
    },
    punchMissing: {
      bg: 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/45 dark:hover:bg-amber-950/60',
      text: 'text-amber-950 dark:text-amber-100',
      selRing: 'ring-amber-400/60',
      border: 'border-2 border-amber-400/90 dark:border-amber-500/70 rounded-xl shadow-sm',
    },
    absent: {
      bg: 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/35 dark:hover:bg-rose-950/50',
      text: 'text-rose-900 dark:text-rose-100',
      selRing: 'ring-rose-400/50',
      border: 'border-2 border-dashed border-rose-400/85 dark:border-rose-500/65 rounded-xl shadow-sm',
    },
  };

  /** Pill indicatori (pubblicato, timbratura, ritardo): altezza fissa così sinistra e dopo orario coincidono. */
  const shiftCardStatusPillClass = 'h-[30px] w-2 shrink-0 self-center rounded-full shadow-sm';

  const getCellStyle = (shift: Shift, isSelected: boolean, _hasAnySelected: boolean, colorVariant: ShiftColorVariant = 'planned') => {
    const v = VARIANT_CLASSES[colorVariant];
    let base = `relative group flex flex-col items-start justify-start ${v.bg} ${v.text} shadow-sm transition-shadow `;
    if (v.border) base += `${v.border} `;
    if (v.borderBottom) base += `${v.borderBottom} `;
    const selectedStyle = isSelected ? `ring-2 ${v.selRing} shadow-md ` : '';
    /** Box-shadow invece di `ring-*`: su desktop la stessa cella ha `hover:ring-2` (canEditInApp) che in Tailwind mascherava anelli rosso/ambra. */
    let violationGlow = '';
    if (violationChromeEnabled) {
      const viol = getViolations(shift);
      if (viol.some(x => x.severity === 'error')) {
        violationGlow =
          'shadow-[0_0_0_2px_rgb(239,68,68)] dark:shadow-[0_0_0_2px_rgb(248,113,113)] ';
      } else if (viol.some(x => x.severity === 'warn')) {
        violationGlow =
          'shadow-[0_0_0_2px_rgb(245,158,11)] dark:shadow-[0_0_0_2px_rgb(251,191,36)] ';
      }
    }
    return `${base}${selectedStyle}${violationGlow}rounded-xl px-1.5 py-1 my-0.5 mx-0.5 cursor-default min-h-[44px] sm:min-h-[44px]`;
  };

  /** Ore in settimana (bozza + confermato + approvato), esclusi turni aperti; stessi orari risolti e pause del resto dell’app. */
  const weeklyMinutesScheduledByUser = useMemo(() => {
    const weekStr = format(weekStart, 'yyyy-MM-dd');
    const weekEnd = format(addDays(weekStart, 7), 'yyyy-MM-dd');
    const weekShifts = shifts.filter(
      (s) =>
        s &&
        s.date >= weekStr &&
        s.date < weekEnd &&
        !isOpenShiftRecord(s) &&
        (s.approval_status === 'draft' || s.approval_status === 'confirmed' || s.approval_status === 'approved')
    );
    const byUser: Record<string, number> = {};
    for (const shift of weekShifts) {
      try {
        const { start, end } = getResolvedStartEndForHours(shift, punchRecords);
        if (!start || !end || start === end) continue;
        const shiftUser = users.find((u) => u.id === shift.user_id);
        const mins = getNetShiftMinutes(shift, start, end, shiftUser ?? undefined, breakRules, breakComputeOpts);
        byUser[shift.user_id] = (byUser[shift.user_id] ?? 0) + mins;
      } catch {
        /* skip */
      }
    }
    return byUser;
  }, [shifts, weekStart, users, breakRules, breakComputeOpts, punchRecords]);

  /** Ore totali per giorno (somma di tutti gli utenti) — per la riga footer */
  const dailyMinutesByDate = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const day of allWeekDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayShifts = visibleShifts.filter(
        (s) =>
          s.date === dateStr &&
          !isOpenShiftRecord(s) &&
          (s.approval_status === 'draft' || s.approval_status === 'confirmed' || s.approval_status === 'approved')
      );
      let total = 0;
      for (const shift of dayShifts) {
        try {
          const { start, end } = getResolvedStartEndForHours(shift, punchRecords);
          if (!start || !end || start === end) continue;
          const shiftUser = users.find((u) => u.id === shift.user_id);
          total += getNetShiftMinutes(shift, start, end, shiftUser ?? undefined, breakRules, breakComputeOpts);
        } catch { /* skip */ }
      }
      byDate[dateStr] = total;
    }
    return byDate;
  }, [visibleShifts, allWeekDays, users, breakRules, breakComputeOpts, punchRecords]);

  const [draggedShiftId, setDraggedShiftId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [shakeBadgeId, setShakeBadgeId] = useState<string | null>(null);
  // GestioneTurni: inline cell editor (always-on, no mode toggle)
  const [cellEdit, setCellEdit] = useState<{ shiftId: string; value: string } | null>(null);
  /** Popup turno usa `CenteredModalPortal` (lock lì). Resto: overlay fissi senza portal. */
  const wstOverlayLocksScroll = useMemo(
    () =>
      showHistoryModal ||
      showHiddenPeriodsModal ||
      showEditViewModal ||
      !!creatingShift ||
      !!creatingOpenShift ||
      wstToolbarDrawerOpen,
    [
      showHistoryModal,
      showHiddenPeriodsModal,
      showEditViewModal,
      creatingShift,
      creatingOpenShift,
      wstToolbarDrawerOpen,
    ]
  );
  useBodyScrollLock(wstOverlayLocksScroll);

  // Sync indicator: when pendingSaves drops to 0, briefly flash "Salvato"
  useEffect(() => {
    if (pendingSaves === 0 && justSynced === false) return;
    if (pendingSaves > 0) { setJustSynced(false); return; }
    setJustSynced(true);
    const tid = setTimeout(() => setJustSynced(false), 2000);
    return () => clearTimeout(tid);
  }, [pendingSaves]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Incrementa/decrementa contatore salvataggi in volo per l'indicatore cloud. */
  const handleSidebarSave = useCallback(async () => {
    if (!sidebarDay) return;
    const dayShiftsList = visibleShifts
      .filter((s) => s.date === sidebarDay)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    setSidebarSaving(true);
    try {
      await trackSave(async () => {
        for (const shift of dayShiftsList) {
          if (!isShiftDraftLike(shift)) continue;
          const edits = sidebarEdits[shift.id] ?? { start: (shift.start_time || '').trim().slice(0, 5), end: (shift.end_time || '').trim().slice(0, 5) };
          const startVal = toHHmm(edits.start) || shift.start_time || '';
          const endVal = edits.end ? toHHmm(edits.end) : (startVal === '10:00' ? '16:00' : '');
          if (!startVal) continue;
          const others = shifts.filter((s) => s.user_id === shift.user_id && s.date === shift.date && s.id !== shift.id);
          if (hasShiftConflictSameDay(others, { start_time: startVal, end_time: endVal }, shift.id)) {
            showError(t.shift_conflict_same_day);
            return;
          }
          const updates: { start_time: string; end_time: string } = { start_time: startVal, end_time: endVal };
          await updateShift(shift.id, updates);
        }
        closeShiftDetailPanel();
        showSuccess?.(t.shift_saved);
      });
    } catch {
      showError(t.save_error_retry);
    } finally {
      setSidebarSaving(false);
    }
  }, [sidebarDay, sidebarEdits, visibleShifts, shifts, updateShift, showError, showSuccess, trackSave, t, closeShiftDetailPanel]);

  /** Vista stretta (no griglia desktop): pubblica in un colpo tutte le bozze del giorno (orari da drawer + confirmed). */
  const handleSidebarPublishDay = useCallback(async () => {
    if (!sidebarDay || !canApproveShifts) return;
    const dayShiftsList = visibleShifts
      .filter((s) => s.date === sidebarDay)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
    setSidebarSaving(true);
    try {
      let published = 0;
      await trackSave(async () => {
        for (const shift of dayShiftsList) {
          if (!isShiftDraftLike(shift)) continue;
          const edits = sidebarEdits[shift.id] ?? {
            start: (shift.start_time || '').trim().slice(0, 5),
            end: (shift.end_time || '').trim().slice(0, 5),
          };
          const startVal = toHHmm(edits.start) || shift.start_time || '';
          const endVal = edits.end ? toHHmm(edits.end) : startVal === '10:00' ? '16:00' : '';
          if (!startVal) continue;
          const others = shifts.filter((s) => s.user_id === shift.user_id && s.date === shift.date && s.id !== shift.id);
          if (hasShiftConflictSameDay(others, { start_time: startVal, end_time: endVal }, shift.id)) {
            showError(t.shift_conflict_same_day);
            return;
          }
          await updateShift(shift.id, {
            start_time: startVal,
            end_time: endVal,
            approval_status: 'confirmed',
          });
          published += 1;
        }
        if (published === 0) return;
        closeShiftDetailPanel();
        showSuccess?.(formatTrans(t.wst_publish_day_success, { n: String(published) }));
      });
    } catch {
      showError(t.save_error_retry);
    } finally {
      setSidebarSaving(false);
    }
  }, [
    sidebarDay,
    canApproveShifts,
    sidebarEdits,
    visibleShifts,
    shifts,
    updateShift,
    showError,
    showSuccess,
    trackSave,
    t,
    closeShiftDetailPanel,
    formatTrans,
  ]);

  /** Salva solo orari e timbrature dal drawer (nessun PIN, nessun congelamento). */
  const handleDrawerSave = useCallback(
    async (shiftId: string) => {
      const shift = shifts.find((s) => s.id === shiftId);
      if (!shift) return;
      if (isShiftFrozenRecord(shift)) return;
      if (isShiftAbsentRecord(shift)) return;
      if (!isShiftDraftLike(shift)) return;

      setDrawerSaving(true);
      try {
        const edits = sidebarEdits[shiftId];
        if (edits) {
          const startVal = toHHmm(edits.start) || shift.start_time || '';
          const endVal = toHHmm(edits.end) || shift.end_time || '';
          if (startVal) {
            const others = shifts.filter((s) => s.user_id === shift.user_id && s.date === shift.date && s.id !== shiftId);
            if (hasShiftConflictSameDay(others, { start_time: startVal, end_time: endVal }, shiftId)) {
              showError?.(t.shift_conflict_same_day);
              return;
            }
          }
        }

        const ok = await persistDrawerSingleShift(shiftId);
        if (!ok) return;

        showSuccess?.(t.shift_saved);
        setSidebarEdits((prev) => {
          const next = { ...prev };
          delete next[shiftId];
          return next;
        });
        closeShiftDetailPanel();
      } catch {
        showError?.(t.save_error_retry);
      } finally {
        setDrawerSaving(false);
      }
    },
    [shifts, sidebarEdits, persistDrawerSingleShift, showError, showSuccess, t, closeShiftDetailPanel]
  );

  const handleDropShift = useCallback(async (shiftId: string, targetUserId: string, targetDate: string) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift || (shift.user_id === targetUserId && shift.date === targetDate)) return;
    if (!isShiftDraftLike(shift)) return;
    // Verifica limite massimo turni al giorno nella destinazione
    const existingOnTarget = shifts.filter(s => s.id !== shiftId && s.user_id === targetUserId && s.date === targetDate);
    if (existingOnTarget.length >= 2) {
      showError(t.max_two_shifts_same_day);
      return;
    }
    // Blocca il drop se il dipendente ha già un turno sovrapposto nella cella di destinazione.
    const conflict = shifts.find(s =>
      s.id !== shiftId &&
      s.user_id === targetUserId &&
      s.date === targetDate &&
      s.start_time && shift.start_time &&
      shiftsOverlap(shift, s)
    );
    if (conflict) {
      setShakeBadgeId(conflict.id);
      setTimeout(() => setShakeBadgeId(null), 600);
      return; // block the move
    }
    await trackSave(async () => {
      try {
        await updateShift(shiftId, { user_id: targetUserId, date: targetDate });
        showSuccess?.(t.shift_moved);
      } catch {
        showError(t.shift_move_error);
      }
    });
  }, [shifts, updateShift, showError, showSuccess, trackSave, shiftsOverlap, t]);

  /** Salva l'editing inline della cella (solo turni in bozza). */
  const handleCellEditSave = useCallback(async (shiftId: string, rawValue: string) => {
    setCellEdit(null);
    const parsed = parseCellTimeInput(rawValue);
    if (!parsed || !parsed.start) return;
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    if (isShiftFrozenRecord(shift) || isShiftAbsentRecord(shift)) return;
    if (!isShiftDraftLike(shift)) return;
    const existing = shifts.filter((s) => s.user_id === shift.user_id && s.date === shift.date);
    if (hasShiftConflictSameDay(existing, { start_time: parsed.start!, end_time: parsed.end }, shiftId)) {
      showError(t.shift_conflict_same_day);
      return;
    }
    const shiftUpdates: { start_time: string; end_time: string } = { start_time: parsed.start!, end_time: parsed.end };
    await trackSave(async () => {
      try {
        await updateShift(shiftId, shiftUpdates);
        showSuccess?.(t.shift_time_updated);
      } catch {
        showError(t.save_error_retry);
      }
    });
  }, [shifts, updateShift, showError, showSuccess, trackSave, t]);

  if (!currentUser) return null;

  return (
    <div ref={tableContainerRef} className="pb-content pt-6 w-full max-w-full font-sans">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        className="min-h-full"
      >
      {isStaff && !wStaffTable ? (
        <p className="text-sm text-slate-500 dark:text-neutral-300 text-center py-16 px-4">
          {t.no_shifts_scheduled}
        </p>
      ) : (
      <>
      {localFilterUserId && (
        <div className="mb-3">
          <button
            onClick={() => setLocalFilterUserId(null)}
            className="ui-toolbar-chip border-amber-400 bg-amber-50 font-bold text-amber-700 hover:bg-amber-100"
          >
            <X className="w-3 h-3" />
            {t.filter_active_click_to_clear}
          </button>
        </div>
      )}
      {wTurniToolbar && (
      <>
      {/* Toolbar: navigazione + pubblica + ☰ */}
      <div className="mb-2 flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 sm:mb-0 sm:h-[22px] sm:max-h-[22px] sm:flex-nowrap sm:gap-2 sm:overflow-x-auto-safe">
        {/* ── Sinistra: navigazione periodo / vista ── */}
        <div className="flex min-w-0 max-w-full shrink-0 flex-wrap items-center gap-2 sm:h-[22px] sm:max-h-[22px] sm:flex-nowrap sm:gap-2 sm:overflow-x-auto-safe">
          <button
            type="button"
            onClick={() => {
              setPeriodPanOffsetWeeks(0);
              setWeekIndex(weekIndexForDateInPeriod(periodConfig));
            }}
            className="ui-toolbar-ghost-accent shrink-0"
          >
            {t.today}
          </button>
          <div className="ui-toolbar-group shrink-0">
            {(['week', 'month'] as const).map((vm) => (
              <button
                key={vm}
                type="button"
                onClick={() => setViewMode(vm)}
                className={`ui-toolbar-tab ${viewMode === vm ? 'bg-accent text-white' : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}
              >
                {vm === 'week' ? t.view_week : t.view_month}
              </button>
            ))}
          </div>
          {viewMode === 'month' && (
            <>
              <span
                className="hidden sm:inline-flex h-[22px] max-w-[min(100%,16rem)] items-center truncate rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-neutral-900/80 px-2 text-[11px] font-semibold tabular-nums text-slate-600 dark:text-neutral-300 shrink-0"
                title={`${format(monthViewPeriodStart, 'd MMMM yyyy', { locale: getDateLocale(effectiveLanguage) ?? it })} → ${format(monthViewPeriodEnd, 'd MMMM yyyy', { locale: getDateLocale(effectiveLanguage) ?? it })}`}
              >
                {format(monthViewPeriodStart, 'd MMM', { locale: getDateLocale(effectiveLanguage) ?? it })} –{' '}
                {format(monthViewPeriodEnd, 'd MMM yyyy', { locale: getDateLocale(effectiveLanguage) ?? it })}
              </span>
              {periodPayrollChipDatesWst && (
                <span
                  className="hidden min-[480px]:inline-flex h-[22px] max-w-[min(100%,20rem)] shrink-0 items-center truncate rounded-lg border border-emerald-200/90 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/50 px-2 text-[10px] font-bold text-emerald-900 dark:text-emerald-200"
                  title={periodPayrollChipDatesWst}
                >
                  {formatTrans((t as Record<string, string>).wst_month_payroll_chip ?? 'Pagamento: {date}', {
                    date: periodPayrollChipDatesWst,
                  })}
                </span>
              )}
            </>
          )}
          {viewMode !== 'month' && (
            <span className="inline-flex h-[22px] shrink-0 items-center text-[13px] font-semibold tabular-nums leading-none text-slate-500 dark:text-neutral-300">
              {weekIndex + 1}/{periodConfig.numWeeks}
            </span>
          )}
          <div className="h-3.5 w-px bg-slate-200 dark:bg-white/10 mx-0.5 shrink-0" />
          
          <div className="relative" ref={wstDeptDrawerRef}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setWstToolbarDrawerOpen((open) => {
                  if (open && wstToolbarDrawerSection === 'department') {
                    setWstToolbarDrawerSection(null);
                    return false;
                  }
                  setWstToolbarDrawerSection('department');
                  return true;
                });
              }}
              className={`ui-toolbar-chip !h-[22px] shrink-0 text-slate-600 dark:text-neutral-300 hover:bg-slate-50/90 dark:hover:bg-white/[0.06] ${
                wstToolbarDrawerOpen && wstToolbarDrawerSection === 'department' ? 'border-accent/35 bg-accent/8 ring-1 ring-accent/15' : ''
              } ${localFilterDepartment !== '' ? 'border-accent/25 bg-accent/5 dark:bg-accent/10' : ''}`}
              aria-expanded={wstToolbarDrawerOpen && wstToolbarDrawerSection === 'department'}
              aria-haspopup="true"
              title={t.wst_department_button}
            >
              <Filter className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
              <span className="text-[11px] font-bold">
                {localFilterDepartment === '' ? t.wst_department_button : translateDepartmentValue(localFilterDepartment, effectiveLanguage)}
              </span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${wstToolbarDrawerOpen && wstToolbarDrawerSection === 'department' ? 'rotate-180' : ''}`} />
              {localFilterDepartment !== '' && (
                <span className="h-1.2 w-1.2 shrink-0 rounded-full bg-accent" aria-hidden />
              )}
            </button>

            <AnimatePresence>
              {wstToolbarDrawerOpen && wstToolbarDrawerSection === 'department' && (
                <>
                  {/* Desktop Dropdown */}
                  <motion.div 
                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    className="hidden lg:block absolute right-0 lg:left-auto top-full z-[9999] mt-1 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-neutral-900"
                    style={{ isolation: 'isolate' }}
                  >
                    <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 border-b border-slate-100 dark:border-white/10 mb-1">
                      {t.department_filter_label}
                    </div>
                    {[
                      { value: '', label: t.department_filter_all },
                      ...getDepartments().map((d) => ({
                        value: d.value,
                        label: translateDepartmentValue(d.value, effectiveLanguage),
                      })),
                    ].map(({ value: dept, label }) => (
                      <button
                        key={dept || 'all'}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLocalFilterDepartment(dept);
                          setWstToolbarDrawerOpen(false);
                          setWstToolbarDrawerSection(null);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-all ${
                          localFilterDepartment === dept
                            ? 'bg-accent text-white shadow-md'
                            : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                          {dept ? (
                            <span
                              className={`h-2.5 w-2.5 rounded-full shadow-sm ${localFilterDepartment === dept ? 'bg-white' : ''}`}
                              style={localFilterDepartment !== dept ? { backgroundColor: getDeptColor(dept) } : {}}
                            />
                          ) : (
                            <Check className={`h-3 w-3 ${localFilterDepartment === dept ? 'text-white' : 'text-accent'}`} strokeWidth={3} />
                          )}
                        </div>
                        <span className="flex-1 truncate">{label}</span>
                        {localFilterDepartment === dept && <Check className="h-3 w-3 text-white/90" strokeWidth={3} />}
                      </button>
                    ))}
                  </motion.div>

                  {/* Mobile/Tablet Popup Modal */}
                  <div className="lg:hidden">
                    <CenteredModalPortal
                      open={wstToolbarDrawerOpen && wstToolbarDrawerSection === 'department'}
                      onClose={() => {
                        setWstToolbarDrawerOpen(false);
                        setWstToolbarDrawerSection(null);
                      }}
                      maxWidthClass="max-w-[280px]"
                      panelClassName="p-1"
                    >
                      <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 border-b border-slate-100 dark:border-white/10 mb-1">
                        {t.department_filter_label}
                      </div>
                      {[
                        { value: '', label: t.department_filter_all },
                        ...getDepartments().map((d) => ({
                          value: d.value,
                          label: translateDepartmentValue(d.value, effectiveLanguage),
                        })),
                      ].map(({ value: dept, label }) => (
                        <button
                          key={dept || 'all'}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLocalFilterDepartment(dept);
                            setWstToolbarDrawerOpen(false);
                            setWstToolbarDrawerSection(null);
                          }}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[11px] font-bold transition-all ${
                            localFilterDepartment === dept
                              ? 'bg-accent text-white shadow-md'
                              : 'text-slate-600 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
                            {dept ? (
                              <span
                                className={`h-2.5 w-2.5 rounded-full shadow-sm ${localFilterDepartment === dept ? 'bg-white' : ''}`}
                                style={localFilterDepartment !== dept ? { backgroundColor: getDeptColor(dept) } : {}}
                              />
                            ) : (
                              <Check className={`h-3 w-3 ${localFilterDepartment === dept ? 'text-white' : 'text-accent'}`} strokeWidth={3} />
                            )}
                          </div>
                          <span className="flex-1 truncate">{label}</span>
                          {localFilterDepartment === dept && <Check className="h-3 w-3 text-white/90" strokeWidth={3} />}
                        </button>
                      ))}
                    </CenteredModalPortal>
                  </div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Destra: pubblica settimana (se bozze) + menu hamburger ── */}
        <div className="ui-toolbar-row-tight ml-auto shrink-0">
          {!isStaff && (
          <>
          {canManageDrafts && isWideShiftViewport && draftCountInWeek > 0 && (
            <button
              type="button"
              onClick={() => requestConfirmAndPublishWeek(weekStart)}
              className="inline-flex h-[22px] max-h-[22px] shrink-0 items-center gap-1 rounded-lg bg-accent px-2 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-accent-hover"
              title={t.publish_week}
            >
              <Cloud className="h-3 w-3 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
              <span className="hidden min-[420px]:inline">{t.publish_week}</span>
              <span className="tabular-nums rounded-md bg-white/20 px-1 py-px text-[10px] font-bold leading-none">
                {draftCountInWeek}
              </span>
            </button>
          )}
          <div className="ui-toolbar-dropdown-root shrink-0" ref={wstToolbarDrawerRef}>
            <button
              type="button"
              onClick={() => {
                setWstToolbarDrawerOpen((open) => {
                  if (open) {
                    setWstToolbarDrawerSection(null);
                    return false;
                  }
                  return true;
                });
              }}
              className={`ui-toolbar-chip shrink-0 text-slate-600 dark:text-neutral-300 hover:bg-slate-50/90 dark:hover:bg-white/[0.06] ${
                wstToolbarDrawerOpen && wstToolbarDrawerSection !== 'department' ? 'border-accent/35 bg-accent/8 ring-1 ring-accent/15' : ''
              } ${localFilterStatus !== 'all' ? 'border-accent/25 bg-accent/5 dark:bg-accent/10' : ''}`}
              aria-expanded={wstToolbarDrawerOpen}
              aria-haspopup="true"
              title={(t as Record<string, string>).wst_toolbar_hamburger_title}
              aria-label={(t as Record<string, string>).wst_toolbar_hamburger_aria}
            >
              <Menu className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              {localFilterStatus !== 'all' && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              )}
            </button>
          </div>
            {wstToolbarDrawerOpen && wstToolbarDrawerSection !== 'department' && (
              <CenteredModalPortal
                open
                onClose={closeWstToolbarDrawer}
                panelRef={wstToolbarModalRef}
                backdropAriaLabel={(t as Record<string, string>).close ?? 'Chiudi'}
                ariaLabel={(t as Record<string, string>).wst_toolbar_hamburger_aria ?? 'Menu'}
                maxWidthClass="max-w-md"
                maxHeightClass="max-h-[min(90dvh,720px)]"
                panelClassName="py-1"
              >
                <button
                  type="button"
                  onClick={() =>
                    setWstToolbarDrawerSection((sec) => (sec === 'filters' ? null : 'filters'))
                  }
                  className="flex w-full items-center justify-between gap-2 border-b border-slate-100 dark:border-white/10 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/80"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Filter className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-neutral-300" strokeWidth={2.25} />
                    <span className="text-sm font-semibold text-slate-800 dark:text-neutral-100">{t.wst_filters}</span>
                    {localFilterStatus !== 'all' && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    )}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 dark:text-neutral-400 transition-transform ${
                      wstToolbarDrawerSection === 'filters' ? '-rotate-180' : ''
                    }`}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                </button>
                {wstToolbarDrawerSection === 'filters' && (
                  <div className="border-b border-slate-100 dark:border-white/10 py-0.5">
                    <div className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400 border-b border-slate-100 dark:border-white/10">
                      {t.wst_shift_status_header}
                    </div>
                    {[
                      { key: 'approved' as const, label: t.ts_status_approved, Icon: Check },
                      { key: 'confirmed' as const, label: t.wst_filter_published, Icon: Clock },
                      { key: 'draft' as const, label: t.status_draft, Icon: FileEdit },
                      { key: 'absent' as const, label: t.status_absent, Icon: UserX },
                    ].map(({ key, label, Icon }) => {
                      const active = localFilterStatus === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setLocalFilterStatus(active ? 'all' : key);
                            closeWstToolbarDrawer();
                          }}
                          className={`w-full px-2 py-1.5 text-left text-[11px] flex items-center gap-2 ${
                            active ? 'bg-accent/10 text-accent font-semibold' : 'text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800'
                          }`}
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-neutral-900">
                            <Icon className={`h-3.5 w-3.5 ${active ? 'text-accent' : 'text-slate-500 dark:text-neutral-400'}`} strokeWidth={2.25} />
                          </span>
                          {label}
                        </button>
                      );
                    })}
                    {localFilterStatus !== 'all' && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocalFilterStatus('all');
                          closeWstToolbarDrawer();
                        }}
                        className="w-full px-2 py-1.5 text-left text-[11px] text-slate-500 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 flex items-center gap-2 border-t border-slate-100 dark:border-white/10"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-neutral-900">
                          <X className="h-3.5 w-3.5 text-slate-500 dark:text-neutral-300" strokeWidth={2.25} />
                        </span>
                        {t.filter_all}
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setWstToolbarDrawerSection((sec) => (sec === 'legend' ? null : 'legend'))
                  }
                  className="flex w-full items-center justify-between gap-2 border-b border-slate-100 dark:border-white/10 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-neutral-800/80"
                  title={t.wst_legend_tooltip}
                >
                  <span className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-neutral-300" strokeWidth={2.25} />
                    <span className="text-sm font-semibold text-slate-800 dark:text-neutral-100">{t.wst_legend}</span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 dark:text-neutral-400 transition-transform ${
                      wstToolbarDrawerSection === 'legend' ? '-rotate-180' : ''
                    }`}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                </button>
                {wstToolbarDrawerSection === 'legend' && (
                  <div className="border-b border-slate-100 dark:border-white/10 py-2">
                    <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                      {t.wst_shift_status_header}
                    </div>
                    {[
                      {
                        bg: 'bg-accent',
                        border: '',
                        textCls: 'text-white',
                        label: t.ts_status_approved,
                        sub: t.wst_status_sub_approved,
                        check: true,
                      },
                      {
                        bg: 'bg-white dark:bg-neutral-900',
                        border: 'border border-slate-200 dark:border-white/15',
                        textCls: 'text-accent',
                        label: t.wst_filter_published,
                        sub: t.wst_status_sub_published,
                        check: false,
                      },
                      {
                        bg: 'bg-white dark:bg-neutral-900',
                        border: 'border-2 border-dashed border-slate-300 dark:border-neutral-500',
                        textCls: 'text-black dark:text-neutral-100',
                        label: t.status_draft,
                        sub: t.wst_status_sub_draft,
                        check: false,
                      },
                      {
                        bg: 'bg-rose-50 dark:bg-rose-950/40',
                        border: 'border-2 border-dashed border-rose-400 dark:border-rose-500/60',
                        textCls: 'text-rose-900 dark:text-rose-100',
                        label: t.status_absent,
                        sub: t.wst_status_sub_absent,
                        check: false,
                      },
                    ].map(({ bg, border, textCls, label, sub, check }) => (
                      <div key={label} className="flex items-center gap-2.5 px-3 py-1.5">
                        <span
                          className={`flex-shrink-0 w-10 h-6 rounded-xl ${bg} ${border} flex flex-col items-center justify-center`}
                        >
                          <span className={`text-[9px] font-bold leading-none ${textCls}`}>10–16</span>
                          {check && <Check className="w-2.5 h-2.5 text-white mt-0.5" strokeWidth={3} />}
                        </span>
                        <span>
                          <p className="text-xs font-semibold text-slate-700 dark:text-neutral-200 leading-none">{label}</p>
                          <p className="text-[10px] text-slate-400 dark:text-neutral-400 mt-0.5 leading-tight">{sub}</p>
                        </span>
                      </div>
                    ))}
                    {violationChromeEnabled && (
                      <div className="mt-1.5 border-t border-slate-100 dark:border-white/10 pt-1.5">
                        <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                          {t.wst_violations_legend}
                        </div>
                        {[
                          {
                            ringCls: 'ring-2 ring-red-500',
                            dot: 'bg-red-500',
                            label: t.wst_violation_critical,
                            sub: t.wst_violation_critical_sub,
                          },
                          {
                            ringCls: 'ring-2 ring-amber-400',
                            dot: 'bg-amber-400',
                            label: t.wst_violation_attention,
                            sub: t.wst_violation_attention_sub,
                          },
                          {
                            ringCls: 'shadow-[0_0_8px_rgba(239,68,68,0.6)]',
                            dot: 'bg-red-300',
                            label: t.wst_violation_overlap,
                            sub: t.wst_violation_overlap_sub,
                          },
                        ].map(({ ringCls, dot, label, sub }) => (
                          <div key={label} className="flex items-center gap-3 px-3 py-2">
                            <span
                              className={`flex h-8 w-[3.25rem] shrink-0 items-center justify-center surface-glass-sm ${ringCls}`}
                            >
                              <span className={`h-2.5 w-2.5 rounded-full ${dot} shadow-sm`} />
                            </span>
                            <span className="min-w-0">
                              <p className="text-xs font-semibold text-slate-700 leading-snug">{label}</p>
                              <p className="text-[10px] text-slate-400 dark:text-neutral-400 mt-0.5 leading-snug">{sub}</p>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!isStaff && canShiftOps && (
                  <>
                    <div className="border-b border-slate-100 px-3 py-2.5 dark:border-white/10">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">
                        {(t as { stats_preset_period?: string }).stats_preset_period ?? 'Periodo Presenze'}
                      </p>
                      <DatePickerField
                        value={periodDraftStart}
                        onChange={(v) => {
                          setPeriodDraftStart(v);
                          setPeriodDraftSaved(false);
                          setWeekIndex(0);
                        }}
                        allowClear={false}
                        aria-label={t.ts_period_start}
                        className="!h-[34px] !min-h-[34px] !max-h-[34px] w-full justify-between gap-2 surface-glass-sm px-2 text-[13px] text-slate-800 dark:text-neutral-100 surface-ghost-interactive dark:hover:border-white/15 [&_svg]:h-3 [&_svg]:w-3"
                      />
                      <div className="mt-2 flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPeriodDraftNumWeeks(4);
                            setPeriodDraftSaved(false);
                            setWeekIndex(0);
                          }}
                          className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${
                            periodDraftNumWeeks === 4
                              ? 'bg-accent text-white'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600'
                          }`}
                        >
                          {t.ts_preset_4weeks}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPeriodDraftNumWeeks(5);
                            setPeriodDraftSaved(false);
                            setWeekIndex(0);
                          }}
                          className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold transition-colors ${
                            periodDraftNumWeeks === 5
                              ? 'bg-accent text-white'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600'
                          }`}
                        >
                          {t.ts_preset_5weeks}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleSavePeriodConfigWst();
                          closeWstToolbarDrawer();
                        }}
                        disabled={periodDraftSaved}
                        className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                          periodDraftSaved
                            ? 'cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-neutral-800 dark:text-neutral-500'
                            : 'bg-accent text-white hover:bg-accent-hover'
                        }`}
                      >
                        {t.ts_save_period}
                      </button>
                    </div>
                    <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/10 dark:text-neutral-400">
                      {t.wst_registry_section}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowHistoryModal(true);
                        closeWstToolbarDrawer();
                      }}
                      className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:text-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <History className="h-4 w-4 shrink-0 text-slate-500 dark:text-neutral-300" strokeWidth={2.25} />
                      {t.wst_schedule_history_title}
                    </button>
                    <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/10 dark:text-neutral-400">
                      {t.wst_view_section}
                    </div>
                    {canUseShiftManagementChrome && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditViewModal(true);
                          closeWstToolbarDrawer();
                        }}
                        className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:text-neutral-100 dark:hover:bg-neutral-800"
                      >
                        <Pencil className="h-4 w-4 shrink-0 text-slate-500 dark:text-neutral-300" strokeWidth={2.25} />
                        {t.edit_view}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowHiddenPeriodsModal(true);
                        closeWstToolbarDrawer();
                      }}
                      className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:text-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <EyeOff className="h-4 w-4 shrink-0 text-slate-500 dark:text-neutral-300" strokeWidth={2.25} />
                      {t.wst_hidden_periods_short}
                      {hiddenDates.size > 0 && (
                        <span className="ml-auto rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-neutral-700 dark:text-neutral-200">
                          {hiddenDates.size}
                        </span>
                      )}
                    </button>
                    <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/10 dark:text-neutral-400">
                      {t.wst_export_section}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const n = viewMode === 'day' ? 1 : viewMode === '2weeks' ? 14 : 7;
                        const rangeStart = viewMode === 'day' ? allWeekDays[0] : weekStart;
                        const weekStr = format(rangeStart, 'yyyy-MM-dd');
                        const weekEnd = format(addDays(rangeStart, n), 'yyyy-MM-dd');
                        const weekShifts = shifts.filter((s) => s.date >= weekStr && s.date < weekEnd);
                        const header = `${t.wst_export_csv_header_row}\n`;
                        const rows = weekShifts
                          .map((s) => {
                            const u = users.find((x) => x.id === s.user_id);
                            return `${s.date};${u?.first_name ?? '-'};${s.start_time};${s.end_time};${s.approval_status}`;
                          })
                          .join('\n');
                        const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `turni_${weekStr}_${weekEnd}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        closeWstToolbarDrawer();
                      }}
                      className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:text-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <Download className="h-4 w-4 shrink-0 text-slate-500 dark:text-neutral-300" strokeWidth={2.25} />
                      {t.export_csv}
                    </button>
                    {currentUser && isFeatureEnabled(currentUser, 'export_pdf') && (
                      <button
                        type="button"
                        onClick={() => {
                          exportSchedulePDF(weekStart, allWeekDays, activeUsers, shifts, {
                            filterLabel: localFilterDepartment || undefined,
                            breakRules,
                            breakComputeOpts,
                            punchRecords,
                            language: effectiveLanguage,
                          });
                          closeWstToolbarDrawer();
                        }}
                        className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:text-neutral-100 dark:hover:bg-neutral-800"
                      >
                        <Download className="h-4 w-4 shrink-0 text-slate-500 dark:text-neutral-300" strokeWidth={2.25} />
                        {t.download_pdf}
                      </button>
                    )}
                  </>
                )}

                {!isStaff && canManageDrafts && (
                  <>
                    <div className="border-b border-slate-100 px-3 py-2.5 dark:border-white/10">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-400">Template</p>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={saveTemplateName}
                          onChange={(e) => setSaveTemplateName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleSaveTemplate(saveTemplateName);
                          }}
                          placeholder={t.template_name_placeholder}
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-accent dark:border-white/10 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                        />
                        <button
                          type="button"
                          disabled={!saveTemplateName.trim() || savingTemplate}
                          onClick={() => void handleSaveTemplate(saveTemplateName)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                          aria-label={t.save}
                        >
                          {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.5} />}
                        </button>
                      </div>
                      <div className="mt-2 max-h-36 min-h-0 overflow-y-auto rounded-lg border border-slate-100 dark:border-white/10">
                        {templatesList.length === 0 ? (
                          <p className="px-2 py-2 text-xs italic text-slate-400 dark:text-neutral-500">{t.template_no_templates}</p>
                        ) : (
                          <ul className="divide-y divide-slate-100 dark:divide-white/10">
                            {templatesList.map((name) => (
                              <li key={name} className="flex items-center gap-2 px-2 py-1.5">
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-neutral-100">{name}</span>
                                <button
                                  type="button"
                                  onClick={() => void handleApplyTemplate(name)}
                                  className="shrink-0 rounded-md bg-accent/12 px-2 py-0.5 text-xs font-semibold text-accent hover:bg-accent/20"
                                >
                                  {t.template_apply}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteTemplate(name)}
                                  title={t.template_delete_confirm}
                                  className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:text-neutral-400 dark:hover:bg-red-950/40"
                                >
                                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                    <div className="border-b border-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/10 dark:text-neutral-400">
                      {t.wst_planning_section}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const n = viewMode === 'day' ? 1 : viewMode === '2weeks' ? 14 : 7;
                        const rangeStart = viewMode === 'day' ? allWeekDays[0] : weekStart;
                        const weekStr = format(rangeStart, 'yyyy-MM-dd');
                        const weekEnd = format(addDays(rangeStart, n), 'yyyy-MM-dd');
                        const toCopy = shifts.filter((s) => s.date >= weekStr && s.date < weekEnd);
                        
                        setClipboardShifts({
                          shifts: toCopy.map(s => {
                            const shiftDate = parseISO(s.date);
                            const dayOffset = Math.floor((shiftDate.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
                            return {
                              user_id: s.user_id,
                              start_time: s.start_time,
                              end_time: s.end_time,
                              type: s.type,
                              deduct_break: s.deduct_break,
                              dayOffset
                            };
                          }),
                          sourceDays: n
                        });
                        
                        closeWstToolbarDrawer();
                        showSuccess?.(formatTrans(t.shifts_copied_count, { n: toCopy.length }));
                      }}
                      className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:text-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <Copy className="h-4 w-4 shrink-0 text-slate-500 dark:text-neutral-300" strokeWidth={2.25} />
                      {t.copy_week}
                    </button>

                    {clipboardShifts && (
                      <button
                        type="button"
                        onClick={async () => {
                          const targetDate = viewMode === 'day' ? allWeekDays[0] : weekStart;
                          let pasted = 0;
                          
                          // Mostriamo un caricamento se sono tanti
                          for (const s of clipboardShifts.shifts) {
                            const newDate = addDays(targetDate, s.dayOffset);
                            const newDateStr = format(newDate, 'yyyy-MM-dd');
                            
                            try {
                              const res = await addShift({
                                user_id: s.user_id,
                                date: newDateStr,
                                start_time: s.start_time,
                                end_time: s.end_time,
                                type: s.type,
                                approval_status: 'draft',
                                deduct_break: s.deduct_break,
                              });
                              if (res) pasted++;
                            } catch { /* skip */ }
                          }
                          
                          closeWstToolbarDrawer();
                          showSuccess?.(formatTrans(t.shifts_copied_count, { n: pasted }));
                        }}
                        className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2 text-left text-sm text-accent hover:bg-accent/5 dark:border-white/10 dark:hover:bg-accent/10"
                      >
                        <Check className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                        Incolla turni qui (come bozze)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingOpenShift({ date: format(weekStart, 'yyyy-MM-dd') });
                        closeWstToolbarDrawer();
                      }}
                      className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 dark:border-white/10 dark:text-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <Plus className="h-4 w-4 shrink-0 text-slate-500 dark:text-neutral-300" strokeWidth={2.25} />
                      {t.new_open_shift}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const n = viewMode === 'day' ? 1 : viewMode === '2weeks' ? 14 : 7;
                        const rangeStart = viewMode === 'day' ? allWeekDays[0] : weekStart;
                        const rangeStr = format(rangeStart, 'yyyy-MM-dd');
                        const rangeEnd = format(addDays(rangeStart, n), 'yyyy-MM-dd');
                        const inRange = shifts.filter(
                          (s) => s.date >= rangeStr && s.date < rangeEnd && !s.notes?.startsWith('__OPEN__')
                        );
                        const frozenInRange = inRange.filter(isShiftFrozenRecord);
                        const toDelete = inRange.filter((s) => !isShiftFrozenRecord(s) && isShiftDraftLike(s));
                        const skippedNonDraft = inRange.filter((s) => !isShiftFrozenRecord(s) && !isShiftDraftLike(s));
                        closeWstToolbarDrawer();
                        if (!toDelete.length) {
                          if (inRange.length === 0) showError?.(t.no_shifts_to_delete);
                          else if (frozenInRange.length === inRange.length) showError?.(t.shift_week_only_frozen);
                          else showError?.(t.wst_delete_week_no_drafts);
                          return;
                        }
                        const confirmMsg =
                          frozenInRange.length > 0 || skippedNonDraft.length > 0
                            ? formatTrans(t.wst_delete_week_partial_confirm, {
                                n: toDelete.length,
                                m: frozenInRange.length + skippedNonDraft.length,
                              })
                            : formatTrans(t.wst_delete_all_week_shifts_confirm, { n: toDelete.length });
                        if (!confirm(confirmMsg)) return;
                        await deleteShifts(toDelete.map((s) => s.id));
                        showSuccess?.(formatTrans(t.shifts_deleted_count, { n: toDelete.length }));
                      }}
                      className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:border-white/10 dark:text-red-400 dark:hover:bg-red-950/35"
                    >
                      <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                      {tv.wst_toolbar_delete_week}
                    </button>
                  </>
                )}
              </CenteredModalPortal>
            )}
          </>
          )}
        </div>

      </div>
      </>
      )}

      {/* Modale Storico schedule */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/65" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-glass-panel flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-600 dark:text-neutral-300" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-100">{t.wst_schedule_history_title}</h3>
              </div>
              <button type="button" onClick={() => setShowHistoryModal(false)} className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[80vh] flex-1 divide-y divide-slate-50 overflow-y-auto dark:divide-white/10">
              {(() => {
                const entries = getHistory();
                if (entries.length === 0) return <p className="text-slate-500 dark:text-neutral-300 text-sm p-4 text-center">{t.wst_history_no_activity}</p>;
                const actionLabel: Record<string, string> = {
                  create: t.hist_action_create,
                  update: t.hist_action_update,
                  delete: t.hist_action_delete,
                  publish: t.hist_action_publish,
                  bulk_delete: t.hist_action_bulk_delete,
                  bulk_approve: t.hist_action_bulk_approve,
                };
                const actionColor: Record<string, string> = {
                  create: 'bg-accent/12 text-accent dark:bg-accent/20 dark:text-accent-light',
                  update: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
                  delete: 'bg-red-100 text-red-700 dark:bg-red-950/45 dark:text-red-300',
                  publish: 'bg-accent/10 text-accent dark:bg-accent/20 dark:text-accent-light',
                  bulk_delete: 'bg-red-100 text-red-700 dark:bg-red-950/45 dark:text-red-300',
                  bulk_approve: 'bg-accent/12 text-accent dark:bg-accent/20 dark:text-accent-light',
                };
                return entries.map((entry: HistoryEntry) => (
                  <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5">
                    <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${actionColor[entry.action] ?? 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                      {actionLabel[entry.action] ?? entry.action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800 dark:text-neutral-100">{entry.description}</p>
                      <p className="text-[10px] text-slate-400 dark:text-neutral-400 mt-0.5">
                        {entry.actorName} · {new Date(entry.timestamp).toLocaleString(getIntlLocale(effectiveLanguage), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modale Periodi nascosti */}
      {showHiddenPeriodsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/65" onClick={() => setShowHiddenPeriodsModal(false)}>
          <div className="modal-glass-panel flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-slate-600 dark:text-neutral-300" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-100">{t.wst_hidden_periods_modal_title}</h3>
              </div>
              <button type="button" onClick={() => setShowHiddenPeriodsModal(false)} className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs text-slate-500 dark:text-neutral-300 mb-3">{t.wst_hidden_periods_modal_help}</p>
              {hiddenDates.size === 0 ? (
                <p className="text-slate-400 dark:text-neutral-400 text-sm text-center py-4">{t.wst_no_hidden_days}</p>
              ) : (
                <ul className="space-y-2">
                  {[...hiddenDates].sort().map((date) => (
                    <li key={date} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-neutral-800/80">
                      <span className="text-sm font-semibold text-slate-700 dark:text-neutral-200">
                        {new Date(date + 'T12:00:00').toLocaleDateString(getIntlLocale(effectiveLanguage), { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = toggleHiddenDate(date);
                          setHiddenDates(next);
                        }}
                        className="p-1 rounded-xl hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                        title={t.wst_hidden_day_make_visible_tooltip}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modale elenco nomi nella tabella turni */}
      {showEditViewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/65" onClick={() => { setShowEditViewModal(false); setEditingNameUserId(null); setDraggingEditViewUserId(null); setDropTargetEditViewIdx(null); }}>
          <div className="modal-glass-panel flex max-h-[80vh] min-h-0 w-full max-w-sm flex-col overflow-hidden rounded-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
              <h3 className="text-sm font-bold text-slate-800 dark:text-neutral-100">{t.names_list_title}</h3>
              <button type="button" onClick={() => { setShowEditViewModal(false); setEditingNameUserId(null); setDraggingEditViewUserId(null); setDropTargetEditViewIdx(null); }} className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>
            {(() => {
              const orderedIdsForDrop = userOrderOverride ? [...userOrderOverride] : activeUsers.map(usr => usr.id);
              const applyDropAt = (draggedId: string, toIdx: number) => {
                if (!draggedId) return;
                const fromIdx = orderedIdsForDrop.indexOf(draggedId);
                if (fromIdx === -1) return;
                let insertIdx = toIdx;
                if (fromIdx < toIdx) insertIdx--;
                const next = [...orderedIdsForDrop];
                next.splice(fromIdx, 1);
                next.splice(insertIdx, 0, draggedId);
                setUserOrderOverride(next);
                setDraggingEditViewUserId(null);
                setDropTargetEditViewIdx(null);
                requestConfirmAndSaveOrder(next);
              };
              const handleSaveOrder = () => {
                const orderToSave = [...orderedIdsForDrop];
                requestConfirmAndSaveOrder(orderToSave);
                setShowEditViewModal(false);
                setEditingNameUserId(null);
                setDraggingEditViewUserId(null);
                setDropTargetEditViewIdx(null);
              };
              return (
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <ul className="overflow-y-auto p-3 space-y-1 flex-1 min-h-0">
                  {/* Zona drop sopra il primo nome */}
                  {canUseShiftManagementChrome && (
                    <div
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTargetEditViewIdx(0); }}
                      onDrop={(e) => { e.preventDefault(); const id = draggingEditViewUserId || e.dataTransfer.getData('text/plain'); applyDropAt(id, 0); }}
                      className={`min-h-6 -mb-1 rounded-xl transition-colors flex items-center justify-center ${dropTargetEditViewIdx === 0 ? 'bg-accent/5' : ''}`}
                    >
                      {dropTargetEditViewIdx === 0 && (
                        <div className="w-full mx-2 h-0.5 bg-accent rounded-full pointer-events-none" aria-hidden />
                      )}
                    </div>
                  )}
                  {activeUsers.map((u, i) => {
                const handleDragStart = (e: React.DragEvent) => {
                  setDraggingEditViewUserId(u.id);
                  e.dataTransfer.setData('text/plain', u.id);
                  e.dataTransfer.effectAllowed = 'move';
                };
                const handleDragOver = (e: React.DragEvent) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (draggingEditViewUserId !== u.id) setDropTargetEditViewIdx(i);
                };
                const handleDrop = (e: React.DragEvent) => {
                  e.preventDefault();
                  const draggedId = draggingEditViewUserId || e.dataTransfer.getData('text/plain');
                  if (!draggedId || draggedId === u.id) { setDraggingEditViewUserId(null); setDropTargetEditViewIdx(null); return; }
                  applyDropAt(draggedId, i);
                };
                const handleDragEnd = () => { setDraggingEditViewUserId(null); setDropTargetEditViewIdx(null); };
                const isDragging = draggingEditViewUserId === u.id;
                const isDropTarget = dropTargetEditViewIdx === i;
                return (
                  <li
                    key={u.id}
                    draggable={canUseShiftManagementChrome}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    className={`relative flex items-center gap-2 py-1.5 px-2 rounded-xl transition-colors ${canUseShiftManagementChrome ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-50' : 'hover:bg-slate-50'}`}
                  >
                    {/* Linea predittiva: dove verrà posizionata la riga al rilascio */}
                    {isDropTarget && !isDragging && (
                      <div className="absolute left-2 right-2 top-0 h-0.5 bg-accent rounded-full z-10 pointer-events-none" aria-hidden />
                    )}
                    {canUseShiftManagementChrome && (
                      <span className="shrink-0 text-slate-400 dark:text-neutral-400 touch-none" aria-hidden title={t.drag_to_reorder}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm6-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z"/></svg>
                      </span>
                    )}
                    {canUseShiftManagementChrome && !isPurelyManagementRole(u.role) && editingNameUserId === u.id ? (
                      <input
                        type="text"
                        value={editingNameValue}
                        onChange={(e) => setEditingNameValue(e.target.value)}
                        onBlur={() => {
                          const trimmed = editingNameValue.trim();
                          if (trimmed && trimmed !== u.first_name) {
                            updateUser(u.id, { first_name: trimmed.toUpperCase() });
                          }
                          setEditingNameUserId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') {
                            setEditingNameValue(u.first_name);
                            setEditingNameUserId(null);
                          }
                        }}
                        className="flex-1 min-w-0 px-2 py-1 text-sm font-semibold rounded-xl border border-accent/50 bg-white focus:outline-none focus:ring-1 focus:ring-accent text-slate-800"
                        autoFocus
                      />
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-slate-800 truncate flex-1 min-w-0">{u.first_name}</span>
                        {isManagement && !isPurelyManagementRole(u.role) && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNameUserId(u.id);
                              setEditingNameValue(u.first_name);
                            }}
                            className="shrink-0 p-1 rounded-xl text-slate-500 dark:text-neutral-300 hover:text-accent hover:bg-accent/10 focus:outline-none focus:ring-1 focus:ring-accent"
                            title={t.edit_name}
                            aria-label={t.edit_name}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
                  {/* Zona drop sotto l'ultimo nome */}
                  {canUseShiftManagementChrome && (
                    <div
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTargetEditViewIdx(activeUsers.length); }}
                      onDrop={(e) => { e.preventDefault(); const id = draggingEditViewUserId || e.dataTransfer.getData('text/plain'); applyDropAt(id, activeUsers.length); }}
                      className={`min-h-6 -mt-1 rounded-xl transition-colors flex items-center justify-center ${dropTargetEditViewIdx === activeUsers.length ? 'bg-accent/5' : ''}`}
                    >
                      {dropTargetEditViewIdx === activeUsers.length && (
                        <div className="w-full mx-2 h-0.5 bg-accent rounded-full pointer-events-none" aria-hidden />
                      )}
                    </div>
                  )}
                </ul>
                {canUseShiftManagementChrome && (
                  <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-slate-200 bg-slate-100 flex-shrink-0 rounded-b-xl">
                    <button
                      type="button"
                      onClick={() => { setShowEditViewModal(false); setEditingNameUserId(null); setDraggingEditViewUserId(null); setDropTargetEditViewIdx(null); }}
                      className="surface-glass-sm px-4 py-2 text-xs font-semibold uppercase text-slate-600 surface-ghost-interactive transition-colors"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveOrder}
                      disabled={savingOrder}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-accent text-white text-xs font-semibold uppercase hover:bg-accent-hover active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none transition-all shadow-sm"
                    >
                      {savingOrder ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : null}
                      <span>{t.save}</span>
                    </button>
                  </div>
                )}
                </div>
              );
            })()}
            </div>
        </div>
      )}
      {wTurniDate && (
      <>
      {/* Sentinel: sopra la sticky bar — usato per ombra “elevata” dopo scroll */}
      <div
        ref={dateBarSentinelRef}
        className="h-px w-full shrink-0 pointer-events-none opacity-0"
        aria-hidden
      />
      {/* Barra date: sticky; bordo/ombra solo sulla card (stesso box) così sembra che fluttui — niente striscia full-bleed */}
      <div
        className={`sticky z-[39] mt-2 mb-2 sm:mt-2 ${
          stickyDateBarInScrollPane ? 'top-0' : 'top-[var(--app-sticky-header-offset)]'
        }`}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.04, duration: 0.2 }}
          className={`rounded-lg overflow-hidden border-0 bg-transparent transition-[box-shadow,backdrop-filter] duration-300 ease-out ${
            dateBarStuck
              ? 'shadow-md backdrop-blur-md dark:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.45)]'
              : 'shadow-none backdrop-blur-[2px]'
          } ${viewMode === 'month' ? 'flex h-[22px] items-stretch' : 'relative h-[38px] min-h-[38px]'}`}
        >
          {viewMode === 'month' ? (
            <>
              <button
                type="button"
                onClick={() => setPeriodPanOffsetWeeks((p) => p - displayPeriodConfig.numWeeks)}
                className="shrink-0 w-8 flex items-center justify-center border-r border-slate-200/80 dark:border-white/10 bg-transparent text-slate-500 dark:text-neutral-300 transition-colors hover:bg-slate-100/60 dark:hover:bg-white/5 active:bg-slate-200/50 dark:active:bg-white/10"
                aria-label={t.wst_month_prev_aria}
              >
                <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </button>
              <div className="flex-1 min-w-0 flex items-center justify-center px-1.5 overflow-hidden">
                <span className="text-center text-[10px] sm:text-[11px] font-bold text-slate-800 dark:text-neutral-100 uppercase tracking-wide tabular-nums truncate leading-none">
                  {format(monthViewPeriodStart, 'd MMM', { locale: getDateLocale(effectiveLanguage) ?? it })} –{' '}
                  {format(monthViewPeriodEnd, 'd MMM yyyy', { locale: getDateLocale(effectiveLanguage) ?? it })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPeriodPanOffsetWeeks((p) => p + displayPeriodConfig.numWeeks)}
                className="shrink-0 w-8 flex items-center justify-center border-l border-slate-200/80 dark:border-white/10 bg-transparent text-slate-500 dark:text-neutral-300 transition-colors hover:bg-slate-100/60 dark:hover:bg-white/5 active:bg-slate-200/50 dark:active:bg-white/10"
                aria-label={t.wst_month_next_aria}
              >
                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </button>
              {/* Indicatore sync — mese: in flex (nessuno scroll orizzontale da allineare) */}
              <AnimatePresence>
                {(pendingSaves > 0 || justSynced) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-1 px-1.5 flex-shrink-0 border-l border-slate-200/50 dark:border-white/10"
                  >
                    {pendingSaves > 0 ? (
                      <>
                        <Loader2 className="h-2.5 w-2.5 shrink-0 text-amber-600 animate-spin" />
                        <span className="text-amber-600 text-[10px] font-medium leading-none hidden sm:inline">{t.ts_saving}</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="h-2.5 w-2.5 shrink-0 text-accent" />
                        <span className="text-accent text-[10px] font-medium leading-none hidden sm:inline">{t.wst_sync_saved}</span>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <>
              {/*
                Scroll a tutta larghezza (allineato alla tabella). Frecce in overlay (niente fascia gradiente → niente linea verticale).
              */}
              <div
                ref={dateBarScrollRef}
                onScroll={(e) => syncScrollLeft(e.currentTarget)}
                className="absolute inset-0 flex flex-col overflow-x-auto-safe overflow-y-hidden smooth-touch overscroll-x-contain touch-manipulation snap-x snap-proximity px-0"
              >
                  <div
                    className={`box-content flex h-[38px] min-h-[38px] max-h-[38px] min-w-0 flex-1 items-center gap-[3px] sm:w-full ${allWeekDays.length === 1 ? 'w-[33.33%]' : allWeekDays.length === 14 ? 'w-[466.67%]' : allWeekDays.length === 42 ? 'w-full' : 'w-[233.33%]'}`}
                  >
                    {allWeekDays.map((day) => {
                      const isTodayDate = isToday(day);
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const isPayrollDayBar = dayStr === weekSchedulePayrollDayStr;
                      const trBar = t as Record<string, string>;
                      const payrollTitleBar = isPayrollDayBar
                        ? `${format(day, 'EEEE d MMMM yyyy', { locale: getDateLocale(effectiveLanguage) ?? it })} — ${trBar.ts_payroll_day_abbr ?? 'Paga'}`
                        : '';
                      const dateBarTitle = payrollTitleBar || undefined;
                      const dayBarCellClass = `flex-1 flex h-[30px] min-h-[30px] max-h-[30px] min-w-0 items-center justify-center gap-0.5 sm:gap-1 snap-center whitespace-nowrap font-inherit rounded-md border border-slate-200/70 dark:border-white/12 ${
                        hiddenDates.has(dayStr)
                          ? 'bg-slate-200/60 dark:bg-neutral-700/50'
                          : isPayrollDayBar
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 ring-1 ring-inset ring-emerald-200/85 dark:ring-emerald-800/50'
                            : isTodayDate
                              ? 'bg-accent/10 ring-1 ring-inset ring-accent/45'
                              : ''
                      } ${sidebarOpen && sidebarDay === dayStr ? 'ring-2 ring-inset ring-accent/50 dark:ring-accent-light/40' : ''} ${isManagement ? 'select-none' : ''}`;
                      const dayBarInner = (
                        <span className="inline-flex min-h-0 max-h-full items-center justify-center gap-0.5 sm:gap-1">
                          {canShiftOps && hiddenDates.has(dayStr) && (
                            <EyeOff className="h-3 w-3 shrink-0 text-slate-400 dark:text-neutral-400" />
                          )}
                          <span
                            className={`shrink-0 text-[9px] sm:text-[10px] font-bold uppercase tabular-nums leading-none ${hiddenDates.has(dayStr) ? 'text-slate-400 dark:text-neutral-400' : isTodayDate ? 'text-accent dark:text-emerald-400' : 'text-slate-600 dark:text-neutral-300'}`}
                          >
                            {format(day, 'EEE', { locale: getDateLocale(effectiveLanguage) ?? it }).toUpperCase()}
                          </span>
                          <span
                            className={`shrink-0 text-center font-extrabold tabular-nums leading-none ${hiddenDates.has(dayStr) ? 'text-[9px] sm:text-[10px] text-slate-400 dark:text-neutral-400' : isTodayDate ? 'text-[10px] sm:text-[11px] text-accent dark:text-emerald-400' : 'text-[9px] sm:text-[10px] text-slate-900 dark:text-neutral-50'}`}
                          >
                            {format(day, 'd')}
                          </span>
                        </span>
                      );
                      return (
                        <div key={day.toString()} className={dayBarCellClass} title={dateBarTitle}>
                          {dayBarInner}
                        </div>
                      );
                    })}
                  </div>
              </div>
              <button
                type="button"
                disabled={weekIndex <= 0}
                onClick={() => setWeekIndex((i) => Math.max(0, i - 1))}
                className="absolute left-0.5 top-1/2 z-30 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 text-slate-500 shadow-sm backdrop-blur-md transition-[color,box-shadow,transform] hover:border-slate-300 hover:bg-slate-50/90 hover:text-slate-800 active:scale-95 disabled:pointer-events-none disabled:opacity-0 dark:border-white/12 dark:bg-neutral-900/45 dark:text-neutral-300 dark:hover:border-white/18 dark:hover:bg-neutral-800/55 dark:hover:text-neutral-100 bg-slate-50/55"
                aria-label={t.week_prev}
              >
                <ChevronLeft className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
              </button>
              <button
                type="button"
                disabled={weekIndex >= maxWeekIndex}
                onClick={() => setWeekIndex((i) => Math.min(maxWeekIndex, i + 1))}
                className="absolute right-0.5 top-1/2 z-30 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 text-slate-500 shadow-sm backdrop-blur-md transition-[color,box-shadow,transform] hover:border-slate-300 hover:bg-slate-50/90 hover:text-slate-800 active:scale-95 disabled:pointer-events-none disabled:opacity-0 dark:border-white/12 dark:bg-neutral-900/45 dark:text-neutral-300 dark:hover:border-white/18 dark:hover:bg-neutral-800/55 dark:hover:text-neutral-100 bg-slate-50/55"
                aria-label={t.week_next}
              >
                <ChevronRight className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
              </button>
              <AnimatePresence>
                {(pendingSaves > 0 || justSynced) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="pointer-events-none absolute right-8 top-1/2 z-40 flex h-5 -translate-y-1/2 items-center gap-0.5 rounded-full border border-slate-200/70 bg-slate-50/70 py-0 pl-1 pr-1.5 text-[10px] shadow-sm backdrop-blur-sm dark:border-white/12 dark:bg-neutral-900/60"
                  >
                    {pendingSaves > 0 ? (
                      <>
                        <Loader2 className="h-2.5 w-2.5 shrink-0 text-amber-600 animate-spin" />
                        <span className="text-amber-600 text-[10px] font-medium leading-none hidden sm:inline">{t.ts_saving}</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="h-2.5 w-2.5 shrink-0 text-accent" />
                        <span className="text-accent text-[10px] font-medium leading-none hidden sm:inline">{t.wst_sync_saved}</span>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </motion.div>
      </div>
      </>
      )}

      {/* Contenuto: vista mese (calendario) o schede turni */}
      {wTurniGrid && (
      <div ref={scrollContainerRef} className="flex flex-col gap-2">
        {viewMode === 'month' ? (
          <HorizontalScrollArea
            remeasureKey={`${displayPeriodConfig.startDate}-${displayPeriodConfig.numWeeks}-${periodPanOffsetWeeks}`}
            ariaLabelPrev={t.table_h_scroll_prev}
            ariaLabelNext={t.table_h_scroll_next}
            navRowClassName="pb-2"
            scrollClassName="overflow-x-auto-safe"
          >
          <div className="min-w-[640px] surface-ghost-sm overflow-hidden">
            {/* Intestazione giorni settimana */}
            <div className="grid grid-cols-7 bg-slate-50 dark:bg-neutral-800/80 border-b-2 border-slate-200 dark:border-white/10">
              {allWeekDays.slice(0, 7).map((d, i) => (
                <div
                  key={d.toString()}
                  className={`py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 ${i < 6 ? 'border-r-2 border-slate-200 dark:border-white/10' : ''}`}
                >
                  {format(d, 'EEE', { locale: getDateLocale(effectiveLanguage) ?? it })}
                </div>
              ))}
            </div>
            {/* Griglia giorni */}
            <div className="grid grid-cols-7">
              {allWeekDays.map((day, dayIdx) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const inPlanning = isDayInMonthViewWindow(day);
                const isPayrollDay = dayStr === periodViewPrimaryPayrollStr;
                const isTodayDate = isToday(day);
                const dayShifts = visibleShifts.filter((s) => s.date === dayStr);
                const hasShifts = dayShifts.length > 0;
                const dayOpenShifts = openVisibleShifts.filter((s) => s.date === dayStr);
                const isLastCol = dayIdx % 7 === 6;
                const showCounts = inPlanning;
                const tr = t as Record<string, string>;
                const titleParts: string[] = [];
                if (!inPlanning) titleParts.push(tr.wst_month_outside_period_title ?? '');
                if (isPayrollDay) {
                  titleParts.push(
                    `${format(day, 'EEEE d MMMM yyyy', { locale: getDateLocale(effectiveLanguage) ?? it })} — ${tr.ts_payroll_day_abbr ?? 'Paga'}`
                  );
                }
                const cellTitle = titleParts.length ? titleParts.filter(Boolean).join('\n') : undefined;
                return (
                  <button
                    key={dayStr}
                    type="button"
                    title={cellTitle}
                    onClick={() => {
                      const ids = hasShifts ? dayShifts.map((s) => s.id) : [];
                      setSelectedShiftIds(ids);
                      setSidebarDay(dayStr);
                      if (ids.length > 0 && canEditShifts) setSidebarOpen(true);
                    }}
                    className={`min-h-[72px] sm:min-h-[84px] p-2 text-left transition-colors border-b-2 border-slate-200 dark:border-white/10 ${!isLastCol ? 'border-r-2 border-r-slate-200 dark:border-r-white/10' : ''} ${
                      !inPlanning
                        ? 'bg-slate-50/80 dark:bg-neutral-900/90 hover:bg-slate-100/90 dark:hover:bg-neutral-800'
                        : isPayrollDay
                          ? 'bg-emerald-50/90 dark:bg-emerald-950/35 ring-1 ring-inset ring-emerald-200/90 dark:ring-emerald-800/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                          : isTodayDate
                            ? 'bg-accent/5 hover:bg-accent/10'
                            : 'bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {/* Numero giorno */}
                    <span
                      className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${
                        isTodayDate && inPlanning
                          ? 'bg-accent text-white'
                          : !inPlanning
                            ? isPayrollDay
                              ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 ring-1 ring-emerald-200/80 dark:ring-emerald-700/50'
                              : 'text-slate-300 dark:text-neutral-600'
                            : isPayrollDay
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-700 dark:text-neutral-200'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {isPayrollDay && (
                      <span className="mt-1 block text-[8px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                        {tr.ts_payroll_day_abbr ?? 'Paga'}
                      </span>
                    )}
                    {/* Conteggio turni */}
                    {hasShifts && showCounts && (
                      <span className="flex items-center gap-1 mt-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-neutral-300">
                          {dayShifts.length} {dayShifts.length === 1 ? t.shift_singular : t.shift_plural}
                        </span>
                      </span>
                    )}
                    {/* Badge turni aperti */}
                    {dayOpenShifts.length > 0 && showCounts && (
                      <span className="block mt-1 text-[9px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 w-fit">
                        +{dayOpenShifts.length} {t.open_shifts_short}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          </HorizontalScrollArea>
        ) : (
              activeUsers.map((user, userIdx) => {
                const canManageThisUser = canEditInApp && !isPurelyManagementRole(user.role);

                return (
                  <motion.div
                    key={user.id}
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.04 + 0.03 * userIdx, duration: 0.28 }}
                    draggable={canShiftOps}
                    onDragStart={(e) => {
                      const ev = e as unknown as React.DragEvent;
                      ev.dataTransfer.setData('dragType', 'user');
                      ev.dataTransfer.setData('userIdx', String(userIdx));
                      setDraggingUserIdx(userIdx);
                    }}
                    onDragEnd={() => { setDraggingUserIdx(null); setDropUserIdx(null); }}
                    onDragOver={(e) => {
                      if (draggingUserIdx !== null && draggingUserIdx !== userIdx) {
                        e.preventDefault(); setDropUserIdx(userIdx);
                      }
                    }}
                    onDragLeave={() => setDropUserIdx(null)}
                    onDrop={(e) => {
                      const ev = e as unknown as React.DragEvent;
                      const dtype = ev.dataTransfer.getData('dragType');
                      if (dtype !== 'user') return;
                      const fromIdx = parseInt(ev.dataTransfer.getData('userIdx'), 10);
                      if (isNaN(fromIdx) || fromIdx === userIdx) return;
                      const ordered = (userOrderOverride
                        ? [...userOrderOverride]
                        : activeUsers.map(u => u.id));
                      const [moved] = ordered.splice(fromIdx, 1);
                      ordered.splice(userIdx, 0, moved);
                      setUserOrderOverride(ordered);
                      setDraggingUserIdx(null); setDropUserIdx(null);
                      requestConfirmAndSaveOrder(ordered);
                    }}
                    className={`w-full rounded-xl !p-0 overflow-hidden border-2 border-slate-300/85 bg-transparent shadow-none dark:border-neutral-600 dark:bg-transparent ${draggingUserIdx !== null && draggingUserIdx !== userIdx ? 'opacity-50' : ''} ${dropUserIdx === userIdx && draggingUserIdx !== null && draggingUserIdx !== userIdx ? 'ring-2 ring-inset ring-accent' : ''}`}
                  >
                    {/* Header scheda: nome + ore (fisso, non scorre) — verde bottomnav */}
                    <div
                      onClick={() => canViewTotalHours && setLocalFilterUserId(prev => prev === user.id ? null : user.id)}
                      title={canEditInApp ? t.wst_name_row_filter_title : undefined}
                      className={`flex items-center justify-between min-h-0 px-2.5 py-1 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-neutral-800/70 ${user.status === 'suspended' || user.status === 'inactive' ? 'opacity-60' : ''} ${canEditInApp ? 'cursor-pointer' : ''}`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0 flex-1">
                        {canEditInApp && editingNameUserId === user.id ? (
                          <input
                            type="text"
                            value={editingNameValue}
                            onChange={(e) => setEditingNameValue(e.target.value)}
                            onBlur={() => {
                              const trimmed = editingNameValue.trim();
                              if (trimmed && trimmed !== user.first_name) {
                                updateUser(user.id, { first_name: trimmed.toUpperCase() });
                              }
                              setEditingNameUserId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                              if (e.key === 'Escape') {
                                setEditingNameValue(user.first_name);
                                setEditingNameUserId(null);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full min-w-0 px-1.5 py-0.5 text-xs font-bold uppercase leading-tight rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-accent text-slate-900 dark:text-neutral-100"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`font-bold text-xs uppercase leading-tight truncate ${user.status === 'suspended' || user.status === 'inactive' ? 'text-slate-400 dark:text-neutral-500 line-through' : 'text-slate-800 dark:text-neutral-100'} ${(canViewTotalHours || canEditInApp) ? 'cursor-pointer hover:underline' : ''}`}
                            onClick={() => (canViewTotalHours || canEditInApp) && setLocalFilterUserId(prev => prev === user.id ? null : user.id)}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (canEditInApp && !isPurelyManagementRole(user.role)) {
                                setEditingNameUserId(user.id);
                                setEditingNameValue(user.first_name);
                              }
                            }}
                            title={canEditInApp && !isPurelyManagementRole(user.role) ? t.edit_name : undefined}
                          >
                            {user.first_name}
                          </span>
                        )}
                      </span>
                      {canViewTotalHours && (
                        <span className="font-bold text-xs uppercase leading-tight text-slate-500 dark:text-neutral-300 tabular-nums shrink-0 min-w-[2.5rem] text-right">
                          {(weeklyMinutesScheduledByUser[user.id] ?? 0) > 0
                            ? formatMinutesToHoursAndMinutes(weeklyMinutesScheduledByUser[user.id] ?? 0)
                            : '—'}
                        </span>
                      )}
                    </div>
                    {/* Tabella turni: MOBILE w-[233.33%] + scroll + swipe | WEB sm:w-full = 7 giorni */}
                    <div
                      ref={(el) => { cardScrollRefs.current[userIdx] = el; }}
                      onScroll={(e) => syncScrollLeft(e.currentTarget)}
                      className="overflow-x-auto-safe smooth-touch overscroll-x-contain touch-manipulation snap-x snap-proximity -mx-0.5 px-0.5"
                    >
                    <table className={`border-collapse table-fixed min-w-0 sm:w-full ${allWeekDays.length === 1 ? 'w-[33.33%]' : allWeekDays.length === 14 ? 'w-[466.67%]' : 'w-[233.33%]'}`}>
                      <tbody>
                        {/* MOBILE+WEB: h-[100px] compatto */}
                        <tr className="min-h-[100px] h-[100px] sm:h-[100px]">
                      {allWeekDays.map((day, dayIdx) => {
                        const dayStr = format(day, 'yyyy-MM-dd');
                        const isPayrollCol = dayStr === weekSchedulePayrollDayStr;
                        const dayShifts = visibleShifts.filter(
                          (s) => s.user_id === user.id && s.date === dayStr
                        );

                        const dayShift = dayShifts.find((s) => parseInt(s.start_time.split(':')[0]) < 16);
                        const eveningShift = dayShifts.find((s) => parseInt(s.start_time.split(':')[0]) >= 16);
                        /** Stesso criterio di `getShiftViolations` (overlap). */
                        const hasOverlap =
                          violationChromeEnabled &&
                          !!effectiveWorkRules.overlapEnabled &&
                          !!(dayShift && eveningShift && shiftsOverlap(dayShift, eveningShift));
                        const dayVariant: ShiftColorVariant = dayShift ? getShiftColorVariant(dayShift) : 'planned';
                        const eveningVariant: ShiftColorVariant = eveningShift ? getShiftColorVariant(eveningShift) : 'planned';

                        const isInDragRect = (slotIdx: number) => {
                          if (!dragStartRef.current || !dragSelect) return false;
                          const s = dragStartRef.current;
                          const [ruMin, ruMax] = [Math.min(s.userIdx, dragSelect.userIdx), Math.max(s.userIdx, dragSelect.userIdx)];
                          const [rdMin, rdMax] = [Math.min(s.dayIdx, dragSelect.dayIdx), Math.max(s.dayIdx, dragSelect.dayIdx)];
                          const [rsMin, rsMax] = [Math.min(s.slotIdx, dragSelect.slotIdx), Math.max(s.slotIdx, dragSelect.slotIdx)];
                          return userIdx >= ruMin && userIdx <= ruMax && dayIdx >= rdMin && dayIdx <= rdMax && slotIdx >= rsMin && slotIdx <= rsMax;
                        };

                        const isHolidayDay = approvedHolidayDates.has(`${user.id}_${dayStr}`);
                        const isUnavailDay = availability.some(
                          (a) => a.user_id === user.id && a.start_date <= dayStr && a.end_date >= dayStr
                        );
                        const canToggleAvail = !isManagement && currentUser?.id === user.id && !isHolidayDay;

                        const cellsPerColumn = activeUsers.length * 2;
                        const cellIndex = dayIdx * cellsPerColumn + (userIdx * 2);

                        if (isHolidayDay) {
                          return (
                            <td
                              key={dayStr}
                              className="px-0 py-0 min-w-0 snap-start bg-amber-50/60 border-r border-slate-300 dark:bg-amber-950/30 dark:border-neutral-600"
                              style={{ width: `calc(100% / ${allWeekDays.length})` }}
                            >
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.08 + Math.floor(cellIndex / 2) * 0.06, duration: 0.12, ease: [0.22, 0.61, 0.36, 1] }}
                                className="min-h-[100px] h-[100px] sm:h-[100px] flex items-center justify-center"
                              >
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 text-xs font-semibold uppercase tracking-wider select-none">
                                  🌴 Ferie
                                </span>
                              </motion.div>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={dayStr}
                            className={`px-0 py-0 min-w-0 snap-start group border-r border-slate-300 dark:border-neutral-600 ${
                              isPayrollCol
                                ? 'bg-emerald-50/30 ring-1 ring-inset ring-emerald-200/50 dark:bg-emerald-950/20 dark:ring-emerald-800/40'
                                : isToday(day)
                                  ? 'bg-accent/5 dark:bg-accent/10'
                                  : isUnavailDay
                                    ? 'bg-red-50/70 dark:bg-red-950/25'
                                    : 'bg-white dark:bg-neutral-950/40'
                            }`}
                            style={{ width: `calc(100% / ${allWeekDays.length})` }}
                          >
                            {/* Indisponibilità indicator + toggle (solo per staff sulla propria riga) */}
                            {isUnavailDay && dayShifts.length === 0 && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                                <span className="text-red-200 text-[10px] font-semibold uppercase select-none">N/D</span>
                              </div>
                            )}
                            <div className="relative grid grid-rows-2 min-h-[100px] h-[100px] sm:h-[100px]">
                            {/* Toggle disponibilità (solo staff, su celle vuote) */}
                            {canToggleAvail && dayShifts.length === 0 && (
                              <button
                                type="button"
                                onClick={() => toggleAvailability(user.id, dayStr)}
                                title={isUnavailDay ? t.wst_unavailability_remove : t.wst_unavailability_mark}
                                className={`absolute bottom-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl px-1.5 py-0.5 text-[10px] font-semibold ${isUnavailDay ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500'}`}
                              >
                                {isUnavailDay ? '✕ N/D' : '— N/D'}
                              </button>
                            )}
                              {/* Slot Superiore - Turno Diurno */}
                              <div
                                onClick={(e) => {
                                  if (dayShift) {
                                    if (cellEdit?.shiftId === dayShift.id) return;
                                    if ((e.target as HTMLElement).closest('button')) return;
                                    if (canEditShifts) {
                                      setSelectedShiftIds([dayShift.id]);
                                      setSidebarDay(dayStr);
                                      setSidebarOpen(true);
                                    }
                                  } else if (canManageThisUser) {
                                    setCreatingShift({ userId: user.id, date: dayStr, defaultTime: '10:00' });
                                  }
                                }}
                                onDoubleClick={(e) => {
                                  if (dayShift && canEditInApp && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                                    if (!isShiftDraftLike(dayShift) || isShiftAbsentRecord(dayShift)) return;
                                    const cur = `${(dayShift.start_time||'').slice(0,5)}-${(dayShift.end_time||'').slice(0,5)}`;
                                    setCellEdit({ shiftId: dayShift.id, value: cur });
                                  }
                                }}
                                onMouseDown={(e) => handleCellMouseDown(e, userIdx, dayIdx, 0)}
                                onMouseEnter={() => handleCellMouseEnter(userIdx, dayIdx, 0)}
                                onDragOver={(e) => { if (draggedShiftId) { e.preventDefault(); setDropTargetKey(`${user.id}_${dayStr}_0`); } }}
                                onDragLeave={() => setDropTargetKey(null)}
                                onDrop={(e) => { e.preventDefault(); if (draggedShiftId) { handleDropShift(draggedShiftId, user.id, dayStr); setDraggedShiftId(null); setDropTargetKey(null); } }}
                                title={dayShift && needsCambioWarning(dayShift) ? t.no_change_at_16 : undefined}
                                className={`flex flex-col ${
                                  dayShift
                                    ? dayVariant === 'planned'
                                      ? 'border-b-2 border-dashed border-slate-300 dark:border-white/55'
                                      : dayVariant === 'inprogress'
                                        ? 'border-b-2 border-emerald-500/55 dark:border-emerald-600/40'
                                        : dayVariant === 'punchMissing'
                                          ? 'border-b-2 border-amber-500/55 dark:border-amber-600/40'
                                          : dayVariant === 'absent'
                                            ? 'border-b-2 border-rose-400/60 dark:border-rose-600/40'
                                            : dayVariant === 'approved'
                                              ? 'border-b-2 border-emerald-700/35 dark:border-emerald-500/35'
                                              : 'border-b-2 border-slate-400 dark:border-white/45'
                                    : 'border-b-2 border-slate-400 dark:border-white/45'
                                } relative select-none ${hasOverlap ? 'shadow-[0_0_10px_rgba(239,68,68,0.5)]' : ''} ${dropTargetKey === `${user.id}_${dayStr}_0` ? 'bg-amber-100 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600' : dayShift ? getCellStyle(dayShift, selectedShiftIds.includes(dayShift.id) || isInDragRect(0), selectedShiftIds.length > 0, dayVariant) : isInDragRect(0) ? 'bg-accent/10 border-2 border-accent' : 'border-transparent'} ${dayShift ? 'shift-card-hover-group' : ''} ${!dayShift && canManageThisUser ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800/60' : !dayShift ? 'cursor-default' : dayShift && canEditInApp ? 'cursor-pointer hover:ring-2 hover:ring-accent/40 hover:ring-inset' : ''}`}
                              >
                                {dayShift ? (() => {
                                  const isAbsentCell = isShiftAbsentRecord(dayShift);
                                  const actualTimes = getActualShiftTime(dayShift, punchRecords);
                                  const startNormCell = (dayShift.start_time || '').slice(0, 5);
                                  const endFallback = startNormCell === '10:00' ? '16:00' : null;
                                  const endStr = (actualTimes.endTime || endFallback)?.slice(0, 5) || '___';
                                  const { start: dispS, end: dispE } = getResolvedStartEndForHours(dayShift, punchRecords);
                                  const timeDisplayed = isAbsentCell
                                    ? t.status_absent
                                    : dayShift.approved_at && dayShift.approved_start_time && dayShift.approved_end_time
                                      ? `${dispS} – ${dispE}`
                                      : `${actualTimes.startTime.slice(0, 5)} – ${endStr}`;
                                  const timeDisplayedShort = isAbsentCell
                                    ? t.status_absent
                                    : dayShift.approved_at && dayShift.approved_start_time && dayShift.approved_end_time
                                      ? `${toShortTime(dispS)}–${toShortTime(dispE)}`
                                      : `${toShortTime(actualTimes.startTime)}–${toShortTime(endStr)}`;
                                  const timeTextCls =
                                    dayVariant === 'approved'
                                      ? 'text-white'
                                      : dayVariant === 'absent'
                                        ? 'text-rose-950 dark:text-rose-50'
                                        : dayVariant === 'planned'
                                          ? 'text-slate-900 dark:text-white'
                                          : dayVariant === 'punchMissing'
                                            ? 'text-amber-950 dark:text-amber-100'
                                            : dayVariant === 'inprogress'
                                              ? 'text-emerald-900 dark:text-emerald-50'
                                              : 'text-slate-900 dark:text-white';
                                  const approvalDayNorm = normalizedApprovalStatus(dayShift.approval_status);
                                  const showPublishedBarDay =
                                    !isAbsentCell &&
                                    !isShiftPayrollFrozen(dayShift) &&
                                    (approvalDayNorm === 'confirmed' || approvalDayNorm === 'approved');
                                  const delayMinsDay = getPunchDelayMinutes(dayShift, punchRecords);
                                  const showLateBarDay = !isAbsentCell && delayMinsDay != null && delayMinsDay > 0;
                                  const showPunchMissingBarDay = !isAbsentCell && dayVariant === 'punchMissing';
                                  return (
                                    <>
                                      {/* Barra sinistra: turno pubblicato (tabellone) */}
                                      {showPublishedBarDay && (
                                        <span
                                          className={`absolute left-1.5 top-1/2 z-[1] -translate-y-1/2 ${shiftCardStatusPillClass} bg-emerald-600 dark:bg-emerald-500`}
                                          title={t.wst_filter_published}
                                          aria-hidden
                                        />
                                      )}
                                      {/* Inline edit input */}
                                      {canEditInApp && cellEdit?.shiftId === dayShift.id ? (
                                        <input
                                          value={cellEdit.value}
                                          onChange={(e) => setCellEdit({ shiftId: dayShift.id, value: e.target.value })}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') { e.preventDefault(); handleCellEditSave(dayShift.id, cellEdit.value); }
                                            if (e.key === 'Escape') setCellEdit(null);
                                          }}
                                          onBlur={() => handleCellEditSave(dayShift.id, cellEdit.value)}
                                          onClick={(e) => e.stopPropagation()}
                                          autoFocus
                                          placeholder="10-16"
                                          className="absolute left-1/2 top-1/2 z-10 w-[min(100px,calc(100%-12px))] -translate-x-1/2 -translate-y-1/2 bg-white text-slate-800 text-xs font-bold text-center border-2 border-amber-500 rounded-xl shadow-lg focus:outline-none px-1 py-0.5"
                                        />
                                      ) : (
                                        <>
                                          {/* Orario centrato in cella */}
                                          {canEditInApp ? (
                                            <span
                                              draggable={isShiftDraftLike(dayShift) && !isAbsentCell}
                                              onDragStart={(e: React.DragEvent) => { e.stopPropagation(); e.dataTransfer.setData('shiftId', dayShift.id); setDraggedShiftId(dayShift.id); }}
                                              onDragEnd={() => { setDraggedShiftId(null); setDropTargetKey(null); }}
                                              onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                if (!isShiftDraftLike(dayShift) || isAbsentCell) return;
                                                const cur = `${(dayShift.start_time||'').slice(0,5)}-${(dayShift.end_time||'').slice(0,5)}`;
                                                setCellEdit({ shiftId: dayShift.id, value: cur });
                                              }}
                                              className={`absolute inset-0 z-0 flex items-center justify-center px-2 cursor-text ${shakeBadgeId === dayShift.id ? 'animate-shake' : ''}`}
                                              style={{ opacity: 1 }}
                                              title="Doppio click: modifica"
                                            >
                                              <span className="flex max-w-full min-w-0 items-center justify-center gap-1.5">
                                                <span className="min-w-0 text-center font-bold leading-none">
                                                  <span className={`max-w-full truncate text-xs hidden sm:block ${timeTextCls}`}>{timeDisplayed}</span>
                                                  <span className={`max-w-full truncate text-[11px] block sm:hidden ${timeTextCls}`}>{timeDisplayedShort}</span>
                                                </span>
                                                {showPunchMissingBarDay && (
                                                  <span
                                                    className={`${shiftCardStatusPillClass} bg-amber-400 dark:bg-amber-500`}
                                                    title={t.ts_status_unpunched}
                                                    aria-hidden
                                                  />
                                                )}
                                                {showLateBarDay && (
                                                  <span
                                                    className={`${shiftCardStatusPillClass} bg-red-500 dark:bg-red-400`}
                                                    title={t.ts_status_late}
                                                    aria-hidden
                                                  />
                                                )}
                                              </span>
                                            </span>
                                          ) : (
                                            <span className="absolute inset-0 z-0 flex items-center justify-center px-2">
                                              <span className="flex max-w-full min-w-0 items-center justify-center gap-1.5">
                                                <span className="min-w-0 text-center font-bold leading-none">
                                                  <span className={`max-w-full truncate text-xs hidden sm:block ${timeTextCls}`}>{timeDisplayed}</span>
                                                  <span className={`max-w-full truncate text-[11px] block sm:hidden ${timeTextCls}`}>{timeDisplayedShort}</span>
                                                </span>
                                                {showPunchMissingBarDay && (
                                                  <span
                                                    className={`${shiftCardStatusPillClass} bg-amber-400 dark:bg-amber-500`}
                                                    title={t.ts_status_unpunched}
                                                    aria-hidden
                                                  />
                                                )}
                                                {showLateBarDay && (
                                                  <span
                                                    className={`${shiftCardStatusPillClass} bg-red-500 dark:bg-red-400`}
                                                    title={t.ts_status_late}
                                                    aria-hidden
                                                  />
                                                )}
                                              </span>
                                            </span>
                                          )}
                                          {/* Approvato + congelato: ✓ + lucchetto in basso a sinistra; altri sigilli (es. assenza): ✓ centrata */}
                                          {dayShift.approved_at &&
                                            normalizedApprovalStatus(dayShift.approval_status) === 'approved' && (
                                              <span
                                                className="absolute bottom-1 left-1 z-[1] flex items-center gap-0.5 text-white opacity-90"
                                                title={t.wst_grid_shift_frozen_short}
                                              >
                                                <Check className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={3} />
                                                <Lock className="h-2.5 w-2.5 flex-shrink-0" strokeWidth={2.5} />
                                              </span>
                                            )}
                                          {dayShift.approved_at &&
                                            normalizedApprovalStatus(dayShift.approval_status) !== 'approved' && (
                                              <span
                                                className="absolute bottom-1 left-1/2 z-[1] -translate-x-1/2 text-white opacity-90"
                                                title={t.wst_grid_shift_frozen_short}
                                              >
                                                <Check className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={3} />
                                              </span>
                                            )}
                                          {/* Skills — in basso centrati */}
                                          {dayShift.skills && (
                                            <span
                                              className={`pointer-events-none absolute left-0 right-0 flex flex-wrap justify-center gap-0.5 px-1 ${dayShift.approved_at ? 'bottom-5' : 'bottom-1'}`}
                                            >
                                              {dayShift.skills.split(',').map((sk) => sk.trim()).filter(Boolean).map((sk) => (
                                                <span
                                                  key={sk}
                                                  className={`text-[8px] font-bold px-1 py-0 rounded ${
                                                    dayVariant === 'approved'
                                                      ? 'bg-white/20 text-white/90'
                                                      : dayVariant === 'absent'
                                                        ? 'bg-rose-200/90 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100'
                                                        : dayVariant === 'punchMissing'
                                                          ? 'bg-amber-200/90 text-amber-950 dark:bg-amber-900/45 dark:text-amber-100'
                                                          : dayVariant === 'inprogress'
                                                            ? 'bg-emerald-200/90 text-emerald-900 dark:bg-emerald-900/45 dark:text-emerald-100'
                                                            : 'bg-slate-200 text-slate-600 dark:bg-slate-600/80 dark:text-slate-200'
                                                  }`}
                                                >
                                                  {sk}
                                                </span>
                                              ))}
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </>
                                  );
                                })() : canManageThisUser && (
                                  <div className="flex h-full items-end justify-center pb-1">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setCreatingShift({ userId: user.id, date: dayStr, defaultTime: '10:00' }); }}
                                      className="w-[14px] h-[14px] rounded-xl bg-accent text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent-hover"
                                      title="Aggiungi turno"
                                    >
                                      <Plus className="w-2.5 h-2.5" strokeWidth={2.5} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Slot Inferiore - Turno Serale */}
                              <div
                                onClick={(e) => {
                                  if (eveningShift) {
                                    if (cellEdit?.shiftId === eveningShift.id) return;
                                    if ((e.target as HTMLElement).closest('button')) return;
                                    if (canEditShifts) {
                                      setSelectedShiftIds([eveningShift.id]);
                                      setSidebarDay(dayStr);
                                      setSidebarOpen(true);
                                    }
                                  } else if (canManageThisUser) {
                                    setCreatingShift({ userId: user.id, date: dayStr, defaultTime: '18:00' });
                                  }
                                }}
                                onDoubleClick={(e) => {
                                  if (eveningShift && canEditInApp && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                                    if (!isShiftDraftLike(eveningShift) || isShiftAbsentRecord(eveningShift)) return;
                                    const cur = `${(eveningShift.start_time||'').slice(0,5)}-${(eveningShift.end_time||'').slice(0,5)}`;
                                    setCellEdit({ shiftId: eveningShift.id, value: cur });
                                  }
                                }}
                                onMouseDown={(e) => handleCellMouseDown(e, userIdx, dayIdx, 1)}
                                onMouseEnter={() => handleCellMouseEnter(userIdx, dayIdx, 1)}
                                onDragOver={(e) => { if (draggedShiftId) { e.preventDefault(); setDropTargetKey(`${user.id}_${dayStr}_1`); } }}
                                onDragLeave={() => setDropTargetKey(null)}
                                onDrop={(e) => { e.preventDefault(); if (draggedShiftId) { handleDropShift(draggedShiftId, user.id, dayStr); setDraggedShiftId(null); setDropTargetKey(null); } }}
                                title={eveningShift && needsCambioWarning(eveningShift) ? t.no_change_at_16 : undefined}
                                className={`flex flex-col relative select-none ${hasOverlap ? 'shadow-[0_0_10px_rgba(239,68,68,0.5)]' : ''} ${dropTargetKey === `${user.id}_${dayStr}_1` ? 'bg-amber-100 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-600' : eveningShift ? getCellStyle(eveningShift, selectedShiftIds.includes(eveningShift.id) || isInDragRect(1), selectedShiftIds.length > 0, eveningVariant) : isInDragRect(1) ? 'bg-accent/10 border-2 border-accent' : 'border-transparent'} ${eveningShift ? 'shift-card-hover-group' : ''} ${!eveningShift && canManageThisUser ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800/60' : !eveningShift ? 'cursor-default' : eveningShift && canEditInApp ? 'cursor-pointer hover:ring-2 hover:ring-accent/40 hover:ring-inset' : ''}`}
                              >
                                {eveningShift ? (() => {
                                  const isAbsentEv = isShiftAbsentRecord(eveningShift);
                                  const actualTimes = getActualShiftTime(eveningShift, punchRecords);
                                  const endEv = actualTimes.endTime ? actualTimes.endTime.slice(0, 5) : '___';
                                  const { start: dispS, end: dispE } = getResolvedStartEndForHours(eveningShift, punchRecords);
                                  const timeDisplayed = isAbsentEv
                                    ? t.status_absent
                                    : eveningShift.approved_at && eveningShift.approved_start_time && eveningShift.approved_end_time
                                      ? `${dispS} – ${dispE}`
                                      : `${actualTimes.startTime.slice(0, 5)} – ${endEv}`;
                                  const timeDisplayedShort = isAbsentEv
                                    ? t.status_absent
                                    : eveningShift.approved_at && eveningShift.approved_start_time && eveningShift.approved_end_time
                                      ? `${toShortTime(dispS)}–${toShortTime(dispE)}`
                                      : `${toShortTime(actualTimes.startTime)}–${toShortTime(endEv)}`;
                                  const evTimeTextCls =
                                    eveningVariant === 'approved'
                                      ? 'text-white'
                                      : eveningVariant === 'absent'
                                        ? 'text-rose-950 dark:text-rose-50'
                                        : eveningVariant === 'planned'
                                          ? 'text-slate-900 dark:text-white'
                                          : eveningVariant === 'punchMissing'
                                            ? 'text-amber-950 dark:text-amber-100'
                                            : eveningVariant === 'inprogress'
                                              ? 'text-emerald-900 dark:text-emerald-50'
                                              : 'text-slate-900 dark:text-white';
                                  const approvalEvNorm = normalizedApprovalStatus(eveningShift.approval_status);
                                  const showPublishedBarEv =
                                    !isAbsentEv &&
                                    !isShiftPayrollFrozen(eveningShift) &&
                                    (approvalEvNorm === 'confirmed' || approvalEvNorm === 'approved');
                                  const delayMinsEv = getPunchDelayMinutes(eveningShift, punchRecords);
                                  const showLateBarEv = !isAbsentEv && delayMinsEv != null && delayMinsEv > 0;
                                  const showPunchMissingBarEv = !isAbsentEv && eveningVariant === 'punchMissing';
                                  return (
                                    <>
                                      {/* Barra sinistra: turno pubblicato (tabellone) */}
                                      {showPublishedBarEv && (
                                        <span
                                          className={`absolute left-1.5 top-1/2 z-[1] -translate-y-1/2 ${shiftCardStatusPillClass} bg-emerald-600 dark:bg-emerald-500`}
                                          title={t.wst_filter_published}
                                          aria-hidden
                                        />
                                      )}
                                      {/* Inline edit input */}
                                      {canEditInApp && cellEdit?.shiftId === eveningShift.id ? (
                                        <input
                                          value={cellEdit.value}
                                          onChange={(e) => setCellEdit({ shiftId: eveningShift.id, value: e.target.value })}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') { e.preventDefault(); handleCellEditSave(eveningShift.id, cellEdit.value); }
                                            if (e.key === 'Escape') setCellEdit(null);
                                          }}
                                          onBlur={() => handleCellEditSave(eveningShift.id, cellEdit.value)}
                                          onClick={(e) => e.stopPropagation()}
                                          autoFocus
                                          placeholder="19-23"
                                          className="absolute left-1/2 top-1/2 z-10 w-[min(100px,calc(100%-12px))] -translate-x-1/2 -translate-y-1/2 bg-white text-slate-800 text-xs font-bold text-center border-2 border-amber-500 rounded-xl shadow-lg focus:outline-none px-1 py-0.5"
                                        />
                                      ) : (
                                        <>
                                          {/* Orario centrato in cella */}
                                          {canEditInApp ? (
                                            <span
                                              draggable={isShiftDraftLike(eveningShift) && !isAbsentEv}
                                              onDragStart={(e: React.DragEvent) => { e.stopPropagation(); e.dataTransfer.setData('shiftId', eveningShift.id); setDraggedShiftId(eveningShift.id); }}
                                              onDragEnd={() => { setDraggedShiftId(null); setDropTargetKey(null); }}
                                              onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                if (!isShiftDraftLike(eveningShift) || isAbsentEv) return;
                                                const cur = `${(eveningShift.start_time||'').slice(0,5)}-${(eveningShift.end_time||'').slice(0,5)}`;
                                                setCellEdit({ shiftId: eveningShift.id, value: cur });
                                              }}
                                              className={`absolute inset-0 z-0 flex items-center justify-center px-2 cursor-text ${shakeBadgeId === eveningShift.id ? 'animate-shake' : ''}`}
                                              style={{ opacity: 1 }}
                                              title="Doppio click: modifica"
                                            >
                                              <span className="flex max-w-full min-w-0 items-center justify-center gap-1.5">
                                                <span className="min-w-0 text-center font-bold leading-none">
                                                  <span className={`max-w-full truncate text-xs hidden sm:block ${evTimeTextCls}`}>{timeDisplayed}</span>
                                                  <span className={`max-w-full truncate text-[11px] block sm:hidden ${evTimeTextCls}`}>{timeDisplayedShort}</span>
                                                </span>
                                                {showPunchMissingBarEv && (
                                                  <span
                                                    className={`${shiftCardStatusPillClass} bg-amber-400 dark:bg-amber-500`}
                                                    title={t.ts_status_unpunched}
                                                    aria-hidden
                                                  />
                                                )}
                                                {showLateBarEv && (
                                                  <span
                                                    className={`${shiftCardStatusPillClass} bg-red-500 dark:bg-red-400`}
                                                    title={t.ts_status_late}
                                                    aria-hidden
                                                  />
                                                )}
                                              </span>
                                            </span>
                                          ) : (
                                            <span className="absolute inset-0 z-0 flex items-center justify-center px-2">
                                              <span className="flex max-w-full min-w-0 items-center justify-center gap-1.5">
                                                <span className="min-w-0 text-center font-bold leading-none">
                                                  <span className={`max-w-full truncate text-xs hidden sm:block ${evTimeTextCls}`}>{timeDisplayed}</span>
                                                  <span className={`max-w-full truncate text-[11px] block sm:hidden ${evTimeTextCls}`}>{timeDisplayedShort}</span>
                                                </span>
                                                {showPunchMissingBarEv && (
                                                  <span
                                                    className={`${shiftCardStatusPillClass} bg-amber-400 dark:bg-amber-500`}
                                                    title={t.ts_status_unpunched}
                                                    aria-hidden
                                                  />
                                                )}
                                                {showLateBarEv && (
                                                  <span
                                                    className={`${shiftCardStatusPillClass} bg-red-500 dark:bg-red-400`}
                                                    title={t.ts_status_late}
                                                    aria-hidden
                                                  />
                                                )}
                                              </span>
                                            </span>
                                          )}
                                          {eveningShift.approved_at &&
                                            normalizedApprovalStatus(eveningShift.approval_status) === 'approved' && (
                                              <span
                                                className="absolute bottom-1 left-1 z-[1] flex items-center gap-0.5 text-white opacity-90"
                                                title={t.wst_grid_shift_frozen_short}
                                              >
                                                <Check className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={3} />
                                                <Lock className="h-2.5 w-2.5 flex-shrink-0" strokeWidth={2.5} />
                                              </span>
                                            )}
                                          {eveningShift.approved_at &&
                                            normalizedApprovalStatus(eveningShift.approval_status) !== 'approved' && (
                                              <span
                                                className="absolute bottom-1 left-1/2 z-[1] -translate-x-1/2 text-white opacity-90"
                                                title={t.wst_grid_shift_frozen_short}
                                              >
                                                <Check className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={3} />
                                              </span>
                                            )}
                                        </>
                                      )}
                                    </>
                                  );
                                })() : canManageThisUser && (
                                  <div className="flex h-full items-end justify-center pb-1">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setCreatingShift({ userId: user.id, date: dayStr, defaultTime: '18:00' }); }}
                                      className="w-[14px] h-[14px] rounded-xl bg-accent text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent-hover"
                                      title="Aggiungi turno serale"
                                    >
                                      <Plus className="w-2.5 h-2.5" strokeWidth={2.5} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>{/* chiude relative grid grid-rows-2 */}
                          </td>
                        );
                      })}
                        </tr>
                      </tbody>
                    </table>
                    </div>
                  </motion.div>
                );
              }) )}

          {/* ── Riga footer Totale ore per giorno ── */}
          {viewMode !== 'month' && canViewTotalHours && (
            <div
              ref={footerTotalsScrollRef}
              onScroll={(e) => syncScrollLeft(e.currentTarget)}
              className="w-full overflow-x-auto-safe smooth-touch overscroll-x-contain touch-manipulation snap-x snap-proximity -mx-0.5 px-0.5"
            >
              <table className={`table-fixed border-collapse ${allWeekDays.length === 1 ? 'w-[33.33%]' : allWeekDays.length === 14 ? 'w-[466.67%]' : 'w-[233.33%]'} sm:w-full`}>
                <colgroup>
                  {allWeekDays.map((_, i) => <col key={i} className="w-[14.28%]" />)}
                </colgroup>
                <tbody>
                  <tr className="bg-white dark:bg-neutral-900 border-t border-accent/20">
                    {allWeekDays.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const mins = dailyMinutesByDate[dateStr] ?? 0;
                      return (
                        <td key={dateStr} className="border border-slate-100 dark:border-white/10 bg-white dark:bg-neutral-900 px-1 py-1 text-center snap-start">
                          {mins > 0 ? (
                            <span className="text-[10px] font-bold text-accent tabular-nums">
                              {formatMinutesToHoursAndMinutes(mins)}
                            </span>
                          ) : (
                            <span className="text-[9px] text-accent/35 tabular-nums">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Turni aperti: sotto la griglia / footer ore, nel flusso del main (non più fixed sopra bottom nav) */}
          {viewMode !== 'month' && (openVisibleShifts.length > 0 || canEditInApp) && (
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.06, duration: 0.22 }}
              className="pointer-events-auto relative z-10 mt-1 flex w-full max-w-full shrink-0 flex-col overflow-hidden rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/95 backdrop-blur-sm dark:border-amber-600/60 dark:bg-amber-950/90 max-h-[min(42vh,320px)] min-h-0 shadow-[0_4px_16px_-4px_rgba(45,90,39,0.14),0_2px_8px_-4px_rgba(15,23,42,0.08)] dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4),0_2px_8px_-4px_rgba(0,0,0,0.25)]"
            >
              <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-amber-200 bg-amber-100 px-2 py-0 dark:border-amber-800/50 dark:bg-amber-950/40 sm:px-3">
                <div className="flex min-h-0 min-w-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={toggleOpenShiftsBarCollapsed}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-amber-300/80 bg-amber-50/70 text-amber-800 transition-colors hover:bg-amber-100/80 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/50"
                    aria-expanded={!openShiftsBarCollapsed}
                    aria-label={
                      openShiftsBarCollapsed
                        ? (tv.wst_open_shifts_bar_expand_aria ?? 'Espandi')
                        : (tv.wst_open_shifts_bar_collapse_aria ?? 'Comprimi')
                    }
                  >
                    {openShiftsBarCollapsed ? (
                      <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                    ) : (
                      <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                    )}
                  </button>
                  <span className="flex min-w-0 items-center gap-0.5 text-[10px] font-bold uppercase leading-none text-amber-800 dark:text-amber-100">
                    <Plus className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" aria-hidden />
                    <span className="truncate">{t.open_shifts}</span>
                    {openShiftsBarCollapsed && openVisibleShifts.length > 0 ? (
                      <span className="shrink-0 tabular-nums text-[9px] font-bold normal-case text-amber-700 dark:text-amber-200 sm:text-[10px]">
                        ({openVisibleShifts.length})
                      </span>
                    ) : null}
                  </span>
                </div>
                {canEditInApp && (
                  <button
                    type="button"
                    onClick={() => setCreatingOpenShift({ date: format(weekStart, 'yyyy-MM-dd') })}
                    className="flex h-6 shrink-0 items-center rounded-md border border-amber-300/90 bg-amber-50/60 px-2 text-[9px] font-semibold leading-none text-amber-800 hover:bg-amber-100/70 hover:text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/45 dark:hover:text-amber-50 sm:text-[10px]"
                  >
                    + {t.new_open_shift}
                  </button>
                )}
              </div>
              {!openShiftsBarCollapsed && (
                <div
                  className="min-h-0 flex-1 overflow-y-auto overflow-x-auto-safe smooth-touch overscroll-x-contain touch-manipulation snap-x snap-proximity"
                  ref={(el) => { if (el) cardScrollRefs.current[activeUsers.length] = el; }}
                  onScroll={(e) => syncScrollLeft(e.currentTarget)}
                >
                  <table className="w-[233.33%] sm:w-full table-fixed border-collapse">
                    <colgroup>
                      {allWeekDays.map((_, i) => <col key={i} className="w-[14.28%]" />)}
                    </colgroup>
                    <tbody>
                      <tr>
                        {allWeekDays.map((day) => {
                          const dayStr = format(day, 'yyyy-MM-dd');
                          const dayOpenShifts = openVisibleShifts.filter((s) => s.date === dayStr);
                          const isStaffUser = !isManagement;
                          return (
                            <td key={dayStr} className="border border-slate-100 p-0 h-10 align-top snap-start">
                              <div className="flex h-full flex-col gap-0.5 p-1">
                                {dayOpenShifts.length === 0 && canEditInApp && (
                                  <button
                                    type="button"
                                    onClick={() => setCreatingOpenShift({ date: dayStr })}
                                    className="flex h-full w-full items-center justify-center opacity-0 transition-opacity hover:opacity-100"
                                  >
                                    <Plus className="h-3.5 w-3.5 text-amber-400" />
                                  </button>
                                )}
                                {dayOpenShifts.map((s) => {
                                  const timeLabel = `${s.start_time.slice(0,5)}–${(s.end_time||'?').slice(0,5)}`;
                                  const publicNote = getOpenShiftPublicNote(s);
                                  const requested = isRequestedShift(s);
                                  const requester = getRequester(s);
                                  const alreadyRequestedByMe = requester?.id === currentUser?.id;
                                  const badgeBg = requested ? 'bg-orange-300 border border-orange-400' : 'bg-amber-200';
                                  const badgeText = requested ? 'text-orange-900' : 'text-amber-900';
                                  return (
                                    <div key={s.id} className={`relative group flex flex-col gap-0.5 rounded-xl px-1.5 py-1 text-[10px] font-semibold ${badgeBg} ${badgeText}`}>
                                      <div className="flex items-center gap-1">
                                        <span className="flex-1 truncate font-bold">{timeLabel}</span>
                                        {publicNote && <span title={publicNote}><MessageSquare className="h-2.5 w-2.5 flex-shrink-0" /></span>}
                                        {canEditInApp && (
                                          <button
                                            type="button"
                                            onClick={() => deleteShifts([s.id])}
                                            className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                          >
                                            <X className="h-2 w-2" />
                                          </button>
                                        )}
                                      </div>
                                      {isManagement && requested && requester && (
                                        <div className="flex flex-col gap-0.5">
                                          <span className="truncate text-[9px] font-semibold">
                                            👤 {requester.name}
                                          </span>
                                          <div className="flex gap-0.5">
                                            <button
                                              type="button"
                                              onClick={() => handleApproveOpenShift(s.id)}
                                              className="flex flex-1 items-center justify-center gap-0.5 rounded-xl bg-accent px-1 py-0.5 text-[9px] font-bold leading-none text-white transition-colors hover:bg-accent-hover"
                                              title={`Approva: assegna a ${requester.name}`}
                                            >
                                              <UserCheck className="h-2.5 w-2.5" />
                                              Approva
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleRejectOpenShift(s.id)}
                                              className="flex flex-1 items-center justify-center rounded-xl bg-red-100 px-1 py-0.5 text-[9px] font-bold leading-none text-red-700 transition-colors hover:bg-red-200"
                                              title="Rifiuta richiesta"
                                            >
                                              <UserX className="h-2.5 w-2.5" />
                                              Rifiuta
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                      {isManagement && !requested && (
                                        <span className="text-[9px] font-medium text-amber-700">Aperto</span>
                                      )}
                                      {isStaffUser && !alreadyRequestedByMe && !requested && (
                                        <button
                                          type="button"
                                          onClick={() => handleClaimOpenShift(s.id)}
                                          className="w-full rounded-xl bg-accent px-1 py-0.5 text-center text-[9px] font-bold leading-none text-white transition-colors hover:bg-accent-hover"
                                        >
                                          Richiedi
                                        </button>
                                      )}
                                      {isStaffUser && alreadyRequestedByMe && (
                                        <span className="block text-center text-[9px] font-semibold text-orange-800">
                                          In attesa…
                                        </span>
                                      )}
                                      {isStaffUser && requested && !alreadyRequestedByMe && (
                                        <span className="block text-center text-[9px] font-semibold text-orange-700">
                                          Già richiesto
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
      </div>
      )}
      </>
      )}
      </motion.div>

      {/* ── Popup dettaglio turno (centrato) ── */}
      <CenteredModalPortal
        open={canEditShifts && sidebarOpen && !!sidebarDay}
        onClose={closeShiftDetailPanel}
        panelRef={shiftDetailModalPanelRef}
        maxWidthClass="max-w-sm"
        maxHeightClass="max-h-[min(92dvh,820px)]"
        overlayZClass="z-[10050]"
        ariaLabel={t.edit_shift}
        panelClassName="!overflow-hidden flex flex-col p-0"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* ─── HEADER ─────────────────────────────────────────────── */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const d = parseISO(sidebarDay);
                  setSidebarDay(format(addDays(d, -1), 'yyyy-MM-dd'));
                  setDrawerDeleteConfirm(null);
                }}
                className="rounded-xl p-2 transition-colors hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4 text-slate-500 dark:text-neutral-300" />
              </button>
              <span className="text-sm font-bold text-slate-800 dark:text-white">
                {safeFormatDate(sidebarDay, 'EEE d MMM', { locale: getDateLocale(effectiveLanguage) ?? it })}
              </span>
              <button
                type="button"
                onClick={() => {
                  const d = parseISO(sidebarDay);
                  setSidebarDay(format(addDays(d, 1), 'yyyy-MM-dd'));
                  setDrawerDeleteConfirm(null);
                }}
                className="rounded-xl p-2 transition-colors hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <ChevronRight className="h-4 w-4 text-slate-500 dark:text-neutral-300" />
              </button>
            </div>
            <button type="button" onClick={closeShiftDetailPanel} className="rounded-xl p-2 transition-colors hover:bg-slate-100 dark:hover:bg-white/10">
              <X className="h-5 w-5 text-slate-500 dark:text-neutral-300" />
            </button>
          </div>

          {/* ─── BODY ───────────────────────────────────────────────── */}
          {(() => {
                const allDayShifts = visibleShifts
                  .filter((s) => s.date === sidebarDay)
                  .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
                const selectedDayIds = selectedShiftIds.filter((id) => allDayShifts.some((s) => s.id === id));
                const dayShifts = selectedDayIds.length > 0
                  ? allDayShifts.filter((s) => selectedDayIds.includes(s.id))
                  : allDayShifts;

                // ── SINGLE SHIFT: new redesigned view ──────────────────
                if (dayShifts.length === 1) {
                  const shift = dayShifts[0];
                  const u = users.find((usr) => usr.id === shift.user_id);
                  const drawerRoleShort = scheduleDrawerRoleLabel(u?.role);
                  const edits = sidebarEdits[shift.id] ?? {
                    start: (shift.start_time || '').slice(0, 5),
                    end: (shift.end_time || '').slice(0, 5),
                    deduct_break: shift.deduct_break !== false,
                  };
                  const isFrozen = isShiftFrozenRecord(shift);
                  const isDraft = isShiftDraftLike(shift);
                  const isConfirmed = normalizedApprovalStatus(shift.approval_status) === 'confirmed';
                  const isAbsent = isShiftAbsentRecord(shift);
                  const approvalNorm = normalizedApprovalStatus(shift.approval_status);
                  const cannotRevertPublishedToDraft =
                    approvalNorm === 'confirmed' || approvalNorm === 'approved';

                  const updateEdits = (field: 'start' | 'end', val: string) => {
                    const next = { ...edits, [field]: val };
                    setSidebarEdits((prev) => ({ ...prev, [shift.id]: next }));
                  };
                  const deductBreak = edits.deduct_break ?? (shift.deduct_break !== false);
                  const setDeductBreak = (val: boolean) => {
                    setSidebarEdits((prev) => ({ ...prev, [shift.id]: { ...edits, deduct_break: val } }));
                  };

                  const drawerPunchPair = getPunchPairForShift(shift, punchRecords);
                  const drawerTimbrature = computeDrawerTimbratureDisplay(shift, punchRecords, drawerPunchAudits);

                  const stPlanned = (edits.start || '').trim().slice(0, 5);
                  const enPlanned = (edits.end || '').trim().slice(0, 5);
                  const plannedNetMins =
                    stPlanned && enPlanned && stPlanned !== enPlanned
                      ? getNetShiftMinutes(
                          { ...shift, start_time: stPlanned, end_time: enPlanned, deduct_break: deductBreak },
                          stPlanned,
                          enPlanned,
                          u ?? undefined,
                          breakRules,
                          breakComputeOpts
                        )
                      : null;

                  let actualNetMins: number | null = null;
                  let actualNeedsPunches = false;
                  if (isFrozen && shift.approved_start_time && shift.approved_end_time) {
                    const fs = (shift.approved_start_time || '').slice(0, 5);
                    const fe = (shift.approved_end_time || '').slice(0, 5);
                    if (fs && fe) {
                      actualNetMins = getNetShiftMinutes(shift, fs, fe, u ?? undefined, breakRules, breakComputeOpts);
                    }
                  } else {
                    const pair = drawerPunchPair;
                    let aS: string | null = null;
                    let aE: string | null = null;
                    if (pair.actualStart && pair.actualEnd) {
                      aS = pair.actualStart;
                      aE = pair.actualEnd;
                    } else if (pair.actualStart && pair.plannedEnd) {
                      aS = pair.actualStart;
                      aE = pair.plannedEnd;
                    }
                    if (aS && aE) {
                      actualNetMins = getNetShiftMinutes(
                        { ...shift, deduct_break: deductBreak, start_time: aS, end_time: aE },
                        aS,
                        aE,
                        u ?? undefined,
                        breakRules,
                        breakComputeOpts
                      );
                    } else {
                      actualNeedsPunches = true;
                    }
                  }
                  if (isAbsent) {
                    actualNetMins = 0;
                    actualNeedsPunches = false;
                  }

                  return (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      {/* Scrollable content */}
                      <div className="min-h-0 flex-1 overflow-y-auto space-y-5 px-4 py-4">

                        {/* ── User badge ─────────────────────────────── */}
                        <div className="flex items-center gap-3">
                          <div className="flex min-h-[40px] min-w-[40px] max-w-[88px] flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-100 bg-slate-50 px-1.5 dark:border-white/10 dark:bg-neutral-800">
                            <span className="select-none text-[14px] font-bold leading-none text-slate-700 dark:text-neutral-200">
                              {(u?.first_name ?? '?')[0]}
                            </span>
                            {drawerRoleShort ? (
                              <span className="w-full truncate text-center text-[8px] font-semibold uppercase leading-tight text-slate-500 dark:text-neutral-300">
                                {drawerRoleShort}
                              </span>
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold leading-none text-slate-800 dark:text-white">
                              {u?.first_name} {u?.last_name}
                            </p>
                            <p className="mt-0.5 text-[11px] capitalize text-slate-500 dark:text-neutral-400">{u?.role}</p>
                          </div>
                          <div className="ml-auto flex shrink-0 items-center gap-1">
                          {isFrozen && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-full">
                              <Lock className="w-3 h-3" /> {t.wst_grid_shift_frozen_short}
                            </span>
                          )}
                          {isAbsent && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-full dark:bg-rose-950/50 dark:text-rose-100 dark:border-rose-800/60">
                              <UserX className="w-3 h-3" /> {t.status_absent}
                            </span>
                          )}
                          </div>
                        </div>

                        {isAbsent && (
                          <div className="rounded-xl border border-rose-200/90 bg-rose-50/90 px-3 py-2.5 dark:border-rose-800/50 dark:bg-rose-950/35">
                            <p className="text-xs font-medium text-rose-900 dark:text-rose-100">{t.wst_status_sub_absent}</p>
                            <p className="mt-2 text-[11px] font-medium text-rose-800/90 dark:text-rose-200/90">{t.wst_absent_manage_in_timesheets}</p>
                          </div>
                        )}

                        {/* ── ORARI ──────────────────────────────────── */}
                        <div className="relative z-10 touch-manipulation">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-widest mb-3">{tv.wst_drawer_times_section}</p>
                          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-2 gap-y-1.5 sm:gap-x-3">
                            <div className="col-start-1 row-start-1">
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">{t.start_time}</p>
                            </div>
                            <div className="col-start-3 row-start-1">
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">{t.end_time}</p>
                            </div>
                            <div className="col-start-1 row-start-2 min-w-0">
                              <TimeInputField
                                size="lg"
                                disabled={isFrozen || isAbsent || !isDraft}
                                value={edits.start}
                                onChange={(next) => updateEdits('start', next)}
                                aria-label={t.start_time}
                                className="w-full max-w-full disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 dark:disabled:bg-neutral-900"
                              />
                            </div>
                            <div
                              className="col-start-2 row-start-2 flex min-h-[52px] items-center justify-center self-stretch text-xl font-bold leading-none text-slate-300 dark:text-neutral-500"
                              aria-hidden
                            >
                              –
                            </div>
                            <div className="col-start-3 row-start-2 min-w-0">
                              <TimeInputField
                                size="lg"
                                disabled={isFrozen || isAbsent || !isDraft}
                                value={edits.end}
                                onChange={(next) => updateEdits('end', next)}
                                aria-label={t.end_time}
                                className="w-full max-w-full disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 dark:disabled:bg-neutral-900"
                              />
                            </div>
                          </div>
                          {isFrozen && shift.approved_start_time && shift.approved_end_time && (
                            <p className="text-[11px] text-accent font-semibold mt-2">
                              Ore congelate: {(shift.approved_start_time || '').slice(0, 5)} –{' '}
                              {(shift.approved_end_time || '').slice(0, 5)}
                            </p>
                          )}
                        </div>

                        {/* ── Pausa: solo testo (in bozza: link per alternare) ── */}
                        {!isFrozen && !isAbsent && (
                          <div className="py-1">
                            <p className="text-xs font-medium leading-snug text-slate-600 dark:text-neutral-300">
                              {deductBreak ? t.wst_drawer_break_deducted_readout : t.wst_create_shift_no_deduct_badge}
                              {isDraft && (
                                <>
                                  {' '}
                                  <button
                                    type="button"
                                    onClick={() => setDeductBreak(!deductBreak)}
                                    className="font-semibold text-accent underline-offset-2 hover:underline dark:text-accent-light"
                                  >
                                    {t.wst_drawer_break_toggle}
                                  </button>
                                </>
                              )}
                            </p>
                          </div>
                        )}

                        {/* ── TIMBRATURE (sola lettura; modifiche in Scheda presenze) ── */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 dark:border-white/10 dark:bg-neutral-800/80">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-widest mb-2">{t.wst_punches_section_title}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-neutral-300">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                                {t.wst_punch_in_label}
                              </p>
                              <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-neutral-100">{drawerTimbrature.inTime}</p>
                              {drawerTimbrature.inMode === 'device' ? (
                                <p className="mt-0.5 text-[10px] font-medium leading-snug text-slate-500 dark:text-neutral-400">{t.wst_punch_mode_device}</p>
                              ) : drawerTimbrature.inMode === 'manual' ? (
                                <p className="mt-0.5 text-[10px] font-medium leading-snug text-slate-500 dark:text-neutral-400">{t.wst_punch_mode_manual}</p>
                              ) : drawerTimbrature.inMode === 'frozen' ? (
                                <p className="mt-0.5 text-[10px] font-medium leading-snug text-accent">{t.wst_punch_mode_frozen}</p>
                              ) : null}
                            </div>
                            <div>
                              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-neutral-300">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden />
                                {t.wst_punch_out_label}
                              </p>
                              <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-neutral-100">{drawerTimbrature.outTime}</p>
                              {drawerTimbrature.outMode === 'device' ? (
                                <p className="mt-0.5 text-[10px] font-medium leading-snug text-slate-500 dark:text-neutral-400">{t.wst_punch_mode_device}</p>
                              ) : drawerTimbrature.outMode === 'manual' ? (
                                <p className="mt-0.5 text-[10px] font-medium leading-snug text-slate-500 dark:text-neutral-400">{t.wst_punch_mode_manual}</p>
                              ) : drawerTimbrature.outMode === 'frozen' ? (
                                <p className="mt-0.5 text-[10px] font-medium leading-snug text-accent">{t.wst_punch_mode_frozen}</p>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 dark:border-white/10 dark:bg-neutral-800/80">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">{t.wst_drawer_hours_summary}</p>
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 text-[11px] font-medium leading-snug text-slate-600 dark:text-neutral-300">{t.wst_drawer_planned_short}</span>
                            <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-neutral-100">
                              {plannedNetMins != null ? formatMinutesToHoursAndMinutes(plannedNetMins) : '—'}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3">
                            <span className="min-w-0 pt-0.5 text-[11px] font-medium leading-snug text-slate-600 dark:text-neutral-300">{t.wst_drawer_actual_short}</span>
                            <div className="text-sm font-bold text-accent tabular-nums shrink-0 text-right max-w-[55%]">
                              {isAbsent ? (
                                <span className="text-rose-700 dark:text-rose-200">{formatMinutesToHoursAndMinutes(0)}</span>
                              ) : actualNetMins != null ? (
                                formatMinutesToHoursAndMinutes(actualNetMins)
                              ) : actualNeedsPunches && !isFrozen ? (
                                <span className="block leading-tight">
                                  <span className="block">{t.wst_drawer_actual_incomplete}</span>
                                  <span className="block text-[10px] font-semibold text-slate-500 dark:text-neutral-300 mt-0.5">{t.wst_drawer_actual_hint}</span>
                                </span>
                              ) : (
                                t.wst_drawer_actual_incomplete
                              )}
                            </div>
                          </div>
                        </div>

                        {/* ── STATO: bozza ↔ pubblicato (solo tabellone) ─── */}
                        {!isFrozen && !isAbsent && (canManageDrafts || canApproveShifts) && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-widest mb-2">{t.filter_status}</p>
                            <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-neutral-800/90">
                              {[
                                { st: 'draft' as const, label: t.status_draft, cls: 'text-slate-600 dark:text-neutral-300', need: 'draft' as const },
                                {
                                  st: 'confirmed' as const,
                                  label: t.wst_filter_published,
                                  cls: 'text-accent dark:text-accent-light',
                                  need: 'publish' as const,
                                },
                              ].map(({ st, label, cls, need }) => {
                                const active = (st === 'confirmed' && isConfirmed) || (st === 'draft' && isDraft);
                                const canClick = need === 'draft' ? canManageDrafts : canApproveShifts;
                                const cannotSetDraft = st === 'draft' && cannotRevertPublishedToDraft;
                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    disabled={!canClick || cannotSetDraft}
                                    onClick={async () => {
                                      if (active || !canClick || cannotSetDraft) return;
                                      if (st === 'draft') { updateShift(shift.id, { approval_status: 'draft' }); showSuccess?.(t.shift_status_toast_draft); }
                                      else if (st === 'confirmed') { updateShift(shift.id, { approval_status: 'confirmed' }); showSuccess?.(t.shift_status_toast_published); }
                                    }}
                                    className={`min-h-[36px] flex-1 rounded-md px-2 py-1.5 text-center text-[13px] font-semibold leading-none transition-colors ${
                                      active
                                        ? 'border border-slate-200/90 bg-slate-50/80 shadow-sm dark:border-white/12 dark:bg-neutral-800/60 ' + cls
                                        : canClick
                                          ? 'text-slate-400 hover:bg-slate-50/70 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-white/[0.06] dark:hover:text-neutral-200'
                                          : 'cursor-not-allowed text-slate-300 opacity-60 dark:text-neutral-600'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {isFrozen && (
                          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300">
                            {t.wst_frozen_manage_in_timesheets}
                          </p>
                        )}
                      </div>

                      {/* ── FOOTER ──────────────────────────────────── */}
                      <div className="flex-shrink-0 space-y-2 border-t border-slate-100 px-4 py-3 dark:border-white/10">
                        {!isFrozen && !isAbsent && isConfirmed && !isDraft && (
                          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-300">
                            {t.wst_schedule_readonly_after_publish}
                          </p>
                        )}
                        {!isFrozen && !isAbsent && isDraft && (
                          <button
                            type="button"
                            disabled={drawerSaving}
                            onClick={() => void handleDrawerSave(shift.id)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                          >
                            {drawerSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={3} />}
                            {t.wst_save_changes_btn}
                          </button>
                        )}
                        {/* Elimina: solo bozze; pubblicati / approvati no (vedi deleteShifts) */}
                        {!isFrozen && isDraft &&
                          (drawerDeleteConfirm === shift.id ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setDrawerDeleteConfirm(null)}
                                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                              >
                                {t.cancel}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  deleteShifts([shift.id]);
                                  showSuccess?.(t.shift_deleted);
                                  closeShiftDetailPanel();
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors"
                              >
                                {t.wst_confirm_delete_btn}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDrawerDeleteConfirm(shift.id)}
                              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/35 dark:text-red-300 dark:hover:bg-red-950/50"
                            >
                              <Trash2 className="w-4 h-4" /> {t.delete_shift}
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                }

                // ── MULTI-SHIFT: bulk edit (existing behaviour) ─────────
                const bulkStatusLabels: Record<string, string> = {
                  draft: t.status_draft,
                  confirmed: t.wst_filter_published,
                  approved: t.wst_status_soft_approve_label,
                  absent: t.status_absent,
                };
                const drawerCardStatusLabel = (st: Shift['approval_status']) =>
                  bulkStatusLabels[st] ?? st;
                const bulkStatusSegments: { key: '' | 'draft' | 'confirmed'; label: string; activeCls: string }[] = [
                  { key: '', label: 'Invariato', activeCls: 'text-slate-800 dark:text-neutral-100' },
                  { key: 'draft', label: bulkStatusLabels.draft, activeCls: 'text-slate-600 dark:text-neutral-300' },
                  { key: 'confirmed', label: bulkStatusLabels.confirmed, activeCls: 'text-accent dark:text-accent-light' },
                ];
                const bulkHasDraftTarget = selectedShiftIds.some((id) => {
                  const sh = shifts.find((s) => s.id === id);
                  return sh ? isShiftDraftLike(sh) : false;
                });
                return (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
                    {selectedShiftIds.length > 1 && (
                      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 dark:border-white/10 dark:bg-neutral-800/80">
                        <div>
                          <p className="text-sm font-bold leading-snug text-slate-800 dark:text-white">
                            {formatTrans(t.wst_bulk_apply_title, { n: selectedShiftIds.length })}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-neutral-400">{t.wst_bulk_empty_fields_hint}</p>
                        </div>
                        <div>
                          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">{tv.wst_drawer_times_section}</p>
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">{t.start_time}</p>
                              <TimeInputField
                                size="lg"
                                disabled={!bulkHasDraftTarget}
                                value={bulkEditStart}
                                onChange={setBulkEditStart}
                                aria-label={t.start_time}
                                className="w-full"
                              />
                            </div>
                            <div className="pt-10 text-lg font-bold text-slate-300 dark:text-neutral-500">–</div>
                            <div className="min-w-0 flex-1">
                              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">{t.end_time}</p>
                              <TimeInputField
                                size="lg"
                                disabled={!bulkHasDraftTarget}
                                value={bulkEditEnd}
                                onChange={setBulkEditEnd}
                                aria-label={t.end_time}
                                className="w-full"
                              />
                            </div>
                          </div>
                        </div>
                        {canManageDrafts && (
                          <div>
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-400">{t.filter_status}</p>
                            <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-neutral-800/90">
                              {bulkStatusSegments.map(({ key, label, activeCls }) => {
                                const active = bulkEditStatus === key;
                                return (
                                  <button
                                    key={key === '' ? 'unchanged' : key}
                                    type="button"
                                    onClick={() => setBulkEditStatus(key)}
                                    className={`min-h-[36px] min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-center text-[11px] font-semibold leading-tight transition-colors sm:px-2 sm:text-[13px] ${
                                      active
                                        ? `border border-slate-200/90 bg-slate-50/80 shadow-sm dark:border-white/12 dark:bg-neutral-800/60 ${activeCls}`
                                        : 'text-slate-400 hover:bg-slate-50/70 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-white/[0.06] dark:hover:text-neutral-200'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={
                            bulkSaving ||
                            (!bulkEditStart && !bulkEditEnd && !bulkEditStatus) ||
                            ((!!bulkEditStart || !!bulkEditEnd) && !bulkHasDraftTarget)
                          }
                          onClick={async () => {
                            setBulkSaving(true);
                            try {
                              const updates: Partial<import('../types').Shift> = {};
                              if (bulkEditStart) updates.start_time = bulkEditStart;
                              if (bulkEditEnd) updates.end_time = bulkEditEnd;
                              if (bulkEditStatus) updates.approval_status = bulkEditStatus as import('../types').ApprovalStatus;
                              if (bulkEditStart || bulkEditEnd) {
                                for (const id of selectedShiftIds) {
                                  const sh = shifts.find((s) => s.id === id);
                                  if (!sh || !isShiftDraftLike(sh)) continue;
                                  const others = shifts.filter((s) => s.id !== id && s.user_id === sh.user_id && s.date === sh.date);
                                  const newStart = updates.start_time ?? sh.start_time;
                                  const newEnd = updates.end_time ?? sh.end_time ?? '';
                                  if (hasShiftConflictSameDay(others, { start_time: newStart, end_time: newEnd })) {
                                    showError?.(
                                      formatTrans(t.time_conflict_for_employee, {
                                        name: users.find((u) => u.id === sh.user_id)?.first_name ?? t.wst_employee_fallback,
                                        date: sh.date,
                                      })
                                    );
                                    setBulkSaving(false);
                                    return;
                                  }
                                }
                              }
                              await Promise.all(
                                selectedShiftIds.map((id) => {
                                  const sh = shifts.find((s) => s.id === id);
                                  if (!sh) return Promise.resolve();
                                  const patch: Partial<import('../types').Shift> = {};
                                  if (bulkEditStatus) patch.approval_status = bulkEditStatus as import('../types').ApprovalStatus;
                                  if ((bulkEditStart || bulkEditEnd) && isShiftDraftLike(sh)) {
                                    if (bulkEditStart) patch.start_time = bulkEditStart;
                                    if (bulkEditEnd) patch.end_time = bulkEditEnd;
                                  }
                                  if (Object.keys(patch).length === 0) return Promise.resolve();
                                  return updateShift(id, patch);
                                })
                              );
                              showSuccess?.(formatTrans(t.bulk_shifts_updated, { n: selectedShiftIds.length }));
                              setBulkEditStart(''); setBulkEditEnd(''); setBulkEditStatus('');
                              closeShiftDetailPanel();
                            } finally { setBulkSaving(false); }
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                        >
                          {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={3} />}
                          {formatTrans(t.wst_bulk_apply_title, { n: selectedShiftIds.length })}
                        </button>
                      </div>
                    )}
                    {dayShifts.length === 0 ? (
                      <p className="text-slate-500 dark:text-neutral-300 text-sm py-2">{t.no_shifts_scheduled}</p>
                    ) : dayShifts.map((shift) => {
                      const u = users.find((usr) => usr.id === shift.user_id);
                      const edits = sidebarEdits[shift.id] ?? { start: (shift.start_time || '').slice(0, 5), end: (shift.end_time || '').slice(0, 5) };
                      const rowDraft = isShiftDraftLike(shift);
                      return (
                        <div key={shift.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 dark:border-white/10 dark:bg-neutral-800/80">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-slate-800 dark:text-white">{u?.first_name ?? '-'}</p>
                            <span className="shrink-0 text-[11px] font-semibold text-slate-500 dark:text-neutral-400">{drawerCardStatusLabel(shift.approval_status)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TimeInputField
                              size="lg"
                              disabled={!rowDraft}
                              value={edits.start}
                              onChange={(next) =>
                                setSidebarEdits((prev) => ({ ...prev, [shift.id]: { ...edits, start: next } }))
                              }
                              aria-label={t.start_time}
                              className="min-w-0 flex-1"
                            />
                            <span className="shrink-0 text-slate-300 dark:text-neutral-500">–</span>
                            <TimeInputField
                              size="lg"
                              disabled={!rowDraft}
                              value={edits.end}
                              onChange={(next) =>
                                setSidebarEdits((prev) => ({ ...prev, [shift.id]: { ...edits, end: next } }))
                              }
                              aria-label={t.end_time}
                              className="min-w-0 flex-1"
                            />
                          </div>
                        </div>
                      );
                    })}
                    </div>
                    {dayShifts.length > 1 && dayShifts.some((s) => isShiftDraftLike(s)) && (
                      <div className="flex-shrink-0 space-y-2 border-t border-slate-100 px-4 py-3 dark:border-white/10">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void (!canEditInApp && canApproveShifts ? handleSidebarPublishDay() : handleSidebarSave())
                            }
                            disabled={sidebarSaving}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                          >
                            {sidebarSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={3} />}
                            {!canEditInApp && canApproveShifts ? t.wst_publish_day_btn : t.save_all}
                          </button>
                          <button
                            type="button"
                            onClick={closeShiftDetailPanel}
                            className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 dark:border-white/12 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                          >
                            {t.cancel}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
        </div>
      </CenteredModalPortal>

      {creatingShift && (
        <CreateShiftModal
          userId={creatingShift.userId}
          date={creatingShift.date}
          defaultTime={creatingShift.defaultTime}
          existingShifts={shifts.filter((s) => s.user_id === creatingShift.userId && s.date === creatingShift.date)}
          onClose={() => setCreatingShift(null)}
          showError={showError}
          isManagement={isManagement}
        />
      )}

      {creatingOpenShift && currentUser && (
        <CreateShiftModal
          userId={currentUser.id}
          date={creatingOpenShift.date}
          defaultTime=""
          existingShifts={[]}
          onClose={() => setCreatingOpenShift(null)}
          showError={showError}
          isOpenShift
          isManagement={isManagement}
        />
      )}

    </div>
  );
}

interface CreateShiftModalProps {
  userId: string;
  date: string;
  defaultTime: string;
  existingShifts: { id?: string; start_time: string; end_time: string }[];
  showError: (msg: string) => void;
  onClose: () => void;
  isOpenShift?: boolean;
  isManagement?: boolean;
}

function CreateShiftModal({ userId, date, defaultTime, existingShifts, showError, onClose, isOpenShift = false }: CreateShiftModalProps) {
  const { users, addShift, showSuccess, effectiveLanguage, breakRules, featureFlags } = useApp();
  const t = getTranslations(effectiveLanguage);
  const rawDefault = (defaultTime || '').trim().slice(0, 5);
  const defaultHour = rawDefault ? parseInt(rawDefault.split(':')[0], 10) : 10;
  const isEveningDefault = defaultHour >= 16;
  const [tempShifts, setTempShifts] = useState({
    start_time: isEveningDefault ? '18:00' : (rawDefault || '10:00'),
    end_time: isEveningDefault ? '23:00' : '16:00',
  });
  const [selectedDate, setSelectedDate] = useState(date);
  const [deductBreak, setDeductBreak] = useState(true);
  const [notifyEmployee, setNotifyEmployee] = useState(true);
  const [publicNote, setPublicNote] = useState('');
  const [saving, setSaving] = useState(false);

  const user = users.find((u) => u.id === userId);
  const startNormForType = toHHmm(tempShifts.start_time);
  const startHour = startNormForType
    ? parseInt(startNormForType.slice(0, 2), 10) || 0
    : parseInt((tempShifts.start_time || '10:00').split(':')[0], 10) || 10;
  const isOpenEndShift = startHour >= 20;
  const breakOptsModal = useMemo(
    () => ({ autoBreaksFeatureEnabled: featureFlags['auto_breaks'] !== false }),
    [featureFlags]
  );

  /** Durata netta in badge + indicazione detrazione pausa (regole / default 30′ se ≥6h). */
  const { netMins, breakMins } = useMemo(() => {
    const s = toHHmm(tempShifts.start_time);
    const e = isOpenEndShift ? (toHHmm(tempShifts.end_time) || '23:00') : toHHmm(tempShifts.end_time);
    if (!s || !e) return { netMins: 0, breakMins: 0 };
    const syn = {
      deduct_break: deductBreak,
      date: selectedDate,
      start_time: s,
      end_time: e,
      user_id: userId,
    };
    const gross = calculateShiftMinutesGross(s, e);
    const bm = getBreakMinutesForShift(syn, gross, user ?? undefined, breakRules, breakOptsModal);
    const net = getNetShiftMinutes(syn, s, e, user ?? undefined, breakRules, breakOptsModal);
    return { netMins: net, breakMins: bm };
  }, [
    tempShifts.start_time,
    tempShifts.end_time,
    isOpenEndShift,
    deductBreak,
    selectedDate,
    userId,
    user,
    breakRules,
    breakOptsModal,
  ]);

  const handleSave = async () => {
    const startNorm = toHHmm(tempShifts.start_time);
    if (!startNorm) return;
    const effectiveEnd = toHHmm(tempShifts.end_time) || '23:00';
    if (!isOpenEndShift && !effectiveEnd) return;
    if (!isOpenShift && hasShiftConflictSameDay(existingShifts, { start_time: startNorm, end_time: effectiveEnd })) {
      showError(t.shift_conflict_same_day);
      return;
    }
    const startH = parseInt(startNorm.slice(0, 2), 10) || 0;
    const shiftType: 'lunch' | 'dinner' = startH < 17 ? 'lunch' : 'dinner';

    const buildNotes = (pubNote: string) => {
      const base = pubNote.trim();
      if (isOpenShift) return base ? `__OPEN__:${base}` : '__OPEN__';
      return base || undefined;
    };

    /** Tabellone: solo bozza o pubblicato; niente `approved` alla creazione (presenze / congelamento). */
    const status: ApprovalStatus = notifyEmployee ? 'confirmed' : 'draft';

    setSaving(true);
    const payload: Parameters<typeof addShift>[0] = {
      user_id: userId,
      date: selectedDate,
      start_time: startNorm,
      end_time: effectiveEnd,
      type: shiftType,
      approval_status: status,
      notes: buildNotes(publicNote),
      deduct_break: deductBreak,
    };
    await addShift(payload);
    setSaving(false);
    showSuccess?.(t.shift_created);
    onClose();
  };

  const inputClass =
    'w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2.5 font-sans text-sm font-semibold text-slate-800 shadow-sm transition-colors placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 dark:border-white/15 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500';
  const labelClass =
    'mb-1 block font-sans text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/65"
        onClick={onClose}
      >
        <motion.form
          initial={{ scale: 0.92, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 400 }}
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            if (saving) return;
            void handleSave();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
              return;
            }
            if (e.key !== 'Enter' || e.repeat) return;
            if (e.nativeEvent.isComposing) return;
            const tgt = e.target as HTMLElement;
            if (tgt.tagName === 'TEXTAREA') return;
            if (tgt.tagName === 'BUTTON' && (tgt as HTMLButtonElement).type === 'button') return;
            e.preventDefault();
            if (saving) return;
            (e.currentTarget as HTMLFormElement).requestSubmit();
          }}
          className="modal-glass-panel w-full max-w-sm !p-0 overflow-hidden rounded-2xl font-sans"
        >
          {/* ── Header ── */}
          <div
            className={`flex items-start justify-between gap-3 border-b border-slate-200 px-5 pb-4 pt-5 backdrop-blur-md dark:border-white/10 ${
              isOpenShift
                ? 'bg-amber-50/90 dark:bg-amber-950/45'
                : 'bg-white/90 dark:bg-neutral-900/85'
            }`}
          >
            <div className="min-w-0">
              <h2
                className={`font-sans text-base font-bold leading-tight ${
                  isOpenShift ? 'text-amber-800 dark:text-amber-200' : 'text-slate-900 dark:text-neutral-100'
                }`}
              >
                {isOpenShift ? t.open_shift : t.new_shift}
              </h2>
              <p className="mt-0.5 font-sans text-xs text-slate-400 dark:text-neutral-400">
                {!isOpenShift && user && (
                  <>
                    <span className="font-semibold text-slate-600 dark:text-neutral-300">{user.first_name}</span> ·{' '}
                  </>
                )}
                {safeFormatDate(selectedDate, 'EEEE d MMM', { locale: getDateLocale(effectiveLanguage) ?? it })}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <div
                className="flex flex-col items-end gap-0.5 rounded-xl bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-neutral-800 dark:text-neutral-200"
                title={
                  breakMins > 0 && deductBreak
                    ? `−${breakMins} min ${t.ts_break_deduction}`
                    : !deductBreak
                      ? t.wst_create_shift_no_deduct_badge
                      : undefined
                }
              >
                <div className="flex items-center gap-1 text-xs font-bold">
                  <span className="tabular-nums">
                    {netMins > 0 || (toHHmm(tempShifts.start_time) && toHHmm(tempShifts.end_time))
                      ? `${t.wst_create_shift_hours_net} ${formatMinutesToHoursAndMinutes(netMins)}`
                      : '—'}
                  </span>
                </div>
                {deductBreak && breakMins > 0 ? (
                  <span className="text-[9px] font-bold text-slate-500 dark:text-neutral-300 leading-none tabular-nums">
                    −{breakMins}′ {t.ts_break_deduction}
                  </span>
                ) : !deductBreak ? (
                  <span className="text-[9px] font-bold text-amber-700 leading-none max-w-[7rem] text-right">
                    {t.wst_create_shift_no_deduct_badge}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 transition-colors hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
              >
                <X className="h-4 w-4 text-slate-500 dark:text-neutral-300" />
              </button>
            </div>
          </div>

          <div className="space-y-4 bg-white/92 px-5 pb-5 pt-1 backdrop-blur-sm dark:bg-neutral-900/90">
            {/* ── Data ── */}
            <div>
              <label className={labelClass}>Data</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }}
                className={inputClass}
              />
            </div>
            {/* ── Time inputs side by side ── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t.start_time}</label>
                <TimeInputField
                  value={tempShifts.start_time}
                  onChange={(next) => setTempShifts((s) => ({ ...s, start_time: next }))}
                  aria-label={t.start_time}
                  className="w-full font-sans shadow-sm"
                />
              </div>
              <div>
                <label className={labelClass}>{t.end_time}</label>
                {isOpenEndShift ? (
                  <p className="text-slate-400 dark:text-neutral-400 text-xs pt-2.5 font-sans">{t.manual_close_dinner}</p>
                ) : (
                  <TimeInputField
                    value={tempShifts.end_time}
                    onChange={(next) => setTempShifts((s) => ({ ...s, end_time: next }))}
                    aria-label={t.end_time}
                    className="w-full font-sans shadow-sm"
                  />
                )}
              </div>
            </div>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border-2 border-slate-300 bg-slate-50/90 px-3 py-2.5 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/15 dark:bg-neutral-800/90 dark:hover:bg-neutral-800">
              <input
                type="checkbox"
                checked={deductBreak}
                onChange={(e) => setDeductBreak(e.target.checked)}
                className="h-4 w-4 shrink-0 rounded border-2 border-slate-400 text-accent focus:ring-2 focus:ring-accent/30 dark:border-neutral-500"
              />
              <span className="text-sm font-semibold text-slate-700 dark:text-neutral-200">{t.deduct_break_label}</span>
            </label>

            {/* ── Note pubblica ── */}
            <div>
              <label className={labelClass}>{t.notes_label} <span className="font-normal normal-case tracking-normal text-slate-400 dark:text-neutral-400">{t.notes_optional_paren}</span></label>
              <input
                type="text"
                value={publicNote}
                onChange={(e) => setPublicNote(e.target.value)}
                placeholder={t.notes_placeholder_staff}
                className={inputClass}
              />
            </div>

            {/* ── Separator ── */}
            <div className="border-t border-slate-200 dark:border-white/10" />

            {/* ── Avvisa il dipendente (= pubblicato) / altrimenti bozza ── */}
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={notifyEmployee}
                  onChange={(e) => setNotifyEmployee(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="h-5 w-9 rounded-full bg-slate-200 transition-colors peer-checked:bg-accent dark:bg-neutral-700" />
                <div className="toggle-knob absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight text-slate-700 dark:text-neutral-200">Avvisa il dipendente</p>
                <p className="text-xs text-slate-400 dark:text-neutral-400 mt-0.5">{t.shift_visible_after_publish}</p>
              </div>
            </label>

            {/* ── Footer buttons ── */}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm transition-colors font-sans flex items-center justify-center gap-2 ${isOpenShift ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-accent hover:bg-accent-hover text-white'} disabled:opacity-60`}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {t.create_shift}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-100 px-4 py-3 font-sans text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  );
}
