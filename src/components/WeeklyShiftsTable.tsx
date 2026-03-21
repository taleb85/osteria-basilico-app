import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, type RefObject } from 'react';
import { format, startOfWeek, startOfMonth, addDays, addMonths, parseISO, isToday, eachDayOfInterval, getDay } from 'date-fns';
import { database } from '../lib/database';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, Check, Cloud, Loader2, MessageSquare, Pencil, Clock, Trash2, ChevronDown, Copy, Download, Info, EyeOff, Eye, History, Filter, UserCheck, UserX, FileEdit, Lock, MoreHorizontal } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useMinViewportMd } from '../hooks/useMinViewportMd';
import { Shift, type ApprovalStatus } from '../types';
import { calculateShiftMinutesGross, getActualShiftTime, formatMinutesToHoursAndMinutes, roundToNext5Minutes, hasShiftConflictSameDay } from '../utils/timeCalculations';
import { getTranslations, getDateLocale, getIntlLocale, formatTrans } from '../utils/translations';
import { getShiftViolations } from '../utils/workRules';
import { getBreakMinutesForShift, getNetShiftMinutes } from '../utils/breakRules';
import { isPurelyManagementRole, isManagementRole, isUserVisibleOnTeamSchedule } from '../utils/permissions';
import { isUiWidgetVisible } from '../utils/uiScreenWidgets';
import { isFeatureEnabled, isAdminModuleEnabled } from '../utils/enabledFeatures';
import { exportSchedulePDF } from '../utils/exportSchedulePDF';
import { getHiddenDates, toggleHiddenDate } from '../utils/hiddenPeriods';
import { getHistory, type HistoryEntry } from '../utils/scheduleHistory';
import { getDepartments, getDeptColor } from '../utils/departments';
import { loadPeriodConfig, getPeriodStartDate, weekIndexForDateInPeriod } from '../utils/periodConfig';
import { motion, AnimatePresence } from 'framer-motion';

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
/** Normalizza a HH:mm. Non usa new Date(). */
function toHHmm(val: string): string {
  const trimmed = (val || '').trim().slice(0, 5);
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed.length >= 4) return `${trimmed.slice(0, 2).padStart(2, '0')}:${trimmed.slice(-2)}`;
  return trimmed || '';
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

/** Costruisce timestamp ISO (locale) da data yyyy-MM-dd e ora HH:mm. */
function toTimestampISO(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

// ── Open shift helpers ──────────────────────────────────────────────────────
/** Vero se il turno è aperto (non assegnato) o in richiesta di assegnazione. */
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

/** Margini viewport per menu fixed (evita taglio con overflow-x-clip / schermi stretti). */
const DROPDOWN_VIEW_MARGIN = 8;

/**
 * Posizione `fixed` sotto il trigger, larghezza max clampata, orizzontale clampato nel viewport
 * (preferisce allineamento a destra come `right-0` ma sposta se esce a sinistra).
 */
function useClampedFixedDropdown(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  preferredWidth: number
): { top: number; left: number; width: number } | null {
  const [style, setStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  const update = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!open || !containerRef.current) {
      setStyle(null);
      return;
    }
    const r = containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const w = Math.min(preferredWidth, vw - DROPDOWN_VIEW_MARGIN * 2);
    let left = r.right - w;
    if (left < DROPDOWN_VIEW_MARGIN) left = DROPDOWN_VIEW_MARGIN;
    if (left + w > vw - DROPDOWN_VIEW_MARGIN) left = vw - w - DROPDOWN_VIEW_MARGIN;
    const top = r.bottom + 4;
    setStyle({ top, left, width: w });
  }, [open, containerRef, preferredWidth]);

  useLayoutEffect(() => {
    update();
  }, [update]);

  useEffect(() => {
    if (!open) return;
    update();
    const onReposition = () => update();
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open, update]);

  return style;
}

export default function WeeklyShiftsTable({ filterUserId, stickyDateBarInScrollPane = false }: WeeklyShiftsTableProps = {}) {
  const [periodConfig, setPeriodConfig] = useState(loadPeriodConfig);
  const [weekIndex, setWeekIndex] = useState(() => weekIndexForDateInPeriod(loadPeriodConfig()));
  const [viewMode, setViewMode] = useState<'week' | '2weeks' | 'day' | 'month'>('week');
  const [monthOffset, setMonthOffset] = useState(0);

  useEffect(() => {
    const handler = () => setPeriodConfig(loadPeriodConfig());
    window.addEventListener('osteria_period_updated', handler);
    return () => window.removeEventListener('osteria_period_updated', handler);
  }, []);
  const [showMenuOpen, setShowMenuOpen] = useState(false);
  const [filtersMenuOpen, setFiltersMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [templatesMenuOpen, setTemplatesMenuOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [templatesList, setTemplatesList] = useState<string[]>([]);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const showMenuRef = useRef<HTMLDivElement | null>(null);
  const filtersMenuRef = useRef<HTMLDivElement | null>(null);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);
  const templatesMenuRef = useRef<HTMLDivElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const legendDropdownStyle = useClampedFixedDropdown(legendOpen, legendRef, 224);
  const toolsDropdownStyle = useClampedFixedDropdown(toolsMenuOpen, toolsMenuRef, 256);
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [bulkEditStart, setBulkEditStart] = useState('');
  const [bulkEditEnd, setBulkEditEnd] = useState('');
  const [bulkEditStatus, setBulkEditStatus] = useState<'' | 'draft' | 'confirmed' | 'approved'>('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [hiddenDates, setHiddenDates] = useState<Set<string>>(() => getHiddenDates());
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showHiddenPeriodsModal, setShowHiddenPeriodsModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarDay, setSidebarDay] = useState<string>('');
  const [sidebarEdits, setSidebarEdits] = useState<Record<string, { start: string; end: string; deduct_break?: boolean }>>({});
  const [sidebarSaving, setSidebarSaving] = useState(false);
  const [sidebarMenuShiftId, setSidebarMenuShiftId] = useState<string | null>(null);
  const [sidebarStatusSubmenuShiftId, setSidebarStatusSubmenuShiftId] = useState<string | null>(null);
  const [unlockShiftId, setUnlockShiftId] = useState<string | null>(null);
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [drawerDeleteConfirm, setDrawerDeleteConfirm] = useState<string | null>(null);
  const [drawerPunchEdits, setDrawerPunchEdits] = useState<Record<string, { punchIn: string; punchOut: string }>>({});
  const [drawerSaving, setDrawerSaving] = useState(false);
  const sidebarMenuRef = useRef<HTMLDivElement | null>(null);
  const anchorShiftIdRef = useRef<string | null>(null);
  const [dragSelect, setDragSelect] = useState<{ userIdx: number; dayIdx: number; slotIdx: number } | null>(null);
  const dragStartRef = useRef<{ userIdx: number; dayIdx: number; slotIdx: number } | null>(null);
  const dragSelectRef = useRef(dragSelect);
  dragSelectRef.current = dragSelect;
  const [creatingShift, setCreatingShift] = useState<{ userId: string; date: string; defaultTime: string } | null>(null);
  const [creatingOpenShift, setCreatingOpenShift] = useState<{ date: string } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const dateBarScrollRef = useRef<HTMLDivElement>(null);
  const dateBarSentinelRef = useRef<HTMLDivElement | null>(null);
  const [dateBarStuck, setDateBarStuck] = useState(false);
  const footerTotalsScrollRef = useRef<HTMLDivElement | null>(null);
  const cardScrollRefs = useRef<(HTMLDivElement | null)[]>([]);
  const syncScrollLeft = useCallback((source: HTMLDivElement | null) => {
    if (!source) return;
    const left = source.scrollLeft;
    requestAnimationFrame(() => {
      if (dateBarScrollRef.current && dateBarScrollRef.current !== source) dateBarScrollRef.current.scrollLeft = left;
      if (footerTotalsScrollRef.current && footerTotalsScrollRef.current !== source) footerTotalsScrollRef.current.scrollLeft = left;
      cardScrollRefs.current.forEach((ref) => { if (ref && ref !== source) ref.scrollLeft = left; });
    });
  }, []);

  const periodStartDate = getPeriodStartDate(periodConfig);
  const maxWeekIndex = periodConfig.numWeeks - 1;
  const weekStart = addDays(periodStartDate, Math.min(weekIndex, maxWeekIndex) * 7);
  const weekStr = format(weekStart, 'yyyy-MM-dd');

  useEffect(() => {
    setWeekIndex((i) => Math.min(i, maxWeekIndex));
  }, [maxWeekIndex]);

  useEffect(() => {
    if (dateBarScrollRef.current) dateBarScrollRef.current.scrollLeft = 0;
    if (footerTotalsScrollRef.current) footerTotalsScrollRef.current.scrollLeft = 0;
    cardScrollRefs.current.forEach((ref) => { if (ref) ref.scrollLeft = 0; });
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
  }, [weekIndex, viewMode, monthOffset, stickyDateBarInScrollPane]);

  // GestioneTurni: click-to-filter by employee
  const [localFilterUserId, setLocalFilterUserId] = useState<string | null>(null);
  // Filtro per reparto (sala, kitchen, bar)
  const [localFilterDepartment, setLocalFilterDepartment] = useState<string>('');
  const [localFilterStatus, setLocalFilterStatus] = useState<'all' | 'approved' | 'confirmed' | 'draft' | 'unpunched'>('all');
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
  const { users, shifts, holidays, availability, toggleAvailability, updateShift, updateUser, currentUser, punchRecords, addShift, updatePunchRecord, addPunchRecord, deleteShifts, showError, showSuccess, silentRefreshData, requestConfirmAndSaveOrder, requestConfirmAndPublishWeek, postRefreshLocked, effectiveLanguage, approveShiftSoft, workRules, breakRules, featureFlags } = useApp();
  const t = getTranslations(effectiveLanguage);
  const breakComputeOpts = useMemo(
    () => ({ autoBreaksFeatureEnabled: featureFlags['auto_breaks'] !== false }),
    [featureFlags]
  );

  /** Auto-refresh silenzioso quando la scheda Turni viene montata (utente ci clicca sopra). */
  useEffect(() => {
    silentRefreshData();
  }, [silentRefreshData]);

  /** Allo sblocco dopo conferma PIN (o annullamento), usa l'ordine dal server. */
  useEffect(() => {
    if (!postRefreshLocked) setUserOrderOverride(null);
  }, [postRefreshLocked]);


  const allWeekDays = useMemo(() => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(addMonths(new Date(), monthOffset));
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const days: Date[] = [];
      for (let i = 0; i < 42; i++) days.push(addDays(calStart, i));
      return days;
    }
    if (viewMode === 'day') {
      return [weekStart];
    }
    const n = viewMode === '2weeks' ? 14 : 7;
    const periodEndDate = addDays(periodStartDate, periodConfig.numWeeks * 7 - 1);
    const lastDay = addDays(weekStart, n - 1);
    const capped = lastDay > periodEndDate ? Math.max(1, Math.ceil((periodEndDate.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000))) : n;
    return Array.from({ length: capped }, (_, i) => addDays(weekStart, i));
  }, [weekStart, periodStartDate, periodConfig.numWeeks, viewMode, monthOffset]);

  const monthStart = useMemo(() => viewMode === 'month' ? startOfMonth(addMonths(new Date(), monthOffset)) : null, [viewMode, monthOffset]);

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
    } catch { (showError ?? (() => {}))(t.template_save_error); }
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
      setTemplatesMenuOpen(false);
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
  }, [currentUser, shifts, updateShift, trackSave, showSuccess, showError]);

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
  }, [shifts, updateShift, trackSave, showSuccess, showError]);

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
  }, [shifts, updateShift, trackSave, showSuccess, showError]);

  const isManagement = currentUser ? isManagementRole(currentUser.role) : false;
  const canCreateShifts = currentUser?.can_create_shifts ?? false;
  const canEditShifts = isManagement;
  /** Tablet / desktop (≥768px): modifica e creazione turni. Telefono: solo lettura. */
  const canEditInApp = canEditShifts && isWideShiftViewport;
  /** Strumenti gestione (template, drag nomi, ecc.): stessa soglia viewport. */
  const canUseShiftManagementChrome = isManagement && isWideShiftViewport;
  const canViewTotalHours = currentUser ? isFeatureEnabled(currentUser, 'view_stats') : false;
  const canManageDrafts = currentUser ? isFeatureEnabled(currentUser, 'edit_shifts') : false;
  const canApproveShifts = currentUser ? isFeatureEnabled(currentUser, 'approve_shifts') : false;
  const isStaff = !isManagement;
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
    () => new Set(users.filter(isUserVisibleOnTeamSchedule).map((u) => u.id)),
    [users]
  );
  const visibleShifts = useMemo(() => {
    let list = shifts.filter(s => visibleUserIds.has(s.user_id));
    if (isStaff) list = list.filter(s => s.approval_status === 'approved' || s.approval_status === 'confirmed');
    // I dipendenti non vedono turni in giorni nascosti dal manager
    if (isStaff) list = list.filter(s => !hiddenDates.has(s.date));
    if (filterUserId || localFilterUserId) list = list.filter(s => s.user_id === (localFilterUserId || filterUserId));
    if (localFilterStatus === 'approved') list = list.filter(s => s.approval_status === 'approved');
    if (localFilterStatus === 'confirmed') list = list.filter(s => s.approval_status === 'confirmed');
    if (localFilterStatus === 'draft') list = list.filter(s => s.approval_status === 'draft');
    return list;
  }, [shifts, visibleUserIds, isStaff, filterUserId, localFilterUserId, localFilterStatus]);

  /** Traccia il giorno del turno selezionato (per apertura sidebar esplicita).
   *  NON apre la sidebar in automatico: la barra azione gestisce tutti i casi. */
  useEffect(() => {
    if (selectedShiftIds.length === 1) {
      const first = shifts.find((s) => s.id === selectedShiftIds[0]);
      if (first?.date) setSidebarDay(first.date);
    }
    // Chiudi sidebar se la selezione viene azzerata o diventa multipla
    if (selectedShiftIds.length !== 1) {
      setSidebarOpen(false);
    }
  }, [selectedShiftIds, shifts]);

  /** Chiudi menu a comparsa sidebar al click fuori */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sidebarMenuRef.current && !sidebarMenuRef.current.contains(e.target as Node)) {
        setSidebarMenuShiftId(null);
        setSidebarStatusSubmenuShiftId(null);
      }
      if (showMenuRef.current && !showMenuRef.current.contains(e.target as Node)) setShowMenuOpen(false);
      if (filtersMenuRef.current && !filtersMenuRef.current.contains(e.target as Node)) setFiltersMenuOpen(false);
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) setToolsMenuOpen(false);
      if (templatesMenuRef.current && !templatesMenuRef.current.contains(e.target as Node)) setTemplatesMenuOpen(false);
      if (legendRef.current && !legendRef.current.contains(e.target as Node)) setLegendOpen(false);
    };
    if (sidebarMenuShiftId || sidebarStatusSubmenuShiftId || showMenuOpen || filtersMenuOpen || toolsMenuOpen || templatesMenuOpen || legendOpen) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [sidebarMenuShiftId, sidebarStatusSubmenuShiftId, showMenuOpen, filtersMenuOpen, toolsMenuOpen, templatesMenuOpen, legendOpen]);


  const activeUsers = useMemo(() => {
    let list = users.filter(isUserVisibleOnTeamSchedule);
    if (localFilterDepartment) {
      list = list.filter((u) => u.department === localFilterDepartment);
    }
    if (filterUserId || localFilterUserId) {
      const fid = localFilterUserId || filterUserId;
      list = list.filter((u) => u.id === fid);
    }
    list = [...list].sort((a, b) => {
      if (userOrderOverride) {
        const ai = userOrderOverride.indexOf(a.id);
        const bi = userOrderOverride.indexOf(b.id);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      }
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
    return list;
  }, [users, filterUserId, localFilterUserId, userOrderOverride, localFilterDepartment]);

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
    anchorShiftIdRef.current = null;
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
    // Non avviare lasso se il click è su un elemento draggable (badge turno)
    if ((e.target as HTMLElement).draggable) return;
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
      if (e.key === 'Escape') { setSelectedShiftIds([]); setLocalFilterUserId(null); }
      const tag = (e.target as HTMLElement).tagName;
      const isInputFocused = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
      if (!isInputFocused) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (viewMode === 'month') setMonthOffset(prev => prev - 1);
          else setWeekIndex(prev => Math.max(0, prev - 1));
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (viewMode === 'month') setMonthOffset(prev => prev + 1);
          else setWeekIndex(prev => Math.min(maxWeekIndex, prev + 1));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, maxWeekIndex]);

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (tableContainerRef.current && !tableContainerRef.current.contains(e.target as Node)) {
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
    return getShiftViolations(shift, shifts, weekStr, format(addDays(weekStart, 7), 'yyyy-MM-dd'), workRules, {
      users,
      breakRules,
      autoBreaksFeatureEnabled: breakComputeOpts.autoBreaksFeatureEnabled,
    });
  }, [shifts, weekStr, weekStart, workRules, users, breakRules, breakComputeOpts]);

  /** Converte "HH:mm" in minuti dal mezzanotte. */
  const toMinutes = (t: string) => {
    const parts = (t || '').slice(0, 5).split(':');
    return (parseInt(parts[0] ?? '0', 10) || 0) * 60 + (parseInt(parts[1] ?? '0', 10) || 0);
  };

  /** Restituisce true se due turni dello stesso dipendente si sovrappongono in tempo. */
  const shiftsOverlap = useCallback((s1: Shift, s2: Shift): boolean => {
    const s1s = toMinutes(s1.start_time);
    const s1e = s1.end_time && s1.end_time !== s1.start_time ? toMinutes(s1.end_time) : s1s + 360;
    const s2s = toMinutes(s2.start_time);
    const s2e = s2.end_time && s2.end_time !== s2.start_time ? toMinutes(s2.end_time) : s2s + 360;
    const e1 = s1e <= s1s ? s1e + 1440 : s1e;
    const e2 = s2e <= s2s ? s2e + 1440 : s2e;
    return s1s < e2 && s2s < e1;
  }, []);

  // Internal Scheduling Logic: solo 3 stati (nessun conflitto)
  // Draft (bozza) → planned | Pubblicato/Standby → inprogress (blu) | Approvato → approved
  type ShiftColorVariant = 'planned' | 'inprogress' | 'approved';

  const getShiftColorVariant = (shift: Shift): ShiftColorVariant => {
    if (shift.approval_status === 'draft') return 'planned'; // Draft – tratteggiato grigio
    if (shift.approval_status === 'approved') return 'approved';  // Approvato – stato finale
    // confirmed → inprogress (blu)
    if (shift.approval_status === 'confirmed') return 'inprogress';
    const actualTimes = getActualShiftTime(shift, punchRecords);
    const endNorm = (shift.end_time || '').trim().slice(0, 5);
    const hasValidEnd = !!endNorm && endNorm !== (shift.start_time || '').slice(0, 5);
    if (actualTimes.isCompleted && !hasValidEnd) return 'inprogress';
    return 'planned';
  };

  /** Brand: bozza = bianco + bordo basilico; approvato = basilico pieno + testo bianco. */
  const VARIANT_CLASSES: Record<ShiftColorVariant, { bg: string; text: string; selRing: string; border?: string; borderBottom?: string }> = {
    planned: {
      bg: 'bg-white hover:bg-slate-50',
      text: 'text-slate-900',
      selRing: 'ring-accent/40',
      border: 'border-2 border-accent rounded-xl',
    },
    inprogress: {
      bg: 'bg-white hover:bg-slate-50',
      text: 'text-accent',
      selRing: 'ring-accent/40',
      border: 'border border-slate-200',
      borderBottom: 'border-b-2 border-slate-400',
    },
    approved: {
      bg: 'bg-accent hover:bg-accent-hover',
      text: 'text-white',
      selRing: 'ring-white/80',
      border: 'border-2 border-accent rounded-xl',
    },
  };

  const showViolations =
    (featureFlags?.violation_rules !== false) &&
    !!currentUser &&
    isAdminModuleEnabled(currentUser, 'violation_rules');
  const getCellStyle = (shift: Shift, isSelected: boolean, _hasAnySelected: boolean, colorVariant: ShiftColorVariant = 'planned') => {
    const v = VARIANT_CLASSES[colorVariant];
    let base = `relative group flex flex-col items-start justify-start ${v.bg} ${v.text} shadow-sm transition-shadow `;
    if (v.border) base += `${v.border} `;
    if (v.borderBottom) base += `${v.borderBottom} `;
    if (showViolations) {
      const viol = getViolations(shift);
      if (viol.some(x => x.severity === 'error')) base += 'ring-2 ring-red-500 ';
      else if (viol.some(x => x.severity === 'warn')) base += 'ring-2 ring-amber-400 ';
    }
    const selectedStyle = isSelected ? `ring-2 ${v.selRing} shadow-md ` : '';
    return `${base}${selectedStyle}rounded-xl px-1.5 py-1 my-0.5 mx-0.5 cursor-default min-h-[44px] sm:min-h-[44px]`;
  };

  const GHOST_END = '23:00';

  /** Restituisce end_time effettivo: reale, 16:00 per 10:00, o 23:00 fantasma per draft serali senza fine. */
  const getEffectiveEnd = useCallback((shift: Shift): string | null => {
    const startNorm = (shift.start_time || '').trim().slice(0, 5);
    const endNorm = (shift.end_time || '').trim().slice(0, 5);
    if (startNorm === '10:00' && (!endNorm || endNorm === startNorm)) return '16:00';
    if (endNorm && endNorm !== startNorm) return endNorm;
    const startHour = parseInt(startNorm.split(':')[0], 10) || 0;
    if (shift.approval_status === 'draft' && startHour >= 16) return GHOST_END;
    return null;
  }, []);

  /** Ore confermate: solo turni confirmed con end_time reale (o 10:00->16:00). */
  const weeklyMinutesConfirmedByUser = useMemo(() => {
    const weekStr = format(weekStart, 'yyyy-MM-dd');
    const weekEnd = format(addDays(weekStart, 7), 'yyyy-MM-dd');
    const weekShifts = shifts.filter(
      (s) => s && s.date >= weekStr && s.date < weekEnd &&
        (s.approval_status === 'confirmed' || s.approval_status === 'approved')
    );
    const byUser: Record<string, number> = {};
    for (const shift of weekShifts) {
      const end = getEffectiveEnd(shift);
      if (!end) continue;
      try {
        const startNorm = (shift.start_time || '').trim().slice(0, 5);
        const shiftUser = users.find((u) => u.id === shift.user_id);
        const gross = calculateShiftMinutesGross(startNorm, end);
        const breakMins = getBreakMinutesForShift(shift, gross, shiftUser ?? undefined, breakRules, breakComputeOpts);
        const mins = Math.max(0, gross - breakMins);
        byUser[shift.user_id] = (byUser[shift.user_id] ?? 0) + mins;
      } catch {
        /* skip */
      }
    }
    return byUser;
  }, [shifts, weekStart, getEffectiveEnd, users, breakRules, breakComputeOpts]);

  /** Ore totali per giorno (somma di tutti gli utenti) — per la riga footer */
  const dailyMinutesByDate = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const day of allWeekDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayShifts = visibleShifts.filter((s) => s.date === dateStr &&
        (s.approval_status === 'confirmed' || s.approval_status === 'approved'));
      let total = 0;
      for (const shift of dayShifts) {
        const end = getEffectiveEnd(shift);
        if (!end) continue;
        try {
          const startNorm = (shift.start_time || '').trim().slice(0, 5);
          const shiftUser = users.find((u) => u.id === shift.user_id);
          const gross = calculateShiftMinutesGross(startNorm, end);
          const breakMins = getBreakMinutesForShift(shift, gross, shiftUser ?? undefined, breakRules, breakComputeOpts);
          total += Math.max(0, gross - breakMins);
        } catch { /* skip */ }
      }
      byDate[dateStr] = total;
    }
    return byDate;
  }, [visibleShifts, allWeekDays, getEffectiveEnd, users, breakRules, breakComputeOpts]);

  const [draggedShiftId, setDraggedShiftId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [shakeBadgeId, setShakeBadgeId] = useState<string | null>(null);
  // GestioneTurni: inline cell editor (always-on, no mode toggle)
  const [cellEdit, setCellEdit] = useState<{ shiftId: string; value: string } | null>(null);
  const [editPunchShiftId, setEditPunchShiftId] = useState<string | null>(null);
  const [editPunchTimeValue, setEditPunchTimeValue] = useState(''); // HH:mm per modale timbratura

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
          const edits = sidebarEdits[shift.id] ?? { start: (shift.start_time || '').trim().slice(0, 5), end: (shift.end_time || '').trim().slice(0, 5) };
          const startVal = toHHmm(edits.start) || shift.start_time || '';
          const endVal = edits.end ? toHHmm(edits.end) : (startVal === '10:00' ? '16:00' : '');
          if (!startVal) continue;
          const others = shifts.filter((s) => s.user_id === shift.user_id && s.date === shift.date && s.id !== shift.id);
          if (hasShiftConflictSameDay(others, { start_time: startVal, end_time: endVal }, shift.id)) {
            showError(t.shift_conflict_same_day);
            return;
          }
          const punchIn = punchRecords.find((p) => p.shift_id === shift.id && p.type === 'in');
          const updates: { start_time: string; end_time: string } = { start_time: startVal, end_time: endVal };
          await updateShift(shift.id, updates);
          if (shift.date) {
            if (punchIn) {
              await updatePunchRecord(punchIn.id, {
                timestamp: toTimestampISO(shift.date, startVal),
                calculated_time: toTimestampISO(shift.date, roundToNext5Minutes(startVal)),
              });
            } else {
              // Crea punch record solo se il turno è già iniziato (data passata o oggi e orario raggiunto)
              const shiftStartTs = new Date(toTimestampISO(shift.date, startVal));
              if (shiftStartTs <= new Date()) {
                const pr = await addPunchRecord(shift.user_id, 'in', { shift_id: shift.id, timestamp: toTimestampISO(shift.date, startVal) });
                if (pr && typeof pr === 'object' && 'error' in pr && pr.error) {
                  showError(pr.error);
                  return;
                }
              }
            }
          }
        }
        setSidebarOpen(false);
        setSelectedShiftIds([]);
        setSidebarEdits({});
        showSuccess?.(t.shift_saved);
      });
    } catch {
      showError(t.save_error_retry);
    } finally {
      setSidebarSaving(false);
    }
  }, [sidebarDay, sidebarEdits, visibleShifts, shifts, punchRecords, updateShift, updatePunchRecord, addPunchRecord, showError, trackSave, t.shift_conflict_same_day]);

  /** Save orari + timbrature manuale dal drawer singolo. */
  const handleDrawerSave = useCallback(async (shiftId: string) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    setDrawerSaving(true);
    try {
      const edits = sidebarEdits[shiftId];
      if (edits) {
        const startVal = toHHmm(edits.start) || shift.start_time || '';
        const endVal = toHHmm(edits.end) || shift.end_time || '';
        const deductBreakVal = edits.deduct_break ?? (shift.deduct_break !== false);
        const shiftUpdates: Partial<import('../types').Shift> = {};
        if (startVal) {
          const others = shifts.filter((s) => s.user_id === shift.user_id && s.date === shift.date && s.id !== shiftId);
          if (hasShiftConflictSameDay(others, { start_time: startVal, end_time: endVal }, shiftId)) {
            showError?.(t.shift_conflict_same_day);
            return;
          }
          shiftUpdates.start_time = startVal;
          shiftUpdates.end_time = endVal;
        }
        shiftUpdates.deduct_break = deductBreakVal;
        if (Object.keys(shiftUpdates).length > 0) {
          await updateShift(shiftId, shiftUpdates);
        }
      }
      const punchEdits = drawerPunchEdits[shiftId];
      if (punchEdits && shift.date) {
        const existingIn = punchRecords.find((p) => p.shift_id === shiftId && p.type === 'in');
        if (punchEdits.punchIn) {
          const ts = toTimestampISO(shift.date, punchEdits.punchIn);
          const calc = toTimestampISO(shift.date, roundToNext5Minutes(punchEdits.punchIn));
          if (existingIn) {
            await updatePunchRecord(existingIn.id, { timestamp: ts, calculated_time: calc });
          } else {
            const pr = await addPunchRecord(shift.user_id, 'in', { shift_id: shiftId, timestamp: ts });
            if (pr && typeof pr === 'object' && 'error' in pr && pr.error) {
              showError?.(pr.error);
              return;
            }
          }
        }
        if (punchEdits.punchOut) {
          if (existingIn) {
            const outTs = toTimestampISO(shift.date, punchEdits.punchOut);
            await updatePunchRecord(existingIn.id, { clock_out_time: outTs });
          }
        }
      }
      showSuccess?.(t.shift_saved);
      setSidebarOpen(false);
      setSelectedShiftIds([]);
      setSidebarEdits({});
      setDrawerPunchEdits({});
    } catch {
      showError?.(t.save_error_retry);
    } finally {
      setDrawerSaving(false);
    }
  }, [shifts, sidebarEdits, drawerPunchEdits, punchRecords, updateShift, updatePunchRecord, addPunchRecord, showError, showSuccess, t.shift_conflict_same_day]);

  const handleUnlockShift = async (shiftId: string, pin: string) => {
    if (!currentUser) return;
    if (pin !== currentUser.pin) {
      setUnlockError(t.ts_toast_wrong_pin);
      setUnlockPin('');
      return;
    }
    setUnlocking(true);
    try {
      await updateShift(shiftId, {
        approval_status: 'confirmed',
        approved_at: null as unknown as string,
        approved_by: null as unknown as string,
      });
      setUnlockShiftId(null);
      setUnlockPin('');
      setUnlockError('');
      showSuccess?.(t.ts_toast_shift_unlocked);
    } catch {
      showError?.(t.ts_toast_unlock_error);
    } finally {
      setUnlocking(false);
    }
  };

  const handleDropShift = useCallback(async (shiftId: string, targetUserId: string, targetDate: string) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift || (shift.user_id === targetUserId && shift.date === targetDate)) return;
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
  }, [shifts, updateShift, showError, showSuccess, trackSave, shiftsOverlap]);

  /** Salva l'editing inline della cella: parsifica "10-16" o "10:00-16:00", aggiorna shift e (se esiste) la timbratura entrata.
   * Se il turno è blu (in corso = confirmed), la modifica approva anche il turno (→ approved). */
  const handleCellEditSave = useCallback(async (shiftId: string, rawValue: string) => {
    setCellEdit(null);
    const parsed = parseCellTimeInput(rawValue);
    if (!parsed || !parsed.start) return;
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    const existing = shifts.filter((s) => s.user_id === shift.user_id && s.date === shift.date);
    if (hasShiftConflictSameDay(existing, { start_time: parsed.start!, end_time: parsed.end }, shiftId)) {
      showError(t.shift_conflict_same_day);
      return;
    }
    const shiftUpdates: { start_time: string; end_time: string } = { start_time: parsed.start!, end_time: parsed.end };
    await trackSave(async () => {
      try {
        await updateShift(shiftId, shiftUpdates);
        if (shift?.date) {
          const punchIn = punchRecords.find((p) => p.shift_id === shiftId && p.type === 'in');
          if (punchIn) {
            const timestamp = toTimestampISO(shift.date, parsed.start!);
            const calculated_time = toTimestampISO(shift.date, roundToNext5Minutes(parsed.start!));
            await updatePunchRecord(punchIn.id, { timestamp, calculated_time });
          }
        }
        showSuccess?.(t.shift_time_updated);
      } catch {
        showError(t.save_error_retry);
      }
    });
  }, [shifts, updateShift, punchRecords, updatePunchRecord, showError, showSuccess, trackSave, t.shift_conflict_same_day]);

  if (!currentUser) return null;

  return (
    <div ref={tableContainerRef} className="pb-content pt-6 w-full max-w-full font-sans min-h-full">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        className="min-h-full"
      >
      {isStaff && !wStaffTable ? (
        <p className="text-sm text-slate-500 text-center py-16 px-4">
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
      {/* Toolbar: [Oggi] [date] [Vista]  |  [Filtri▾] [Azioni▾] [badge richieste] [badge bozze] */}
      <div className="ui-toolbar-row mb-4 w-full justify-between">

        {/* ── Sinistra: navigazione e vista ── */}
        <div className="ui-toolbar-row-tight min-w-0 sm:gap-2.5">
          <button
            type="button"
            onClick={() => {
              setMonthOffset(0);
              setWeekIndex(weekIndexForDateInPeriod(periodConfig));
            }}
            className="ui-toolbar-ghost-accent"
          >
            {t.today}
          </button>
          {/* Selettore vista: Settimana | Mese */}
          <div className="ui-toolbar-group">
            {(['week', 'month'] as const).map((vm) => (
              <button
                key={vm}
                type="button"
                onClick={() => { setViewMode(vm); if (vm === 'month') setMonthOffset(0); }}
                className={`ui-toolbar-tab ${viewMode === vm ? 'bg-accent text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {vm === 'week' ? t.view_week : t.view_month}
              </button>
            ))}
          </div>
          {viewMode !== 'month' && (
            <span className="inline-flex h-[22px] items-center text-[13px] font-semibold tabular-nums leading-none text-slate-500">
              {weekIndex + 1}/{periodConfig.numWeeks}
            </span>
          )}
        </div>

        {/* ── Destra: Filtri + Azioni + badge + Scarica PDF ── */}
        <div className="ui-toolbar-row-tight shrink-0">

          {/* ── FILTRI (stato: Approvato, Pubblicato, Bozza) ── */}
          {!isStaff && (
            <div className="ui-toolbar-dropdown-root" ref={filtersMenuRef}>
              <button
                type="button"
                onClick={() => { setFiltersMenuOpen(!filtersMenuOpen); setShowMenuOpen(false); setToolsMenuOpen(false); }}
                className={`ui-toolbar-chip ${localFilterStatus !== 'all' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              >
                <Filter className="w-3 h-3" />
                <span className="hidden sm:inline">{t.wst_filters}</span>
                {localFilterStatus !== 'all' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                )}
                <ChevronDown className="w-3 h-3" />
              </button>
              {filtersMenuOpen && (
                <div className="absolute left-0 top-full mt-1 w-28 rounded-xl bg-white border border-slate-200 shadow-xl py-0.5 z-50">
                  <div className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    {t.wst_shift_status_header}
                  </div>
                  {[
                    { key: 'approved' as const,  label: t.ts_status_approved, Icon: Check },
                    { key: 'confirmed' as const, label: t.wst_filter_published, Icon: Clock },
                    { key: 'draft' as const,     label: t.status_draft, Icon: FileEdit },
                  ].map(({ key, label, Icon }) => {
                    const active = localFilterStatus === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setLocalFilterStatus(active ? 'all' : key); setFiltersMenuOpen(false); }}
                        className={`w-full px-2 py-1 text-left text-[11px] flex items-center gap-1 ${active ? 'bg-accent/10 text-accent font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
                      >
                        <Icon className={`w-2.5 h-2.5 flex-shrink-0 ${active ? 'text-accent' : 'text-slate-400'}`} />
                        {label}
                      </button>
                    );
                  })}
                  {localFilterStatus !== 'all' && (
                    <button
                      type="button"
                      onClick={() => { setLocalFilterStatus('all'); setFiltersMenuOpen(false); }}
                      className="w-full px-2 py-1 text-left text-[11px] text-slate-500 hover:bg-slate-100 flex items-center gap-1 border-t border-slate-100"
                    >
                      <X className="w-2.5 h-2.5" /> {t.filter_all}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── LEGGENDA (solo admin/manager/assistant_manager) ── */}
          {!isStaff && (
          <div className="ui-toolbar-dropdown-root" ref={legendRef}>
            <button
              type="button"
              onClick={() => { setLegendOpen(!legendOpen); setShowMenuOpen(false); setToolsMenuOpen(false); }}
              className="ui-toolbar-chip border-slate-200 text-slate-500 hover:bg-slate-100"
              title={t.wst_legend_tooltip}
            >
              <Info className="h-3 w-3" />
              <span className="hidden sm:inline">{t.wst_legend}</span>
            </button>
            {legendOpen && legendDropdownStyle && (
              <div
                className="fixed rounded-xl bg-white border border-slate-200 shadow-xl py-2 z-[60] max-h-[80vh] overflow-y-auto overscroll-contain"
                style={{
                  top: legendDropdownStyle.top,
                  left: legendDropdownStyle.left,
                  width: legendDropdownStyle.width,
                }}
              >

                {/* ── Stato turno ── */}
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t.wst_shift_status_header}
                </div>
                {[
                  { bg: 'bg-accent',  border: '',                    textCls: 'text-white',  label: t.ts_status_approved,  sub: t.wst_status_sub_approved, check: true },
                  { bg: 'bg-white',   border: 'border border-slate-200', textCls: 'text-accent', label: t.wst_filter_published, sub: t.wst_status_sub_published, check: false },
                  { bg: 'bg-white',   border: 'border-dashed border-slate-300', textCls: 'text-black', label: t.status_draft,      sub: t.wst_status_sub_draft, check: false },
                ].map(({ bg, border, textCls, label, sub, check }) => (
                  <div key={label} className="flex items-center gap-2.5 px-3 py-1.5">
                    <span className={`flex-shrink-0 w-10 h-6 rounded-xl ${bg} ${border} flex flex-col items-center justify-center`}>
                      <span className={`text-[9px] font-bold leading-none ${textCls}`}>10–16</span>
                      {check && <Check className="w-2.5 h-2.5 text-white mt-0.5" strokeWidth={3} />}
                    </span>
                    <span>
                      <p className="text-xs font-semibold text-slate-700 leading-none">{label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{sub}</p>
                    </span>
                  </div>
                ))}

                {/* ── Violazioni ── */}
                <div className="border-t border-slate-100 mt-1.5 pt-1.5">
                  <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                    <div key={label} className="flex items-center gap-2.5 px-3 py-1.5">
                      <span className={`flex-shrink-0 w-10 h-6 rounded-xl bg-white border border-slate-200 ${ringCls} flex items-center justify-center`}>
                        <span className={`w-2 h-2 rounded-full ${dot}`} />
                      </span>
                      <span>
                        <p className="text-xs font-semibold text-slate-700 leading-none">{label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{sub}</p>
                      </span>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>
          )}

          {/* ── REPARTO (solo admin/manager/assistant_manager) ── */}
          {!isStaff && (
          <div className="ui-toolbar-dropdown-root" ref={showMenuRef}>
            <button
              type="button"
              onClick={() => { setShowMenuOpen(!showMenuOpen); setFiltersMenuOpen(false); setToolsMenuOpen(false); setTemplatesMenuOpen(false); }}
              className={`ui-toolbar-chip ${localFilterDepartment !== '' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              <span className="hidden sm:inline">{t.wst_department_button}</span>
              {localFilterDepartment !== '' && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
              )}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showMenuOpen && (
              <div className="absolute left-0 top-full mt-1 w-48 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-50">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  {t.department_filter_label}
                </div>
                {[{ value: '', label: t.department_filter_all }, ...getDepartments()].map(({ value: dept, label }) => (
                  <button
                    key={dept || 'all'}
                    type="button"
                    onClick={() => { setLocalFilterDepartment(dept); setShowMenuOpen(false); }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${localFilterDepartment === dept ? 'bg-accent/10 text-accent font-semibold' : 'text-slate-700 hover:bg-slate-100'}`}
                  >
                    {dept
                      ? <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getDeptColor(dept) }} />
                      : localFilterDepartment === '' ? <Check className="w-3 h-3 flex-shrink-0" /> : <span className="w-3 h-3 flex-shrink-0" />
                    }
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          )}

          {/* ── AZIONI (solo admin/manager/assistant_manager) ── */}
          {!isStaff && (
          <div className="ui-toolbar-dropdown-root" ref={toolsMenuRef}>
            <button
              type="button"
              onClick={() => {
                const next = !toolsMenuOpen;
                setToolsMenuOpen(next);
                setShowMenuOpen(false);
                setTemplatesMenuOpen(false);
                if (next) loadTemplatesList();
              }}
              className="ui-toolbar-chip border-slate-200 text-slate-600 hover:bg-slate-100"
              aria-label={t.wst_actions}
              title={t.wst_actions}
            >
              <MoreHorizontal className="h-3 w-3 shrink-0 sm:hidden" aria-hidden />
              <span className="hidden sm:inline">{t.wst_actions}</span>
              <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
            </button>
            {toolsMenuOpen && toolsDropdownStyle && (
              <div
                className="fixed rounded-xl bg-white border border-slate-200 shadow-xl z-[60] max-h-[80vh] overflow-y-auto overscroll-contain"
                style={{
                  top: toolsDropdownStyle.top,
                  left: toolsDropdownStyle.left,
                  width: toolsDropdownStyle.width,
                }}
              >

                {/* ▸ SEZIONE PIANIFICAZIONE (management only) */}
                {canManageDrafts && isWideShiftViewport && (
                  <>
                    <div className="px-3 pt-2 pb-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.wst_planning_section}</p>
                    </div>
                    {draftCountInWeek > 0 && (
                      <button
                        type="button"
                        onClick={() => { requestConfirmAndPublishWeek(weekStart); setToolsMenuOpen(false); }}
                        className="w-full px-4 py-2 text-left text-sm font-semibold text-white bg-accent hover:bg-accent-hover flex items-center gap-2"
                      >
                        <Cloud className="w-4 h-4 flex-shrink-0" />
                        {t.publish_week}
                        <span className="ml-auto text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{draftCountInWeek}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        const n = viewMode === 'day' ? 1 : viewMode === '2weeks' ? 14 : 7;
                        const rangeStart = viewMode === 'day' ? allWeekDays[0] : weekStart;
                        const weekStr = format(rangeStart, 'yyyy-MM-dd');
                        const weekEnd = format(addDays(rangeStart, n), 'yyyy-MM-dd');
                        const toCopy = shifts.filter((s) => s.date >= weekStr && s.date < weekEnd);
                        let copied = 0;
                        for (const s of toCopy) {
                          const oldDate = parseISO(s.date);
                          const newDate = addDays(oldDate, n);
                          const newDateStr = format(newDate, 'yyyy-MM-dd');
                          try {
                            const res = await addShift({ user_id: s.user_id, date: newDateStr, start_time: s.start_time, end_time: s.end_time, type: s.type, approval_status: 'draft', deduct_break: s.deduct_break });
                            if (res) copied++;
                          } catch { /* skip */ }
                        }
                        setToolsMenuOpen(false);
                        setWeekIndex((i) => Math.min(maxWeekIndex, i + (viewMode === 'day' ? 1 : viewMode === '2weeks' ? 2 : 1)));
                        (showSuccess || showError)(formatTrans(t.shifts_copied_count, { n: copied }));
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      {t.copy_week}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCreatingOpenShift({ date: format(weekStart, 'yyyy-MM-dd') }); setToolsMenuOpen(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      {t.new_open_shift}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const n = viewMode === 'day' ? 1 : viewMode === '2weeks' ? 14 : 7;
                        const rangeStart = viewMode === 'day' ? allWeekDays[0] : weekStart;
                        const rangeStr = format(rangeStart, 'yyyy-MM-dd');
                        const rangeEnd = format(addDays(rangeStart, n), 'yyyy-MM-dd');
                        const toDelete = shifts.filter((s) => s.date >= rangeStr && s.date < rangeEnd && !s.notes?.startsWith('__OPEN__'));
                        setToolsMenuOpen(false);
                        if (!toDelete.length) { showError?.(t.no_shifts_to_delete); return; }
                        if (!confirm(formatTrans(t.wst_delete_all_week_shifts_confirm, { n: toDelete.length }))) return;
                        await deleteShifts(toDelete.map((s) => s.id));
                        showSuccess?.(formatTrans(t.shifts_deleted_count, { n: toDelete.length }));
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4 flex-shrink-0" />
                      Elimina settimana
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                  </>
                )}

                {/* ▸ SEZIONE TEMPLATE (management only) */}
                {canManageDrafts && isWideShiftViewport && (
                  <>
                    <div className="px-3 pt-1.5 pb-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Template</p>
                    </div>
                    <div className="px-3 pb-2">
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={saveTemplateName}
                          onChange={(e) => setSaveTemplateName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTemplate(saveTemplateName); }}
                          placeholder={t.template_name_placeholder}
                          className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                        <button
                          type="button"
                          disabled={!saveTemplateName.trim() || savingTemplate}
                          onClick={() => handleSaveTemplate(saveTemplateName)}
                          className="px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold disabled:opacity-50 hover:bg-accent-hover transition-colors"
                        >
                          {savingTemplate ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    {templatesList.length === 0 ? (
                      <p className="px-4 py-1.5 text-xs text-slate-400 italic">
                        {t.template_no_templates}
                      </p>
                    ) : (
                      templatesList.map((name) => (
                        <div key={name} className="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-50 group">
                          <span className="flex-1 text-sm text-slate-700 truncate">{name}</span>
                          <button type="button" onClick={() => handleApplyTemplate(name)}
                            className="px-2 py-0.5 rounded-xl text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 flex-shrink-0">
                            {t.template_apply}
                          </button>
                          <button type="button" onClick={() => handleDeleteTemplate(name)}
                            className="p-1 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                    <div className="my-1 border-t border-slate-100" />
                  </>
                )}

                {/* ▸ SEZIONE EXPORT */}
                <div className="px-3 pt-1.5 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.wst_export_section}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const weekStr = format(weekStart, 'yyyy-MM-dd');
                    const weekEnd = format(addDays(weekStart, viewMode === '2weeks' ? 14 : 7), 'yyyy-MM-dd');
                    const weekShifts = shifts.filter((s) => s.date >= weekStr && s.date < weekEnd);
                    const header = `${t.wst_export_csv_header_row}\n`;
                    const rows = weekShifts.map((s) => { const u = users.find((x) => x.id === s.user_id); return `${s.date};${u?.first_name ?? '-'};${s.start_time};${s.end_time};${s.approval_status}`; }).join('\n');
                    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `turni_${weekStr}_${weekEnd}.csv`; a.click(); URL.revokeObjectURL(url);
                    setToolsMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                >
                  <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  {t.export_csv}
                </button>
                {currentUser && isFeatureEnabled(currentUser, 'export_pdf') && (
                <button
                  type="button"
                  onClick={() => { exportSchedulePDF(weekStart, allWeekDays, activeUsers, shifts, { filterLabel: localFilterDepartment || undefined, breakRules, breakComputeOpts }); setToolsMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                >
                  <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  {t.download_pdf}
                </button>
                )}

                {/* ▸ SEZIONE VISTA (management only) */}
                {canUseShiftManagementChrome && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    <div className="px-3 pt-1.5 pb-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.wst_view_section}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowEditViewModal(true); setToolsMenuOpen(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                    >
                      <Pencil className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      {t.edit_view}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowHiddenPeriodsModal(true); setToolsMenuOpen(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                    >
                      <EyeOff className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      {t.wst_hidden_periods_short}
                      {hiddenDates.size > 0 && <span className="ml-auto text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-semibold">{hiddenDates.size}</span>}
                    </button>
                  </>
                )}

                {/* ▸ SEZIONE REGISTRO */}
                <div className="my-1 border-t border-slate-100" />
                <div className="px-3 pt-1.5 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.wst_registry_section}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowHistoryModal(true); setToolsMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                >
                  <History className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  {t.wst_schedule_history_title}
                </button>
              </div>
            )}
          </div>
          )}

        </div>
      </div>
      </>
      )}

      {/* Modale Storico schedule */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-600" />
                <h3 className="font-bold text-slate-800 text-sm">{t.wst_schedule_history_title}</h3>
              </div>
              <button type="button" onClick={() => setShowHistoryModal(false)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {(() => {
                const entries = getHistory();
                if (entries.length === 0) return <p className="text-slate-500 text-sm p-4 text-center">{t.wst_history_no_activity}</p>;
                const actionLabel: Record<string, string> = {
                  create: t.hist_action_create,
                  update: t.hist_action_update,
                  delete: t.hist_action_delete,
                  publish: t.hist_action_publish,
                  bulk_delete: t.hist_action_bulk_delete,
                  bulk_approve: t.hist_action_bulk_approve,
                };
                const actionColor: Record<string, string> = { create: 'bg-accent/12 text-accent', update: 'bg-blue-100 text-blue-700', delete: 'bg-red-100 text-red-700', publish: 'bg-accent/10 text-accent', bulk_delete: 'bg-red-100 text-red-700', bulk_approve: 'bg-accent/12 text-accent' };
                return entries.map((entry: HistoryEntry) => (
                  <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${actionColor[entry.action] ?? 'bg-slate-100 text-slate-600'}`}>
                      {actionLabel[entry.action] ?? entry.action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{entry.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowHiddenPeriodsModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[70vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-slate-600" />
                <h3 className="font-bold text-slate-800 text-sm">{t.wst_hidden_periods_modal_title}</h3>
              </div>
              <button type="button" onClick={() => setShowHiddenPeriodsModal(false)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs text-slate-500 mb-3">{t.wst_hidden_periods_modal_help}</p>
              {hiddenDates.size === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">{t.wst_no_hidden_days}</p>
              ) : (
                <ul className="space-y-2">
                  {[...hiddenDates].sort().map((date) => (
                    <li key={date} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-sm font-semibold text-slate-700">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => { setShowEditViewModal(false); setEditingNameUserId(null); setDraggingEditViewUserId(null); setDropTargetEditViewIdx(null); }}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[80vh] flex flex-col min-h-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
              <h3 className="text-sm font-bold text-slate-800">{t.names_list_title}</h3>
              <button type="button" onClick={() => { setShowEditViewModal(false); setEditingNameUserId(null); setDraggingEditViewUserId(null); setDropTargetEditViewIdx(null); }} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500">
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
                      <span className="shrink-0 text-slate-400 touch-none" aria-hidden title={t.drag_to_reorder}>
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
                            className="shrink-0 p-1 rounded-xl text-slate-500 hover:text-accent hover:bg-accent/10 focus:outline-none focus:ring-1 focus:ring-accent"
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
                      className="px-4 py-2 rounded-xl text-xs font-semibold uppercase text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
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
        className={`sticky z-[35] mt-4 mb-2 ${
          stickyDateBarInScrollPane ? 'top-0' : 'max-md:top-[calc(4.125rem+max(6px,env(safe-area-inset-top,0px)))] md:top-0'
        }`}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.04, duration: 0.2 }}
          className={`h-[34px] rounded-2xl overflow-hidden flex items-stretch bg-white border transition-[box-shadow,border-color] duration-300 ease-out ${
            dateBarStuck
              ? 'border-slate-200/90 shadow-[0_12px_32px_-8px_rgba(45,90,39,0.24),0_8px_20px_-6px_rgba(15,23,42,0.14)]'
              : 'border-slate-100 shadow-[0_4px_16px_-4px_rgba(45,90,39,0.14),0_2px_8px_-4px_rgba(15,23,42,0.08)]'
          }`}
        >
          <div className="flex-1 min-w-0 relative flex items-center justify-center">
            {viewMode === 'month' && monthStart ? (
              <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {format(monthStart, 'MMMM yyyy', { locale: getDateLocale(effectiveLanguage) ?? it })}
              </span>
            ) : (
            <div
              ref={dateBarScrollRef}
              onScroll={(e) => syncScrollLeft(e.currentTarget)}
              className="absolute inset-0 overflow-x-auto-safe smooth-touch overscroll-x-contain touch-manipulation snap-x snap-proximity"
            >
              <div className={`flex h-full min-h-[34px] sm:w-full ${allWeekDays.length === 1 ? 'w-[33.33%]' : allWeekDays.length === 14 ? 'w-[466.67%]' : allWeekDays.length === 42 ? 'w-full' : 'w-[233.33%]'}`}>
                {allWeekDays.map((day) => {
                  const isTodayDate = isToday(day);
                  const dayStr = format(day, 'yyyy-MM-dd');
                  const dayShiftIds = visibleShifts.filter((s) => s.date === dayStr).map((s) => s.id);
                  const hasShifts = dayShiftIds.length > 0;
                  return (
                    <div
                      key={day.toString()}
                      role={canEditInApp && !isStaff && hasShifts ? 'button' : undefined}
                      tabIndex={canEditInApp && !isStaff && hasShifts ? 0 : undefined}
                      onClick={(e) => {
                        if (!canEditInApp || isStaff || dayShiftIds.length === 0) return;
                        if ((e.target as HTMLElement).closest('button')) return;
                        setSelectedShiftIds(dayShiftIds);
                        setSidebarDay(dayStr);
                        // Apri direttamente la sidebar solo per giorno con 1 turno
                        if (dayShiftIds.length === 1) setSidebarOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (!canEditInApp || isStaff || dayShiftIds.length === 0) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedShiftIds(dayShiftIds);
                          setSidebarDay(dayStr);
                          if (dayShiftIds.length === 1) setSidebarOpen(true);
                        }
                      }}
                      onContextMenu={isManagement ? (e) => {
                        e.preventDefault();
                        const next = toggleHiddenDate(dayStr);
                        setHiddenDates(next);
                      } : undefined}
                      className={`flex-1 flex items-center justify-center gap-1 border-r border-slate-100 last:border-r-0 min-w-0 snap-center ${hiddenDates.has(dayStr) ? 'bg-slate-200/60' : isTodayDate ? 'bg-accent/10 ring-1 ring-inset ring-accent/35' : ''} ${canEditInApp && !isStaff && hasShifts ? 'cursor-pointer hover:bg-slate-100/80 active:bg-slate-200/80 transition-colors rounded-xl' : ''} ${isManagement ? 'select-none' : ''}`}
                      title={isManagement ? (hiddenDates.has(dayStr) ? t.wst_day_visible_tooltip : t.wst_day_hide_tooltip) : undefined}
                    >
                      {isManagement && hiddenDates.has(dayStr) && (
                        <EyeOff className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      )}
                      <span className={`text-xs uppercase font-bold ${hiddenDates.has(dayStr) ? 'text-slate-400' : 'text-slate-600'}`}>
                        {format(day, 'EEE', { locale: getDateLocale(effectiveLanguage) ?? it }).toUpperCase()}
                      </span>
                      <span className={`inline-flex text-xs font-bold ${isTodayDate && !hiddenDates.has(dayStr) ? 'bg-accent text-white px-1.5 py-0.5 rounded-xl' : hiddenDates.has(dayStr) ? 'text-slate-400' : 'text-slate-900'}`}>
                        {format(day, 'd')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {/* Frecce sovrapposte — assolute dentro flex-1, non occupano spazio layout */}
            <button
              type="button"
              onClick={() => viewMode === 'month' ? setMonthOffset(monthOffset - 1) : setWeekIndex((i) => Math.max(0, i - 1))}
              className="absolute left-0 top-0 h-full w-8 z-20 flex items-center justify-center bg-white/75 hover:bg-white/95 active:bg-slate-100 text-slate-500 transition-colors backdrop-blur-[2px]"
              aria-label={viewMode === 'month' ? t.wst_month_prev_aria : t.week_prev}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => viewMode === 'month' ? setMonthOffset(monthOffset + 1) : setWeekIndex((i) => Math.min(maxWeekIndex, i + 1))}
              className="absolute right-0 top-0 h-full w-8 z-20 flex items-center justify-center bg-white/75 hover:bg-white/95 active:bg-slate-100 text-slate-500 transition-colors backdrop-blur-[2px]"
              aria-label={viewMode === 'month' ? t.wst_month_next_aria : t.week_next}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Indicatore sync — destra */}
          <AnimatePresence>
            {(pendingSaves > 0 || justSynced) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1 px-2 flex-shrink-0 border-l border-slate-100"
              >
                {pendingSaves > 0 ? (
                  <>
                    <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                    <span className="text-amber-600 text-xs font-medium hidden sm:inline">{t.ts_saving}</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3 h-3 text-accent" />
                    <span className="text-accent text-xs font-medium hidden sm:inline">{t.wst_sync_saved}</span>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      </>
      )}

      {/* Contenuto: vista mese (calendario) o schede turni */}
      {wTurniGrid && (
      <div ref={scrollContainerRef} className="flex flex-col gap-2 pb-4">
        {/* Turni aperti subito sotto la barra date (vista settimana) */}
        {viewMode !== 'month' && (openVisibleShifts.length > 0 || canEditInApp) && (
          <motion.div
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.25 }}
            className="w-full rounded-xl overflow-hidden border border-dashed border-amber-400 bg-amber-50/60"
          >
            {/* Header */}
            <div className="flex items-center justify-between min-h-0 px-3 py-1.5 border-b border-amber-200 bg-amber-100">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-amber-700">
                <Plus className="w-3 h-3" />
                {t.open_shifts}
              </span>
              {canEditInApp && (
                <button
                  type="button"
                  onClick={() => setCreatingOpenShift({ date: format(weekStart, 'yyyy-MM-dd') })}
                  className="text-[10px] font-semibold text-amber-700 hover:text-amber-900 border border-amber-300 rounded-xl px-2 py-0.5 bg-white"
                >
                  + {t.new_open_shift}
                </button>
              )}
            </div>
            {/* Griglia giorni */}
            <div
              className="overflow-x-auto-safe smooth-touch overscroll-x-contain touch-manipulation snap-x snap-proximity"
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
                          <div className="flex flex-col gap-0.5 p-1 h-full">
                            {dayOpenShifts.length === 0 && canEditInApp && (
                              <button
                                type="button"
                                onClick={() => setCreatingOpenShift({ date: dayStr })}
                                className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                              >
                                <Plus className="w-3.5 h-3.5 text-amber-400" />
                              </button>
                            )}
                            {dayOpenShifts.map((s) => {
                              const timeLabel = `${s.start_time.slice(0,5)}–${(s.end_time||'?').slice(0,5)}`;
                              const publicNote = getOpenShiftPublicNote(s);
                              const requested = isRequestedShift(s);
                              const requester = getRequester(s);
                              const alreadyRequestedByMe = requester?.id === currentUser?.id;
                              // Colore: ambra normale = aperto, ambra scuro = richiesta in attesa
                              const badgeBg = requested ? 'bg-orange-300 border border-orange-400' : 'bg-amber-200';
                              const badgeText = requested ? 'text-orange-900' : 'text-amber-900';
                              return (
                                <div key={s.id} className={`relative group rounded-xl px-1.5 py-1 text-[10px] font-semibold flex flex-col gap-0.5 ${badgeBg} ${badgeText}`}>
                                  <div className="flex items-center gap-1">
                                    <span className="truncate flex-1 font-bold">{timeLabel}</span>
                                    {publicNote && <span title={publicNote}><MessageSquare className="w-2.5 h-2.5 flex-shrink-0" /></span>}
                                    {canEditInApp && (
                                      <button
                                        type="button"
                                        onClick={() => deleteShifts([s.id])}
                                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-red-500 text-white transition-opacity"
                                      >
                                        <X className="w-2 h-2" />
                                      </button>
                                    )}
                                  </div>

                                  {/* Stato richiesta per MANAGER */}
                                  {isManagement && requested && requester && (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[9px] font-semibold truncate">
                                        👤 {requester.name}
                                      </span>
                                      <div className="flex gap-0.5">
                                        <button
                                          type="button"
                                          onClick={() => handleApproveOpenShift(s.id)}
                                          className="flex-1 text-[9px] font-bold px-1 py-0.5 rounded-xl bg-accent text-white leading-none hover:bg-accent-hover transition-colors flex items-center justify-center gap-0.5"
                                          title={`Approva: assegna a ${requester.name}`}
                                        >
                                          <UserCheck className="w-2.5 h-2.5" />
                                          Approva
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRejectOpenShift(s.id)}
                                          className="flex-1 text-[9px] font-bold px-1 py-0.5 rounded-xl bg-red-100 text-red-700 leading-none hover:bg-red-200 transition-colors flex items-center justify-center gap-0.5"
                                          title="Rifiuta richiesta"
                                        >
                                          <UserX className="w-2.5 h-2.5" />
                                          Rifiuta
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Turno libero senza richieste: manager vede indicatore */}
                                  {isManagement && !requested && (
                                    <span className="text-[9px] text-amber-700 font-medium">Aperto</span>
                                  )}

                                  {/* Pulsante STAFF */}
                                  {isStaffUser && !alreadyRequestedByMe && !requested && (
                                    <button
                                      type="button"
                                      onClick={() => handleClaimOpenShift(s.id)}
                                      className="w-full text-[9px] font-bold px-1 py-0.5 rounded-xl bg-accent text-white leading-none hover:bg-accent-hover transition-colors text-center"
                                    >
                                      Richiedi
                                    </button>
                                  )}
                                  {isStaffUser && alreadyRequestedByMe && (
                                    <span className="text-[9px] font-semibold text-orange-800 text-center block">
                                      In attesa…
                                    </span>
                                  )}
                                  {isStaffUser && requested && !alreadyRequestedByMe && (
                                    <span className="text-[9px] font-semibold text-orange-700 text-center block">
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
          </motion.div>
        )}

        {viewMode === 'month' && monthStart ? (
          <div className="rounded-xl border-2 border-slate-200 bg-white overflow-hidden">
            {/* Intestazione giorni settimana */}
            <div className="grid grid-cols-7 bg-slate-50 border-b-2 border-slate-200">
              {allWeekDays.slice(0, 7).map((d, i) => (
                <div
                  key={d.toString()}
                  className={`py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 ${i < 6 ? 'border-r-2 border-slate-200' : ''}`}
                >
                  {format(d, 'EEE', { locale: getDateLocale(effectiveLanguage) ?? it })}
                </div>
              ))}
            </div>
            {/* Griglia giorni */}
            <div className="grid grid-cols-7">
              {allWeekDays.map((day, dayIdx) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const inMonth = day.getMonth() === monthStart.getMonth();
                const isTodayDate = isToday(day);
                const dayShifts = visibleShifts.filter((s) => s.date === dayStr);
                const hasShifts = dayShifts.length > 0;
                const dayOpenShifts = openVisibleShifts.filter((s) => s.date === dayStr);
                const isLastCol = dayIdx % 7 === 6;
                return (
                  <button
                    key={dayStr}
                    type="button"
                    onClick={() => {
                      const ids = hasShifts ? dayShifts.map((s) => s.id) : [];
                      setSelectedShiftIds(ids);
                      setSidebarDay(dayStr);
                      if (ids.length > 0) setSidebarOpen(true);
                    }}
                    className={`min-h-[72px] sm:min-h-[84px] p-2 text-left transition-colors border-b-2 border-slate-200 ${!isLastCol ? 'border-r-2 border-r-slate-200' : ''} ${!inMonth ? 'bg-slate-50/80' : isTodayDate ? 'bg-accent/5 hover:bg-accent/10' : 'bg-white hover:bg-slate-50'}`}
                  >
                    {/* Numero giorno */}
                    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${isTodayDate ? 'bg-accent text-white' : !inMonth ? 'text-slate-300' : 'text-slate-700'}`}>
                      {format(day, 'd')}
                    </span>
                    {/* Conteggio turni */}
                    {hasShifts && inMonth && (
                      <span className="flex items-center gap-1 mt-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                        <span className="text-[11px] font-semibold text-slate-600">
                          {dayShifts.length} {dayShifts.length === 1 ? t.shift_singular : t.shift_plural}
                        </span>
                      </span>
                    )}
                    {/* Badge turni aperti */}
                    {dayOpenShifts.length > 0 && inMonth && (
                      <span className="block mt-1 text-[9px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 w-fit">
                        +{dayOpenShifts.length} {t.open_shifts_short}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
              activeUsers.map((user, userIdx) => {
                const canManageThisUser = canEditInApp && !isPurelyManagementRole(user.role) && canCreateShifts;

                return (
                  <motion.div
                    key={user.id}
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.04 + 0.03 * userIdx, duration: 0.28 }}
                    draggable={isManagement}
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
                    className={`w-full rounded-xl card-factorial !p-0 overflow-hidden border-b-2 border-slate-400 ${draggingUserIdx !== null && draggingUserIdx !== userIdx ? 'opacity-50' : ''} ${dropUserIdx === userIdx && draggingUserIdx !== null && draggingUserIdx !== userIdx ? 'ring-2 ring-inset ring-accent' : ''}`}
                  >
                    {/* Header scheda: nome + ore (fisso, non scorre) — verde bottomnav */}
                    <div
                      onClick={() => canViewTotalHours && setLocalFilterUserId(prev => prev === user.id ? null : user.id)}
                      title={canEditInApp ? t.wst_name_row_filter_title : undefined}
                      className={`flex items-center justify-between min-h-0 px-2.5 py-1 border-b border-slate-200 bg-slate-50 ${user.status === 'suspended' || user.status === 'inactive' ? 'opacity-60' : ''} ${canEditInApp ? 'cursor-pointer' : ''}`}
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
                            className="w-full min-w-0 px-1.5 py-0.5 text-xs font-bold uppercase leading-tight rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-accent text-slate-900"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`font-bold text-xs uppercase leading-tight truncate ${user.status === 'suspended' || user.status === 'inactive' ? 'text-slate-400 line-through' : 'text-slate-800'} ${(canViewTotalHours || canEditInApp) ? 'cursor-pointer hover:underline' : ''}`}
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
                      {canViewTotalHours && (() => {
                        const mins = weeklyMinutesConfirmedByUser[user.id] ?? 0;
                        if (mins === 0) return null;
                        return (
                          <span className="font-bold text-xs uppercase leading-tight text-slate-500">
                            {formatMinutesToHoursAndMinutes(mins)}
                          </span>
                        );
                      })()}
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
                        const dayShifts = visibleShifts.filter(
                          (s) => s.user_id === user.id && s.date === dayStr
                        );

                        const dayShift = dayShifts.find((s) => parseInt(s.start_time.split(':')[0]) < 16);
                        const eveningShift = dayShifts.find((s) => parseInt(s.start_time.split(':')[0]) >= 16);
                        const hasOverlap = !!(dayShift && eveningShift && shiftsOverlap(dayShift, eveningShift));
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
                              className="px-0 py-0 min-w-0 snap-start bg-amber-50/60 border-r border-slate-300"
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
                            className={`px-0 py-0 min-w-0 snap-start group border-r border-slate-300 ${isToday(day) ? 'bg-accent/5' : isUnavailDay ? 'bg-red-50/70' : 'bg-white'}`}
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
                                    if (canEditInApp) {
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
                                className={`flex flex-col ${dayShift && dayVariant === 'planned' ? 'border-b-2 border-dashed border-slate-300' : 'border-b-2 border-slate-500'} relative select-none ${hasOverlap ? 'shadow-[0_0_10px_rgba(239,68,68,0.5)]' : ''} ${dropTargetKey === `${user.id}_${dayStr}_0` ? 'bg-amber-100 border-2 border-amber-400' : dayShift ? getCellStyle(dayShift, selectedShiftIds.includes(dayShift.id) || isInDragRect(0), selectedShiftIds.length > 0, dayVariant) : isInDragRect(0) ? 'bg-accent/10 border-2 border-accent' : 'border-transparent'} ${dayShift ? 'shift-card-hover-group' : ''} ${!dayShift && canManageThisUser ? 'cursor-pointer hover:bg-slate-50' : !dayShift ? 'cursor-default' : dayShift && canEditInApp ? 'cursor-pointer hover:ring-2 hover:ring-accent/40 hover:ring-inset' : ''}`}
                              >
                                {dayShift ? (() => {
                                  const actualTimes = getActualShiftTime(dayShift, punchRecords);
                                  const startNormCell = (dayShift.start_time || '').slice(0, 5);
                                  const endFallback = startNormCell === '10:00' ? '16:00' : null;
                                  const endStr = (actualTimes.endTime || endFallback)?.slice(0, 5) || '___';
                                  const timeDisplayed = `${actualTimes.startTime.slice(0, 5)} – ${endStr}`;
                                  const timeDisplayedShort = `${toShortTime(actualTimes.startTime)}–${toShortTime(endStr)}`;
                                  const deptColorDay = user.department ? getDeptColor(user.department) : null;
                                  return (
                                    <>
                                      {/* Dept color left accent bar */}
                                      {deptColorDay && dayVariant === 'inprogress' && (
                                        <span
                                          className="absolute top-1 left-1 bottom-1 w-[3px] rounded-full opacity-80"
                                          style={{ backgroundColor: deptColorDay }}
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
                                          className="absolute top-[6px] left-[4px] w-[100px] bg-white text-slate-800 text-xs font-bold text-center border-2 border-amber-500 rounded-xl shadow-lg focus:outline-none z-10 px-1 py-0.5"
                                        />
                                      ) : (
                                        <>
                                          {/* Orario — top-left, grassetto, nero (bianco se approvato) */}
                                          {canEditInApp ? (
                                            <span
                                              draggable
                                              onDragStart={(e: React.DragEvent) => { e.stopPropagation(); e.dataTransfer.setData('shiftId', dayShift.id); setDraggedShiftId(dayShift.id); }}
                                              onDragEnd={() => { setDraggedShiftId(null); setDropTargetKey(null); }}
                                              onDoubleClick={(e) => { e.stopPropagation(); if (dayShift.approval_status === 'approved') return; const cur = `${(dayShift.start_time||'').slice(0,5)}-${(dayShift.end_time||'').slice(0,5)}`; setCellEdit({ shiftId: dayShift.id, value: cur }); }}
                                              className={`absolute top-1/2 -translate-y-1/2 left-[10px] right-[40px] cursor-text ${shakeBadgeId === dayShift.id ? 'animate-shake' : ''}`}
                                              style={{ opacity: 1 }}
                                              title="Doppio click: modifica"
                                            >
                                              <span className={`text-xs font-bold leading-none truncate hidden sm:block ${dayVariant === 'approved' ? 'text-white' : dayVariant === 'planned' ? 'text-black' : 'text-accent'}`}>{timeDisplayed}</span>
                                              <span className={`text-[11px] font-bold leading-none block sm:hidden ${dayVariant === 'approved' ? 'text-white' : dayVariant === 'planned' ? 'text-black' : 'text-accent'}`}>{timeDisplayedShort}</span>
                                            </span>
                                          ) : (
                                            <span className="absolute top-1/2 -translate-y-1/2 left-[10px] right-[40px]">
                                              <span className={`text-xs font-bold leading-none truncate hidden sm:block ${dayVariant === 'approved' ? 'text-white' : dayVariant === 'planned' ? 'text-black' : 'text-accent'}`}>{timeDisplayed}</span>
                                              <span className={`text-[11px] font-bold leading-none block sm:hidden ${dayVariant === 'approved' ? 'text-white' : dayVariant === 'planned' ? 'text-black' : 'text-accent'}`}>{timeDisplayedShort}</span>
                                            </span>
                                          )}
                                          {/* ✔ bianca sotto orario — solo approvato */}
                                          {dayShift.approval_status === 'approved' && (
                                            <span className="absolute bottom-[3px] left-[10px] text-white opacity-90" title="Approvato">
                                              <Check className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={3} />
                                            </span>
                                          )}
                                          {/* Skills — se presenti, a destra del lock/check */}
                                          {dayShift.skills && (
                                            <span className="absolute bottom-[4px] left-[22px] flex flex-wrap gap-0.5">
                                              {dayShift.skills.split(',').map((sk) => sk.trim()).filter(Boolean).map((sk) => (
                                                <span key={sk} className={`text-[8px] font-bold px-1 py-0 rounded ${dayVariant === 'approved' ? 'bg-white/20 text-white/90' : 'bg-slate-200 text-slate-600'}`}>{sk}</span>
                                              ))}
                                            </span>
                                          )}
                                          {/* Hover actions: solo Elimina — solo desktop */}
                                          {canEditInApp && dayShift.approval_status !== 'approved' && (
                                            <div className="shift-card-hover-actions absolute top-1 right-1 hidden opacity-0 items-center gap-0.5 transition-opacity duration-200 z-20">
                                              <button
                                                type="button"
                                                title="Elimina"
                                                onClick={(e) => { e.stopPropagation(); if (window.confirm(t.delete_shift_confirm)) { deleteShifts([dayShift.id]); setSelectedShiftIds((prev) => prev.filter((id) => id !== dayShift.id)); showSuccess?.(t.shift_deleted); } }}
                                                className="w-5 h-5 rounded-xl flex items-center justify-center bg-white/90 hover:bg-red-50 border border-slate-200/80 transition-colors"
                                              >
                                                <Trash2 className="w-2.5 h-2.5 text-red-500" strokeWidth={2.5} />
                                              </button>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </>
                                  );
                                })() : canManageThisUser && (
                                  <div className="flex items-center justify-center h-full">
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
                                    if (canEditInApp) {
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
                                className={`flex flex-col relative select-none ${hasOverlap ? 'shadow-[0_0_10px_rgba(239,68,68,0.5)]' : ''} ${dropTargetKey === `${user.id}_${dayStr}_1` ? 'bg-amber-100 border-2 border-amber-400' : eveningShift ? getCellStyle(eveningShift, selectedShiftIds.includes(eveningShift.id) || isInDragRect(1), selectedShiftIds.length > 0, eveningVariant) : isInDragRect(1) ? 'bg-accent/10 border-2 border-accent' : 'border-transparent'} ${eveningShift ? 'shift-card-hover-group' : ''} ${!eveningShift && canManageThisUser ? 'cursor-pointer hover:bg-slate-50' : !eveningShift ? 'cursor-default' : eveningShift && canEditInApp ? 'cursor-pointer hover:ring-2 hover:ring-accent/40 hover:ring-inset' : ''}`}
                              >
                                {eveningShift ? (() => {
                                  const actualTimes = getActualShiftTime(eveningShift, punchRecords);
                                  const endEv = actualTimes.endTime ? actualTimes.endTime.slice(0, 5) : '___';
                                  const timeDisplayed = `${actualTimes.startTime.slice(0, 5)} – ${endEv}`;
                                  const timeDisplayedShort = `${toShortTime(actualTimes.startTime)}–${toShortTime(endEv)}`;
                                  const deptColorEv = user.department ? getDeptColor(user.department) : null;
                                  return (
                                    <>
                                      {/* Dept color left accent bar */}
                                      {deptColorEv && eveningVariant === 'inprogress' && (
                                        <span
                                          className="absolute top-1 left-1 bottom-1 w-[3px] rounded-full opacity-80"
                                          style={{ backgroundColor: deptColorEv }}
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
                                          className="absolute top-[6px] left-[4px] w-[100px] bg-white text-slate-800 text-xs font-bold text-center border-2 border-amber-500 rounded-xl shadow-lg focus:outline-none z-10 px-1 py-0.5"
                                        />
                                      ) : (
                                        <>
                                          {/* Orario — top-left, grassetto, nero (bianco se approvato) */}
                                          {canEditInApp ? (
                                            <span
                                              draggable
                                              onDragStart={(e: React.DragEvent) => { e.stopPropagation(); e.dataTransfer.setData('shiftId', eveningShift.id); setDraggedShiftId(eveningShift.id); }}
                                              onDragEnd={() => { setDraggedShiftId(null); setDropTargetKey(null); }}
                                              onDoubleClick={(e) => { e.stopPropagation(); if (eveningShift.approval_status === 'approved') return; const cur = `${(eveningShift.start_time||'').slice(0,5)}-${(eveningShift.end_time||'').slice(0,5)}`; setCellEdit({ shiftId: eveningShift.id, value: cur }); }}
                                              className={`absolute top-1/2 -translate-y-1/2 left-[10px] right-[40px] cursor-text ${shakeBadgeId === eveningShift.id ? 'animate-shake' : ''}`}
                                              style={{ opacity: 1 }}
                                              title="Doppio click: modifica"
                                            >
                                              <span className={`text-xs font-bold leading-none truncate hidden sm:block ${eveningVariant === 'approved' ? 'text-white' : eveningVariant === 'planned' ? 'text-black' : 'text-accent'}`}>{timeDisplayed}</span>
                                              <span className={`text-[11px] font-bold leading-none block sm:hidden ${eveningVariant === 'approved' ? 'text-white' : eveningVariant === 'planned' ? 'text-black' : 'text-accent'}`}>{timeDisplayedShort}</span>
                                            </span>
                                          ) : (
                                            <span className="absolute top-1/2 -translate-y-1/2 left-[10px] right-[40px]">
                                              <span className={`text-xs font-bold leading-none truncate hidden sm:block ${eveningVariant === 'approved' ? 'text-white' : eveningVariant === 'planned' ? 'text-black' : 'text-accent'}`}>{timeDisplayed}</span>
                                              <span className={`text-[11px] font-bold leading-none block sm:hidden ${eveningVariant === 'approved' ? 'text-white' : eveningVariant === 'planned' ? 'text-black' : 'text-accent'}`}>{timeDisplayedShort}</span>
                                            </span>
                                          )}
                                          {/* ✔ bianca sotto orario — solo approvato */}
                                          {eveningShift.approval_status === 'approved' && (
                                            <span className="absolute bottom-[3px] left-[10px] text-white opacity-90" title="Approvato">
                                              <Check className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={3} />
                                            </span>
                                          )}
                                          {/* Hover actions: solo Elimina — solo desktop */}
                                          {canEditInApp && eveningShift.approval_status !== 'approved' && (
                                            <div className="shift-card-hover-actions absolute top-1 right-1 hidden opacity-0 items-center gap-0.5 transition-opacity duration-200 z-20">
                                              <button
                                                type="button"
                                                title="Elimina"
                                                onClick={(e) => { e.stopPropagation(); if (window.confirm(t.delete_shift_confirm)) { deleteShifts([eveningShift.id]); setSelectedShiftIds((prev) => prev.filter((id) => id !== eveningShift.id)); showSuccess?.(t.shift_deleted); } }}
                                                className="w-5 h-5 rounded-xl flex items-center justify-center bg-white/90 hover:bg-red-50 border border-slate-200/80 transition-colors"
                                              >
                                                <Trash2 className="w-2.5 h-2.5 text-red-500" strokeWidth={2.5} />
                                              </button>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </>
                                  );
                                })() : canManageThisUser && (
                                  <div className="flex items-center justify-center h-full">
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
              className="w-full overflow-x-auto-safe smooth-touch overscroll-x-contain touch-manipulation snap-x snap-proximity"
            >
              <table className={`table-fixed border-collapse ${allWeekDays.length === 1 ? 'w-[33.33%]' : allWeekDays.length === 14 ? 'w-[466.67%]' : 'w-[233.33%]'} sm:w-full`}>
                <colgroup>
                  {allWeekDays.map((_, i) => <col key={i} className="w-[14.28%]" />)}
                </colgroup>
                <tbody>
                  <tr className="bg-white border-t border-accent/20">
                    {allWeekDays.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const mins = dailyMinutesByDate[dateStr] ?? 0;
                      return (
                        <td key={dateStr} className="border border-slate-100 bg-white px-1 py-1 text-center snap-start">
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
      </div>
      )}
      </>
      )}
      </motion.div>

      {/* ── Drawer turno — unico punto di controllo per la modifica ── */}
      <AnimatePresence>
        {canEditInApp && sidebarOpen && sidebarDay && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-[290]"
              onClick={() => { setSidebarOpen(false); setSelectedShiftIds([]); setDrawerDeleteConfirm(null); setSidebarEdits({}); setDrawerPunchEdits({}); }}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-[300] flex flex-col border-l border-slate-100"
            >
              {/* ─── HEADER ─────────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => { const d = parseISO(sidebarDay); setSidebarDay(format(addDays(d, -1), 'yyyy-MM-dd')); setDrawerDeleteConfirm(null); }} className="p-2 rounded-xl hover:bg-slate-100">
                    <ChevronLeft className="w-4 h-4 text-slate-500" />
                  </button>
                  <span className="font-bold text-slate-800 text-sm">
                    {format(parseISO(sidebarDay), 'EEE d MMM', { locale: getDateLocale(effectiveLanguage) ?? it })}
                  </span>
                  <button type="button" onClick={() => { const d = parseISO(sidebarDay); setSidebarDay(format(addDays(d, 1), 'yyyy-MM-dd')); setDrawerDeleteConfirm(null); }} className="p-2 rounded-xl hover:bg-slate-100">
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                <button type="button" onClick={() => { setSidebarOpen(false); setSelectedShiftIds([]); setDrawerDeleteConfirm(null); setSidebarEdits({}); setDrawerPunchEdits({}); }} className="p-2 rounded-xl hover:bg-slate-100">
                  <X className="w-5 h-5 text-slate-500" />
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
                  const edits = sidebarEdits[shift.id] ?? {
                    start: (shift.start_time || '').slice(0, 5),
                    end: (shift.end_time || '').slice(0, 5),
                    deduct_break: shift.deduct_break !== false,
                  };
                  const isFrozen = shift.approval_status === 'approved' && !!shift.approved_at;
                  const isSoftApproved = shift.approval_status === 'approved' && !shift.approved_at;
                  const isDraft = shift.approval_status === 'draft';
                  const isConfirmed = shift.approval_status === 'confirmed';

                  const updateEdits = (field: 'start' | 'end', val: string) => {
                    const next = { ...edits, [field]: val };
                    setSidebarEdits((prev) => ({ ...prev, [shift.id]: next }));
                  };
                  const deductBreak = edits.deduct_break ?? (shift.deduct_break !== false);
                  const setDeductBreak = (val: boolean) => {
                    setSidebarEdits((prev) => ({ ...prev, [shift.id]: { ...edits, deduct_break: val } }));
                  };

                  const punchIn = punchRecords.find((p) => p.shift_id === shift.id && p.type === 'in');
                  const punchEdits = drawerPunchEdits[shift.id] ?? {
                    punchIn: punchIn ? new Date(punchIn.timestamp).toTimeString().slice(0, 5) : '',
                    punchOut: punchIn?.clock_out_time ? new Date(punchIn.clock_out_time).toTimeString().slice(0, 5) : '',
                  };
                  const updatePunchEdits = (field: 'punchIn' | 'punchOut', val: string) => {
                    setDrawerPunchEdits((prev) => ({ ...prev, [shift.id]: { ...punchEdits, [field]: val } }));
                  };

                  const TimeBlock = ({ field }: { field: 'start' | 'end' }) => {
                    const val = edits[field];
                    const label = field === 'start' ? t.start_time : t.end_time;
                    return (
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</p>
                        <input
                          type="time"
                          disabled={isFrozen}
                          value={val}
                          onChange={(e) => updateEdits(field, e.target.value.slice(0, 5))}
                          className="w-full px-3 py-3 rounded-xl border border-slate-200 text-slate-800 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                        />
                      </div>
                    );
                  };

                  return (
                    <div className="flex flex-col flex-1 overflow-hidden">
                      {/* Scrollable content */}
                      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

                        {/* ── User badge ─────────────────────────────── */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-accent font-bold text-sm">{(u?.first_name ?? '?')[0]}</span>
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm leading-none">{u?.first_name} {u?.last_name}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 capitalize">{u?.role}</p>
                          </div>
                          {isFrozen && (
                            <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-full">
                              <Lock className="w-3 h-3" /> Congelato
                            </span>
                          )}
                        </div>

                        {/* ── ORARI ──────────────────────────────────── */}
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Orari</p>
                          <div className="flex gap-3 items-start">
                            <TimeBlock field="start" />
                            <div className="pt-10 text-slate-300 font-bold text-lg">–</div>
                            <TimeBlock field="end" />
                          </div>
                        </div>

                        {/* ── PAUSA AUTOMATICA ───────────────────────── */}
                        {!isFrozen && (
                          <label className="flex items-center gap-2 cursor-pointer py-1">
                            <input
                              type="checkbox"
                              checked={deductBreak}
                              onChange={(e) => setDeductBreak(e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 text-accent focus:ring-accent/30"
                            />
                            <span className="text-xs font-medium text-slate-600">{t.deduct_break_label}</span>
                          </label>
                        )}

                        {/* ── TIMBRATURE ─────────────────────────────── */}
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t.wst_punches_section_title}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">🟢 Entrata</label>
                              <input
                                type="time"
                                value={punchEdits.punchIn}
                                onChange={(e) => updatePunchEdits('punchIn', e.target.value.slice(0, 5))}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">🔴 Uscita</label>
                              <input
                                type="time"
                                value={punchEdits.punchOut}
                                onChange={(e) => updatePunchEdits('punchOut', e.target.value.slice(0, 5))}
                                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                              />
                            </div>
                          </div>
                          {!punchIn && !punchEdits.punchIn && (
                            <p className="text-[11px] text-slate-400 mt-1.5">{t.wst_no_punch_records}</p>
                          )}
                        </div>

                        {/* ── STATO (Bozza / Pubblicato / Approvato) ─── */}
                        {!isFrozen && (canManageDrafts || canApproveShifts) && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t.filter_status}</p>
                            <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                              {[
                                { st: 'draft' as const,     label: t.status_draft,     cls: 'text-slate-600', need: 'draft' as const },
                                { st: 'confirmed' as const, label: t.wst_filter_published, cls: 'text-blue-600', need: 'draft' as const },
                                { st: 'approved' as const,  label: t.ts_status_approved,  cls: 'text-accent', need: 'approval' as const },
                              ].map(({ st, label, cls, need }) => {
                                const active = (st === 'approved' && isSoftApproved) || (st === 'confirmed' && isConfirmed) || (st === 'draft' && isDraft);
                                const canClick = need === 'draft' ? canManageDrafts : canApproveShifts;
                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    disabled={!canClick}
                                    onClick={async () => {
                                      if (active || !canClick) return;
                                      if (st === 'draft') { updateShift(shift.id, { approval_status: 'draft' }); showSuccess?.(t.shift_status_toast_draft); }
                                      else if (st === 'confirmed') { updateShift(shift.id, { approval_status: 'confirmed' }); showSuccess?.(t.shift_status_toast_published); }
                                      else if (st === 'approved') { await approveShiftSoft(shift.id); showSuccess?.(t.shift_approved_toast); }
                                    }}
                                    className={`min-h-[36px] flex-1 rounded-md px-2 py-1.5 text-center text-[13px] font-semibold leading-none transition-colors ${active ? 'border border-slate-200 bg-white shadow-sm ' + cls : canClick ? 'text-slate-400 hover:bg-white/60 hover:text-slate-600' : 'cursor-not-allowed text-slate-300 opacity-60'}`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── Messaggio stato (approvato/congelato) ──── */}
                        <div className="space-y-2">
                          {isSoftApproved && (
                            <div className="flex items-center gap-2.5 bg-accent/10 border border-accent/25 rounded-xl px-3 py-2.5">
                              <Check className="w-4 h-4 text-accent flex-shrink-0" strokeWidth={3} />
                              <p className="text-xs font-semibold text-accent">
                                {t.wst_go_freeze_prefix}
                                <strong>{t.sidebar_attendance}</strong>
                                {t.wst_go_freeze_suffix}
                              </p>
                            </div>
                          )}
                          {isFrozen && (
                            <div>
                              {unlockShiftId === shift.id ? (
                                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4">
                                  <p className="text-xs text-slate-500 mb-2 text-center font-semibold">{t.wst_unlock_pin_heading}</p>
                                  <input
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={4}
                                    autoFocus
                                    value={unlockPin}
                                    placeholder="••••"
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                      setUnlockPin(val); setUnlockError('');
                                      if (val.length === 4) handleUnlockShift(shift.id, val);
                                    }}
                                    className={`w-full text-center text-2xl tracking-[0.6em] font-bold px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all ${unlockError ? 'border-red-400 ring-red-200 bg-white text-red-600' : 'border-slate-300 ring-accent/30 bg-white text-slate-900'}`}
                                  />
                                  {unlockError && <p className="text-xs text-red-500 text-center mt-1.5 font-semibold">{unlockError}</p>}
                                  {unlocking && <p className="text-xs text-accent text-center mt-1.5">{t.ts_unlocking}</p>}
                                  <button type="button" onClick={() => { setUnlockShiftId(null); setUnlockPin(''); setUnlockError(''); }} className="mt-2 w-full text-xs text-slate-400 hover:text-slate-600 transition-colors">
                                    {t.cancel}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => { setUnlockShiftId(shift.id); setUnlockPin(''); setUnlockError(''); }}
                                  className="w-full py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors"
                                >
                                  <Lock className="w-4 h-4" /> {t.wst_unlock_with_pin_btn}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── FOOTER ──────────────────────────────────── */}
                      <div className="flex-shrink-0 border-t border-slate-100 px-4 py-3 space-y-2">
                        {/* SALVA — sempre visibile se non congelato */}
                        {!isFrozen && (
                          <button
                            type="button"
                            disabled={drawerSaving}
                            onClick={() => void handleDrawerSave(shift.id)}
                            className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                          >
                            {drawerSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={3} />}
                            {t.wst_save_changes_btn}
                          </button>
                        )}
                        {/* Duplica + Elimina */}
                        {drawerDeleteConfirm === shift.id ? (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setDrawerDeleteConfirm(null)}
                              className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition-colors">
                              {t.cancel}
                            </button>
                            <button type="button"
                              onClick={() => {
                                deleteShifts([shift.id]);
                                setSelectedShiftIds([]);
                                setSidebarOpen(false);
                                setDrawerDeleteConfirm(null);
                                setSidebarEdits({});
                                setDrawerPunchEdits({});
                                showSuccess?.(t.shift_deleted);
                              }}
                              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors">
                              {t.wst_confirm_delete_btn}
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setDrawerDeleteConfirm(shift.id)}
                            className="w-full py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-red-100 transition-colors">
                            <Trash2 className="w-4 h-4" /> {t.delete_shift}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                // ── MULTI-SHIFT: bulk edit (existing behaviour) ─────────
                const bulkStatusLabels: Record<string, string> = {
                  draft: t.status_draft,
                  confirmed: t.wst_filter_published,
                  approved: t.ts_status_approved,
                };
                return (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {selectedShiftIds.length > 1 && (
                      <div className="rounded-xl border-2 border-accent/20 bg-accent/5 p-3.5 space-y-3">
                        <div>
                          <p className="text-xs font-bold text-accent">{formatTrans(t.wst_bulk_apply_title, { n: selectedShiftIds.length })}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{t.wst_bulk_empty_fields_hint}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{t.start_time}</label>
                            <input type="time" value={bulkEditStart} onChange={(e) => setBulkEditStart(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{t.end_time}</label>
                            <input type="time" value={bulkEditEnd} onChange={(e) => setBulkEditEnd(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent" />
                          </div>
                        </div>
                        {canManageDrafts && (
                          <div>
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Stato</p>
                            <div className="flex gap-1 flex-wrap">
                              <button type="button" onClick={() => setBulkEditStatus('')}
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${bulkEditStatus === '' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
                                Invariato
                              </button>
                              {(['draft', 'confirmed', 'approved'] as const).map((st) => (
                                <button key={st} type="button" onClick={() => setBulkEditStatus(st)}
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${bulkEditStatus === st ? 'bg-accent text-white border-accent' : 'bg-white text-slate-500 border-slate-200 hover:border-accent hover:text-accent'}`}>
                                  {bulkStatusLabels[st]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={bulkSaving || (!bulkEditStart && !bulkEditEnd && !bulkEditStatus)}
                          onClick={async () => {
                            setBulkSaving(true);
                            try {
                              const updates: Partial<import('../types').Shift> = {};
                              if (bulkEditStart) updates.start_time = bulkEditStart;
                              if (bulkEditEnd) updates.end_time = bulkEditEnd;
                              if (bulkEditStatus) updates.approval_status = bulkEditStatus as import('../types').ApprovalStatus;
                              if (bulkEditStart || bulkEditEnd) {
                                for (const id of selectedShiftIds) {
                                  const sh = shifts.find(s => s.id === id);
                                  if (!sh) continue;
                                  const others = shifts.filter(s => s.id !== id && s.user_id === sh.user_id && s.date === sh.date);
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
                              await Promise.all(selectedShiftIds.map((id) => updateShift(id, updates)));
                              showSuccess?.(formatTrans(t.bulk_shifts_updated, { n: selectedShiftIds.length }));
                              setBulkEditStart(''); setBulkEditEnd(''); setBulkEditStatus('');
                              setSelectedShiftIds([]);
                              setSidebarOpen(false);
                            } finally { setBulkSaving(false); }
                          }}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-60"
                        >
                          {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          {formatTrans(t.wst_bulk_apply_title, { n: selectedShiftIds.length })}
                        </button>
                      </div>
                    )}
                    {dayShifts.length === 0 ? (
                      <p className="text-slate-500 text-sm py-2">{t.no_shifts_scheduled}</p>
                    ) : dayShifts.map((shift) => {
                      const u = users.find((usr) => usr.id === shift.user_id);
                      const edits = sidebarEdits[shift.id] ?? { start: (shift.start_time || '').slice(0, 5), end: (shift.end_time || '').slice(0, 5) };
                      return (
                        <div key={shift.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-slate-800 text-sm">{u?.first_name ?? '-'}</p>
                            <span className="text-[11px] font-semibold text-slate-400 capitalize">{shift.approval_status}</span>
                          </div>
                          <div className="flex gap-2 items-center">
                            <input type="time" value={edits.start}
                              onChange={(e) => setSidebarEdits((prev) => ({ ...prev, [shift.id]: { ...edits, start: e.target.value.slice(0, 5) } }))}
                              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30" />
                            <span className="text-slate-300">–</span>
                            <input type="time" value={edits.end}
                              onChange={(e) => setSidebarEdits((prev) => ({ ...prev, [shift.id]: { ...edits, end: e.target.value.slice(0, 5) } }))}
                              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/30" />
                          </div>
                        </div>
                      );
                    })}
                    {dayShifts.length > 1 && dayShifts.some(s => s.approval_status !== 'approved') && (
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => void handleSidebarSave()} disabled={sidebarSaving}
                          className="flex-1 min-h-[44px] px-4 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent-hover disabled:opacity-60 flex items-center justify-center gap-2">
                          {sidebarSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          {t.save_all}
                        </button>
                        <button type="button" onClick={() => { setSidebarOpen(false); setSelectedShiftIds([]); setSidebarEdits({}); }}
                          className="min-h-[44px] px-4 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200">
                          {t.cancel}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>


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

      {/* Modale modifica orario timbratura */}
      {editPunchShiftId && (() => {
        const shift = shifts.find((s) => s.id === editPunchShiftId);
        const punch = punchRecords.find((p) => p.shift_id === editPunchShiftId && p.type === 'in');
        if (!shift || !punch || !shift.date) return null;
        const handleSavePunchTime = async () => {
          const timeStr = (editPunchTimeValue || '').trim().slice(0, 5);
          if (!/^\d{1,2}:\d{2}$/.test(timeStr)) {
            showError(t.enter_valid_time_example);
            return;
          }
          const normalized = timeStr.length === 4 ? `0${timeStr}` : timeStr;
          await trackSave(async () => {
            try {
              const rounded = roundToNext5Minutes(normalized);
              const ts = toTimestampISO(shift.date, normalized);
              const calc = toTimestampISO(shift.date, rounded);
              await updatePunchRecord(punch.id, { timestamp: ts, calculated_time: calc });
              setEditPunchShiftId(null);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              showError(msg.includes('column') || msg.includes('invalid') ? msg : t.save_error_retry);
            }
          });
        };
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9998] p-4" onClick={() => setEditPunchShiftId(null)}>
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-slate-200 dark:border-white/10 shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                {t.edit_punch_time_title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {users.find((u) => u.id === shift.user_id)?.first_name ?? '-'} · {shift.date}
              </p>
              <input
                type="time"
                value={editPunchTimeValue}
                onChange={(e) => setEditPunchTimeValue(e.target.value.slice(0, 5))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSavePunchTime(); } if (e.key === 'Escape') { e.preventDefault(); setEditPunchShiftId(null); } }}
                className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 font-semibold text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => setEditPunchShiftId(null)} className="flex-1 py-2.5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-semibold text-sm">
                  {t.cancel}
                </button>
                <button type="button" onClick={handleSavePunchTime} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm">
                  {t.save_changes}
                </button>
              </div>
            </div>
          </div>
        );
      })()}


    </div>
  );
}

/** Pannello modifica singolo turno — può essere embedded nel pannello unificato (senza bordo/X). Con multiEditMode mostra "Conferma e prossimo". */
interface ShiftEditPanelProps {
  shift: Shift;
  onClose: () => void;
  onSaved: () => void;
  embedded?: boolean;
  showCloseButton?: boolean;
  bulkShiftIds?: string[];
  /** Turni stesso dipendente stesso giorno, incluso quello in modifica (per validazione conflitti) */
  otherShiftsSameDay?: Shift[];
  multiEditMode?: boolean;
  onConfirmAndNext?: (values: { start_time: string; end_time: string; deduct_break: boolean }) => void;
}

function ShiftEditPanel({ shift, onClose, onSaved, embedded = false, showCloseButton = true, otherShiftsSameDay = [], multiEditMode, onConfirmAndNext }: ShiftEditPanelProps) {
  const { users, punchRecords, updateShift, updatePunchRecord, addPunchRecord, currentUser, showError, effectiveLanguage, breakRules, featureFlags } = useApp();
  const t = getTranslations(effectiveLanguage);
  const [startTime, setStartTime] = useState((shift.start_time || '').trim().slice(0, 5));
  const [endTime, setEndTime] = useState((shift.end_time || '').trim().slice(0, 5));
  const [deductBreak, setDeductBreak] = useState(shift.deduct_break !== false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** Admin, Manager, Assistant Manager: libertà totale di modifica. Altri: can_create_shifts. */
  const isManagement = currentUser ? isManagementRole(currentUser.role) : false;
  const canEdit = isManagement || (currentUser?.can_create_shifts ?? false);

  const actual = getActualShiftTime(shift, punchRecords);
  const canConfirmEntry = !actual.isCompleted;
  const hasChanges =
    toHHmm(startTime) !== (shift.start_time || '').trim().slice(0, 5) ||
    toHHmm(endTime) !== (shift.end_time || '').trim().slice(0, 5) ||
    deductBreak !== (shift.deduct_break !== false);

  const handleSave = async () => {
    if (!hasChanges) { onSaved(); return; }
    const st = toHHmm(startTime) || shift.start_time || '';
    const et = toHHmm(endTime);
    if (hasShiftConflictSameDay(otherShiftsSameDay, { start_time: st, end_time: et }, shift.id)) {
      showError(t.shift_conflict_same_day);
      return;
    }
    const updates: { start_time: string; end_time: string; deduct_break: boolean } = { start_time: st, end_time: et, deduct_break: deductBreak };
    setSaving(true);
    try {
      await updateShift(shift.id, updates);
      if (shift.date && st) {
        const punchIn = punchRecords.find((p) => p.shift_id === shift.id && p.type === 'in');
        if (punchIn) {
          const timestamp = toTimestampISO(shift.date, st);
          const calculated_time = toTimestampISO(shift.date, roundToNext5Minutes(st));
          await updatePunchRecord(punchIn.id, { timestamp, calculated_time });
        }
      }
      onSaved();
    } catch {
      showError(t.save_error_retry);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmEntry = async () => {
    setConfirming(true);
    try {
      const pr = await addPunchRecord(shift.user_id, 'in', { shift_id: shift.id });
      if (pr && typeof pr === 'object' && 'error' in pr && pr.error) {
        showError(pr.error);
        return;
      }
    } catch {
      showError(t.confirm_entry_save_error);
    } finally {
      setConfirming(false);
    }
  };

  const user = users.find((u) => u.id === shift.user_id);
  const lStart = toHHmm(startTime) || '';
  const lEnd = toHHmm(endTime) || (lStart === '10:00' && !endTime ? '16:00' : toHHmm(endTime) || '');
  const breakOpts = { autoBreaksFeatureEnabled: featureFlags['auto_breaks'] !== false };
  const lNet = lStart && lEnd
    ? getNetShiftMinutes({ ...shift, deduct_break: deductBreak }, lStart, lEnd, user ?? undefined, breakRules, breakOpts)
    : 0;
  const isPublished = shift.approval_status === 'confirmed' || shift.approval_status === 'approved';

  const timeInputClass = 'min-h-[44px] flex-1 min-w-0 px-3 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent touch-target';
  const btnClass = 'min-h-[44px] min-w-[44px] px-3 rounded-xl text-sm font-semibold uppercase disabled:opacity-60 flex items-center justify-center gap-1.5 flex-shrink-0 touch-target';

  const content = (
    <div className="flex flex-col gap-3 p-4">
      {/* Riga 1: Nome + orari (o solo nome se read-only) */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="font-semibold text-slate-800 text-sm">{user?.first_name ?? '-'}</span>
        {canEdit ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{t.start}</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => {
                const v = e.target.value.slice(0, 5);
                setStartTime(v);
                if (v === '10:00' && !endTime) setEndTime('16:00');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (multiEditMode && onConfirmAndNext) {
                    const st = toHHmm(startTime) || shift.start_time || '';
                    const et = toHHmm(endTime);
                    if (!hasShiftConflictSameDay(otherShiftsSameDay, { start_time: st, end_time: et }, shift.id)) {
                      onConfirmAndNext({ start_time: st, end_time: et, deduct_break: deductBreak });
                    } else showError(t.shift_conflict_same_day);
                  } else if (hasChanges) {
                    void handleSave();
                  }
                }
              }}
              className={timeInputClass}
              style={{ maxWidth: '120px' }}
            />
            <span className="text-slate-400 text-sm flex-shrink-0">–</span>
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{t.end}</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value.slice(0, 5))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (multiEditMode && onConfirmAndNext) {
                    const st = toHHmm(startTime) || shift.start_time || '';
                    const et = toHHmm(endTime);
                    if (!hasShiftConflictSameDay(otherShiftsSameDay, { start_time: st, end_time: et }, shift.id)) {
                      onConfirmAndNext({ start_time: st, end_time: et, deduct_break: deductBreak });
                    } else showError(t.shift_conflict_same_day);
                  } else if (hasChanges) {
                    void handleSave();
                  }
                }
              }}
              className={timeInputClass}
              style={{ maxWidth: '120px' }}
            />
          </div>
        ) : (
          <span className="text-slate-800 text-sm font-semibold">{(startTime || '--:--')} – {(endTime || '___')}</span>
        )}
      </div>

      {/* Riga 2: Pausa + ore + azioni */}
      <div className="flex flex-wrap items-center gap-3">
        {canEdit && (
          <label className="flex items-center gap-2 cursor-pointer min-h-[44px] touch-target">
            <input
              type="checkbox"
              checked={deductBreak}
              onChange={(e) => setDeductBreak(e.target.checked)}
              className="w-5 h-5 rounded-xl border-slate-300 text-accent focus:ring-accent/30"
            />
            <span className="text-sm font-medium text-slate-600">{t.deduct_break_label}</span>
          </label>
        )}
        {lStart && lEnd && (
          <span className="text-sm text-accent font-semibold">{formatMinutesToHoursAndMinutes(lNet)}</span>
        )}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {canConfirmEntry && (
            <button
              type="button"
              onClick={handleConfirmEntry}
              disabled={confirming}
              className={`${btnClass} bg-accent text-white hover:bg-accent-hover`}
              title={t.confirm_entry}
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t.confirm_entry}
            </button>
          )}
          {multiEditMode && onConfirmAndNext && (
            <button
              type="button"
              onClick={() => {
                const st = toHHmm(startTime) || shift.start_time || '';
                const et = toHHmm(endTime);
                if (hasShiftConflictSameDay(otherShiftsSameDay, { start_time: st, end_time: et }, shift.id)) {
                  showError(t.shift_conflict_same_day);
                  return;
                }
                onConfirmAndNext({ start_time: st, end_time: et, deduct_break: deductBreak });
              }}
              className={`${btnClass} bg-accent text-white hover:bg-accent-hover`}
              title={t.confirm_and_next}
            >
              {t.confirm_and_next}
            </button>
          )}
          {!multiEditMode && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`${btnClass} ${
                isPublished ? 'bg-slate-400 text-white hover:bg-slate-500' : 'bg-amber-500 text-white hover:bg-amber-400'
              }`}
              title={t.save}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {t.save}
            </button>
          )}
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 touch-target"
              title={t.close}
            >
              <X className="w-5 h-5 text-slate-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-slate-600">{t.close}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
  return embedded ? (
    <div className="bg-slate-50/80 border-t border-slate-100">{content}</div>
  ) : (
    <div className="rounded-xl shadow-lg bg-white border border-slate-200">{content}</div>
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
  const { users, addShift, showSuccess, effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);
  const rawDefault = (defaultTime || '').trim().slice(0, 5);
  const defaultHour = rawDefault ? parseInt(rawDefault.split(':')[0], 10) : 10;
  const isEveningDefault = defaultHour >= 16;
  const [tempShifts, setTempShifts] = useState({
    start_time: isEveningDefault ? '18:00' : (rawDefault || '10:00'),
    end_time: isEveningDefault ? '23:00' : '16:00',
  });
  const [selectedDate, setSelectedDate] = useState(date);
  const [approveForPayroll, setApproveForPayroll] = useState(false);
  const [notifyEmployee, setNotifyEmployee] = useState(true);
  const [publicNote, setPublicNote] = useState('');
  const [saving, setSaving] = useState(false);

  const user = users.find((u) => u.id === userId);
  const startHour = parseInt(tempShifts.start_time.split(':')[0], 10);
  const isOpenEndShift = startHour >= 20;

  // Live duration calculation
  const durationLabel = useMemo(() => {
    const s = toHHmm(tempShifts.start_time);
    const e = toHHmm(tempShifts.end_time);
    if (!s || !e) return '--';
    const [sh, sm] = s.split(':').map(Number);
    const [eh, em] = e.split(':').map(Number);
    let raw = (eh * 60 + em) - (sh * 60 + sm);
    if (raw <= 0) raw += 1440;
    const h = Math.floor(raw / 60);
    const m = raw % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }, [tempShifts.start_time, tempShifts.end_time]);

  // Past date check for payroll approval
  const isPast = selectedDate < format(new Date(), 'yyyy-MM-dd');

  const handleSave = async () => {
    const startNorm = toHHmm(tempShifts.start_time);
    if (!startNorm) return;
    const effectiveEnd = toHHmm(tempShifts.end_time) || '23:00';
    if (!isOpenEndShift && !effectiveEnd) return;
    if (!isOpenShift && hasShiftConflictSameDay(existingShifts, { start_time: startNorm, end_time: effectiveEnd })) {
      showError(t.shift_conflict_same_day);
      return;
    }
    const shiftType: 'lunch' | 'dinner' = startHour < 17 ? 'lunch' : 'dinner';

    const buildNotes = (pubNote: string) => {
      const base = pubNote.trim();
      if (isOpenShift) return base ? `__OPEN__:${base}` : '__OPEN__';
      return base || undefined;
    };

    const status: ApprovalStatus = approveForPayroll && isPast ? 'approved' : notifyEmployee ? 'confirmed' : 'draft';

    setSaving(true);
    const payload: Parameters<typeof addShift>[0] = {
      user_id: userId,
      date: selectedDate,
      start_time: startNorm,
      end_time: effectiveEnd,
      type: shiftType,
      approval_status: status,
      notes: buildNotes(publicNote),
    };
    await addShift(payload);
    setSaving(false);
    showSuccess?.(t.shift_created);
    onClose();
  };

  const inputClass = 'w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-colors font-sans font-semibold text-sm';
  const labelClass = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 font-sans';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.form
          initial={{ scale: 0.92, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 400 }}
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => { e.preventDefault(); handleSave(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden font-sans"
        >
          {/* ── Header ── */}
          <div className={`px-5 pt-5 pb-4 flex items-start justify-between gap-3 ${isOpenShift ? 'bg-amber-50' : ''}`}>
            <div className="min-w-0">
              <h2 className={`font-bold text-base font-sans leading-tight ${isOpenShift ? 'text-amber-800' : 'text-slate-900'}`}>
                {isOpenShift ? t.open_shift : t.new_shift}
              </h2>
              <p className="text-slate-400 text-xs mt-0.5 font-sans">
                {!isOpenShift && user && <><span className="font-semibold text-slate-600">{user.first_name}</span> · </>}
                {format(parseISO(selectedDate), 'EEEE d MMM', { locale: getDateLocale(effectiveLanguage) ?? it })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Live duration badge */}
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                <Clock className="w-3 h-3" />
                {durationLabel}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 transition-colors hover:bg-slate-200"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="px-5 pb-5 space-y-4">
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
                <input
                  type="time"
                  value={tempShifts.start_time}
                  onChange={(e) => setTempShifts((s) => ({ ...s, start_time: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t.end_time}</label>
                {isOpenEndShift ? (
                  <p className="text-slate-400 text-xs pt-2.5 font-sans">{t.manual_close_dinner}</p>
                ) : (
                  <input
                    type="time"
                    value={tempShifts.end_time}
                    onChange={(e) => setTempShifts((s) => ({ ...s, end_time: e.target.value }))}
                    className={inputClass}
                  />
                )}
              </div>
            </div>

            {/* ── Note pubblica ── */}
            <div>
              <label className={labelClass}>{t.notes_label} <span className="font-normal normal-case tracking-normal text-slate-400">{t.notes_optional_paren}</span></label>
              <input
                type="text"
                value={publicNote}
                onChange={(e) => setPublicNote(e.target.value)}
                placeholder={t.notes_placeholder_staff}
                className={inputClass}
              />
            </div>

            {/* ── Separator ── */}
            <div className="border-t border-slate-100" />

            {/* ── Approvato per libro paga ── */}
            <label className={`flex items-start gap-3 cursor-pointer group ${!isPast ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={approveForPayroll}
                  onChange={(e) => setApproveForPayroll(e.target.checked)}
                  disabled={!isPast}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 rounded-full bg-slate-200 peer-checked:bg-accent transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 leading-tight">Approvato per libro paga</p>
                <p className="text-xs text-slate-400 mt-0.5">{isPast ? t.shift_will_be_approved_past : t.shift_payroll_only_past}</p>
              </div>
            </label>

            {/* ── Avvisa il dipendente ── */}
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={notifyEmployee}
                  onChange={(e) => setNotifyEmployee(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 rounded-full bg-slate-200 peer-checked:bg-accent transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 leading-tight">Avvisa il dipendente</p>
                <p className="text-xs text-slate-400 mt-0.5">{t.shift_visible_after_publish}</p>
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
              <button type="button" onClick={onClose} className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors font-sans">
                {t.cancel}
              </button>
            </div>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  );
}

export { ShiftEditPanel };
