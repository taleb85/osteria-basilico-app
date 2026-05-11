import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays, AlertTriangle, Check, Lock, Plus, Clock,
  ChevronLeft, ChevronRight, Copy, Send, Filter, Info, FileDown,
  Trash2, Save, X, ShieldAlert, ChevronDown, RotateCw, Unlock,
} from 'lucide-react';
import type { Shift, PunchRecord, User } from '../types';
import type { BreakRule } from '../utils/breakRules';
import {
  format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, parseISO,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { getTranslations, getDateLocale } from '../utils/translations';
import { formatMinutesToHoursAndMinutes, calculateShiftMinutesGross } from '../utils/timeCalculations';
import { getBreakMinutesForShift, getNetShiftMinutes, DEFAULT_AUTO_BREAK_MINUTES, AUTO_BREAK_THRESHOLD_MINUTES } from '../utils/breakRules';
import { shiftPastPlannedEndWithoutClockIn } from '../utils/shiftResolvedClockTimes';
import { exportSchedulePDF } from '../utils/exportSchedulePDF';
import { TimeInputField } from './ui/TimeInputField';
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

export type GridMode = 'planning' | 'realtime' | 'comparison';
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
  netMinutes: number;
  violations?: ReturnType<typeof getShiftViolations>;
}

function isFrozen(shift: Shift) {
  return (shift as any).approval_status === 'approved' || ((shift as any).approval_status === 'confirmed' && !!(shift as any).approved_at);
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
    addPunchRecord, addShift, updateShift, featureFlags,
  } = useApp();
  const locale = getDateLocale(effectiveLanguage) ?? it;
  const today = new Date();
  const canEdit = currentUser ? canEditTeamShifts(currentUser) : false;
  const canPublish = currentUser ? canPublishScheduleDrafts(currentUser) : false;
  const canApprove = currentUser ? canApproveShiftActions(currentUser) : false;
  const isMgmt = currentUser ? isManagementRole(currentUser.role) : false;
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

  const togglePeriodPopover = useCallback(() => {
    setShowPeriodPopover(prev => {
      if (!prev && periodTriggerRef.current) {
        const rect = periodTriggerRef.current.getBoundingClientRect();
        setPeriodPopoverStyle({ top: rect.bottom + 6, left: rect.left + rect.width / 2 });
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

  // ── Department filter ──
  const [deptFilter, setDeptFilter] = useState<string | null>(null);

  // ── Selection / Bulk edit ──
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditStatus, setBulkEditStatus] = useState<string>('');

  // ── Template state ──
  const [templatesList, setTemplatesList] = useState<string[]>([]);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

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

  function getPunchForShift(shift: Shift) {
    const exact = weekPunchRecords.filter(pr => pr.shift_id === shift.id);
    if (exact.length > 0) {
      const sorted = [...exact].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return { in: sorted.find(p => p.type === 'in'), out: [...sorted].reverse().find(p => p.type === 'out') };
    }
    const fallback = weekPunchRecords.filter(
      pr => !pr.shift_id && pr.user_id === shift.user_id && pr.timestamp?.startsWith(shift.date)
    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return { in: fallback.find(p => p.type === 'in'), out: [...fallback].reverse().find(p => p.type === 'out') };
  }

  function getDayGroup(userId: string, dateStr: string): DayShiftGroup[] {
    return weekShifts.filter(s => s.user_id === userId && s.date === dateStr).map(shift => {
      const { in: punchIn, out: punchOut } = getPunchForShift(shift);
      const plannedMins = calculateShiftMinutesGross(shift.start_time ?? '', shift.end_time ?? '');
      const actualMins = punchIn && punchOut
        ? (new Date(punchOut.timestamp).getTime() - new Date(punchIn.timestamp).getTime()) / 60000 : 0;
      const breakMins = getBreakMinutesForShift(shift, plannedMins, null, breakRules);
      const actualBreakMins = getBreakMinutesForShift(shift, Math.round(actualMins), null, breakRules);
      const actualNet = Math.max(0, Math.round(actualMins) - actualBreakMins);
      const plannedNet = Math.max(0, plannedMins - breakMins);
      const violations = violationChromeEnabled ? getShiftViolations(shift, weekShifts, effectiveWorkRules, breakRules, allPunchRecords) : undefined;
      return {
        shift, punchIn, punchOut, actualMinutes: actualNet, deltaMinutes: actualNet - plannedNet,
        isAbsent: shift.approval_status === 'absent', isMissingPunch: !punchIn && shiftPastPlannedEndWithoutClockIn(shift, allPunchRecords),
        breakMinutes: breakMins, netMinutes: plannedNet, violations,
      };
    }).sort((a, b) => {
      const startA = a.shift.start_time?.slice(0, 5) ?? '00:00';
      const startB = b.shift.start_time?.slice(0, 5) ?? '00:00';
      const pre16A = startA < '16:00' ? 0 : 1;
      const pre16B = startB < '16:00' ? 0 : 1;
      if (pre16A !== pre16B) return pre16A - pre16B;
      return startA.localeCompare(startB);
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

  const handleDeleteShift = useCallback(async (shift: Shift) => {
    if (!confirm(t.confirm_delete_shift ?? 'Eliminare questo turno?')) return;
    try { await deleteShift(shift.id); showSuccess(t.shift_deleted ?? 'Turno eliminato.'); setDrawerOpen(false); }
    catch { showError(t.error_generic ?? 'Errore.'); }
  }, [deleteShift, showSuccess, showError, t]);

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
      if (editIn) {
        await addPunchRecord(shift.user_id, 'in', {
          shift_id: shift.id,
          timestamp: `${punchDate}T${editIn}:00`,
          source: 'manual',
        });
      }
      if (editOut) {
        await addPunchRecord(shift.user_id, 'out', {
          shift_id: shift.id,
          timestamp: `${punchDate}T${editOut}:00`,
          source: 'manual',
        });
      }
      showSuccess(t.punch_saved ?? 'Timbratura salvata.');
      setEditIn(''); setEditOut('');
    } catch { showError(t.error_generic ?? 'Errore.'); }
    finally { setSaving(false); }
  }, [selectedShift, editIn, editOut, addPunchRecord, showSuccess, showError, t]);

  const handleCreateShift = useCallback(async () => {
    if (!createModal) return;
    setSaving(true);
    try {
      await addShift({
        user_id: createModal.userId, date: createModal.date,
        start_time: createStart + ':00', end_time: createEnd + ':00',
        type: 'lunch' as const, approval_status: 'draft' as const,
        department: users.find(u => u.id === createModal.userId)?.department ?? null,
      });
      showSuccess(t.shift_created ?? 'Turno creato.'); setCreateModal(null);
    } catch { showError(t.error_generic ?? 'Errore.'); }
    finally { setSaving(false); }
  }, [createModal, createStart, createEnd, addShift, showSuccess, showError, t, users]);

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
      await database.shiftTemplates.save(saveTemplateName.trim(), weekStart, weekShifts);
      const list = await database.shiftTemplates.listAll?.() ?? [];
      if (Array.isArray(list)) setTemplatesList(list);
      setSaveTemplateName(''); setShowTemplateMenu(false);
      showSuccess(t.template_saved ?? 'Template salvato.');
    } catch { showError(t.error_generic ?? 'Errore.'); }
    finally { setSavingTemplate(false); }
  }, [saveTemplateName, weekStart, weekShifts, showSuccess, showError, t]);

  const handleApplyTemplate = useCallback(async (name: string) => {
    if (!database.shiftTemplates?.load) return;
    try {
      const loaded = (await database.shiftTemplates.load(name)) as any[];
      if (Array.isArray(loaded)) {
        for (const s of loaded) {
          await addShift({ ...s, id: undefined, date: weekDateStrings[0] });
        }
        showSuccess(t.template_applied ?? 'Template applicato.');
      }
    } catch { showError(t.error_generic ?? 'Errore.'); }
  }, [addShift, weekDateStrings, showSuccess, showError, t]);

  const handleOpenDrawer = useCallback((shift: Shift) => {
    const u = users.find(us => us.id === shift.user_id) ?? null;
    const { in: punchIn, out: punchOut } = getPunchForShift(shift);
    setSelectedShift(shift); setSelectedUser(u);
    setDetailTab('details');
    setEditStartTime(String(shift.start_time ?? '').slice(0, 5));
    setEditEndTime(String(shift.end_time ?? '').slice(0, 5));
    setEditIn(punchIn ? punchIn.timestamp?.slice(11, 16) ?? '' : String(shift.start_time ?? '').slice(0, 5));
    setEditOut(punchOut ? punchOut.timestamp?.slice(11, 16) ?? '' : String(shift.end_time ?? '').slice(0, 5));
    setDeductBreak(shift.deduct_break !== false);
    setIsAutoBreak(shift.is_auto_break !== false);
    setDrawerOpen(true);
  }, [users, weekPunchRecords]);

  return (
    <div className="w-full font-sans">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={prevWeek}
            className="rounded-lg bg-white/10 px-2 py-1.5 text-white/60 hover:text-white transition-colors"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={goToday}
            className="rounded-lg bg-white/10 px-2.5 py-1.5 text-white/60 hover:text-white transition-colors text-[11px] font-bold uppercase tracking-wider">{t.today_btn ?? 'Oggi'}</button>
          <button type="button" onClick={nextWeek}
            className="rounded-lg bg-white/10 px-2 py-1.5 text-white/60 hover:text-white transition-colors"><ChevronRight className="h-3.5 w-3.5" /></button>
          <span className="text-sm font-semibold text-white/50 min-w-[180px] tabular-nums ml-0.5">
            {format(weekStart, 'd MMM', { locale })} — {format(weekEnd, 'd MMM yyyy', { locale })}
          </span>
        </div>

        {/* Right: filtri + azioni */}
        <div className="flex items-center gap-2">
          {departments.length > 1 && (
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-white/40" />
              <select value={deptFilter ?? ''} onChange={e => setDeptFilter(e.target.value || null)}
                className="bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] font-bold text-white/70 uppercase tracking-wider outline-none">
                <option value="">{t.department_filter_all ?? 'Tutti'}</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5">
            <button type="button" onClick={() => setViewMode('week')}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'week' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}>{t.view_week ?? 'Sett.'}</button>
            <button type="button" onClick={() => setViewMode('period')}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'period' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}>{t.view_period ?? 'Periodo'}</button>
          </div>
          <button ref={periodTriggerRef} type="button" onClick={togglePeriodPopover}
            className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-white/50 hover:text-white transition-colors uppercase tracking-wider">
            <CalendarDays className="h-3 w-3" />
            {format(periodStart, 'd MMM', { locale })} — {format(periodEnd, 'd MMM', { locale })}
            <ChevronDown className="h-3 w-3 ml-0.5" />
          </button>

          {/* Undo */}
          {false && (
            <button type="button"
              className="rounded-lg bg-white/10 px-2 py-1.5 text-white/40 text-[10px] font-bold uppercase tracking-wider">
              <RotateCw className="h-3 w-3" />
            </button>
          )}

          <span className="w-px h-5 bg-white/10" />
          {isMgmt && (
            <>
              <button type="button" onClick={handleCopyWeek}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/60 hover:text-white transition-colors uppercase tracking-wider">
                <Copy className="h-3 w-3" />{t.copy_week ?? 'Copia'}
              </button>
              <button type="button" onClick={handlePublishWeek}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/30 transition-colors uppercase tracking-wider">
                <Send className="h-3 w-3" />{t.publish_week ?? 'Pubblica'}
              </button>
            </>
          )}
          <button type="button" onClick={handleExportPdf}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/60 hover:text-white transition-colors uppercase tracking-wider">
            <FileDown className="h-3 w-3" />PDF
          </button>

          {/* Template button */}
          {canEdit && (
            <div className="relative">
              <button type="button" onClick={() => setShowTemplateMenu(o => !o)}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/60 hover:text-white transition-colors uppercase tracking-wider">
                {t.templates ?? 'Template'} <ChevronDown className="h-3 w-3 ml-0.5" />
              </button>
              {showTemplateMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-white/10 p-3 w-52 shadow-2xl" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
                  <div className="flex items-center gap-1 mb-2">
                    <input value={saveTemplateName} onChange={e => setSaveTemplateName(e.target.value)} placeholder={t.save_current_as ?? 'Salva come...'}
                      className="flex-1 bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-bold text-white outline-none placeholder:text-white/30" />
                    <button type="button" onClick={handleSaveTemplate}
                      className="rounded-lg bg-accent px-2 py-1 text-[10px] font-bold text-white">
                      <Save className="h-3 w-3" />
                    </button>
                  </div>
                  {templatesList.map(name => (
                    <div key={name} className="flex items-center justify-between py-1 border-b border-white/10 last:border-0">
                      <button type="button" onClick={() => handleApplyTemplate(name)}
                        className="text-[11px] font-bold text-white/70 hover:text-white truncate flex-1 text-left">{name}</button>
                    </div>
                  ))}
                  {templatesList.length === 0 && (
                    <p className="text-[10px] text-white/40 text-center py-2">{t.no_templates ?? 'Nessun template'}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Period Popover ── */}
      {showPeriodPopover && createPortal(
          <div ref={periodPopoverRef}
            className="fixed z-[10050] mt-1 rounded-2xl border border-white/10 p-4 w-[340px]"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', top: periodPopoverStyle.top, left: periodPopoverStyle.left, transform: 'translateX(-50%)' }}>
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setPeriodPopoverYear(y => y - 1)}
              className="rounded-lg bg-white/10 px-2 py-1 text-white/60 hover:text-white transition-colors"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <span className="text-sm font-bold text-white">{periodPopoverYear}</span>
            <button type="button" onClick={() => setPeriodPopoverYear(y => y + 1)}
              className="rounded-lg bg-white/10 px-2 py-1 text-white/60 hover:text-white transition-colors"><ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
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

      {/* ── Legend ── */}
      <div className="mb-2 flex items-center gap-4 text-[10px] text-white/40">
        {/* Left: legend items */}
        <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-dashed border-blue-500/60" /> {t.shift_draft ?? 'Draft'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-solid border-cyan-400/60" /> {t.shift_published ?? 'Published'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-solid border-emerald-400/60" /> {t.shift_approved ?? 'Approved'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-solid border-amber-400/60" /> {t.shift_missing_punch ?? 'No entry'}</span>
        <Info className="h-3 w-3 text-white/30" /> {t.hours_net_after_break ?? 'Ore nette dopo pausa'}

        {/* Right: selection + template actions */}
        <span className="ml-auto flex items-center gap-2">
          {selectedShiftIds.size > 0 && (
            <>
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
              <button type="button" onClick={() => { selectedShiftIds.forEach(id => { const s = allShifts.find(x => x.id === id); if (s && !isFrozen(s)) deleteShift(id).catch(() => {}); }); setSelectedShiftIds(new Set()); }}
                className="rounded-lg bg-rose-600/20 px-2.5 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-600/30 transition-colors uppercase tracking-wider">
                <Trash2 className="h-3 w-3 inline-block mr-0.5" />{t.delete ?? 'Elimina'}
              </button>
            </>
          )}
        </span>
      </div>

      {/* ── Grid ── */}
      <div className="overflow-x-auto rounded-2xl border border-white/10" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
        <table className="w-full min-w-[720px] table-fixed border-collapse">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 bg-transparent text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/50 border-b border-white/10" style={{ width: 160, minWidth: 160 }}>
                {t.employee ?? 'Dipendente'}
              </th>
              {weekDays.map((day, i) => (
                <th key={i} className={`px-2 py-2.5 text-center border-b border-white/10 ${isToday(day) ? 'bg-accent/10' : 'bg-transparent'}`} style={{ width: 130, minWidth: 110 }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">{format(day, 'EEE', { locale })}</div>
                  <div className={`text-sm font-black ${isToday(day) ? 'text-accent' : 'text-white/80'}`}>{format(day, 'd')}</div>
                </th>
              ))}
              <th className="px-2 py-2.5 text-center border-b border-white/10 bg-transparent" style={{ width: 90, minWidth: 80 }}>
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
                  <td className="sticky left-0 z-10 bg-transparent px-3 py-2 border-b border-white/5" style={{ width: 160, minWidth: 160 }}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">{user.first_name} {user.last_name?.[0] ?? ''}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] font-semibold text-white/40 tabular-nums">{formatMinutesToHoursAndMinutes(totalNet)}P</span>
                      <span className="text-[10px] font-semibold text-white/40">/</span>
                      <span className={`text-[10px] font-bold tabular-nums ${totalActual > totalNet ? 'text-accent' : 'text-emerald-400'}`}>{formatMinutesToHoursAndMinutes(totalActual)}E</span>
                    </div>
                  </td>
                  {weekDays.map((day, dIdx) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const groups = getDayGroup(user.id, dateStr);
                    return (
                      <td key={dIdx} className={`px-1.5 py-1 border-b border-white/5 align-top ${isToday(day) ? 'bg-accent/[0.04]' : ''}`}>
                        {groups.length === 0 ? (
                          <div className="flex items-center justify-center h-full min-h-[48px]">
                            {canEdit ? (
                              <button type="button" onClick={() => setCreateModal({ userId: user.id, date: dateStr })}
                                className="rounded-lg border border-dashed border-white/20 px-3 py-2 text-[10px] font-bold text-white/30 hover:text-white/60 hover:border-white/40 transition-all">
                                <Plus className="h-3 w-3 inline-block mr-1" />{t.add_shift ?? 'Aggiungi'}
                              </button>
                            ) : (
                              <span className="text-[10px] text-white/20 font-medium">&mdash;</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {groups.map((g, gIdx) => {
                              const isDraft = g.shift.approval_status === 'draft';
                              const isApproved = g.shift.approval_status === 'approved';
                              const isConfirmed = g.shift.approval_status === 'confirmed';
                              let borderColor = 'border-l-cyan-400/70';
                              let bgColor = 'bg-white/[0.06]';
                              let glow = '';
                              if (isDraft) { borderColor = 'border-l-blue-500/50'; bgColor = 'bg-white/[0.03]'; }
                              if (isApproved) { borderColor = 'border-l-emerald-400'; bgColor = 'bg-emerald-500/10'; }
                              if (g.isAbsent) { borderColor = 'border-l-rose-400/60'; bgColor = 'bg-rose-500/10'; }
                              if (g.isMissingPunch) { borderColor = 'border-l-amber-400'; bgColor = 'bg-amber-500/10'; }
                              if (g.violations?.length && g.violations.length > 0) glow = 'ring-1 ring-rose-400/40';
                              return (
                                <button key={gIdx} type="button" onClick={() => handleOpenDrawer(g.shift)}
                                  onContextMenu={(e) => { e.preventDefault(); handleDeleteShift(g.shift); }}
                                  className={`w-full text-left rounded-lg border-l-[3px] ${borderColor} ${bgColor} ${glow} px-2 py-1.5 hover:brightness-125 transition-all ${isDraft ? 'border-dashed opacity-60' : ''}`}>
                                  <div className="flex items-center gap-1.5">
                                    <input type="checkbox" checked={selectedShiftIds.has(g.shift.id)} onChange={() => setSelectedShiftIds(prev => { const n = new Set(prev); n.has(g.shift.id) ? n.delete(g.shift.id) : n.add(g.shift.id); return n; })}
                                      className="w-3 h-3 rounded border-white/30 accent-accent shrink-0" onClick={e => e.stopPropagation()} />
                                    <span className={`text-[11px] font-bold tabular-nums flex-1 ${g.isAbsent ? 'text-rose-400 line-through' : 'text-white'}`}>
                                      {g.shift.start_time?.slice(0, 5) || '--'}-{g.shift.end_time?.slice(0, 5) || '--'}
                                    </span>
                                    <div className="flex items-center gap-0.5">
                                      {isFrozen(g.shift) ? <Lock className="h-2.5 w-2.5 text-amber-400" /> : isApproved ? <Lock className="h-2.5 w-2.5 text-emerald-400" /> : null}
                                      {isConfirmed && <Check className="h-2.5 w-2.5 text-cyan-300" />}
                                      {g.isMissingPunch && <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />}
                                    </div>
                                  </div>
                                  {(mode === 'realtime' || mode === 'comparison') && g.punchIn && (
                                    <div className="flex items-center justify-between mt-0.5 ml-6">
                                      <span className="text-[10px] font-medium text-white/50 tabular-nums">
                                        {g.punchIn.timestamp?.slice(11, 16)}{g.punchOut ? `-${g.punchOut.timestamp?.slice(11, 16)}` : ' →'}
                                      </span>
                                      {mode === 'comparison' && g.punchOut && (
                                        <span className={`text-[9px] font-bold tabular-nums ${g.deltaMinutes > 15 ? 'text-accent' : g.deltaMinutes < -15 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                          {g.deltaMinutes > 0 ? '+' : ''}{formatMinutesToHoursAndMinutes(Math.abs(g.deltaMinutes))}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {g.breakMinutes > 0 && (
                                    <div className="mt-0.5 text-[9px] font-medium text-white/40 tabular-nums ml-6">
                                      {formatMinutesToHoursAndMinutes(g.netMinutes)}{g.breakMinutes > 0 ? ` (−${g.breakMinutes}')` : ''}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 border-b border-white/5 text-center align-middle">
                    <div className="text-xs font-bold text-white tabular-nums">{formatMinutesToHoursAndMinutes(totalActual)}</div>
                    <div className={`text-[10px] font-bold tabular-nums ${totalActual > totalNet ? 'text-accent' : 'text-emerald-400'}`}>
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
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/20 p-5 shadow-2xl max-h-[85vh] overflow-y-auto z-10" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedUser?.first_name ?? ''} {selectedUser?.last_name ?? ''}</h3>
                <p className="text-[11px] text-white/50">{format(parseISO(selectedShift.date), 'EEEE d MMMM', { locale })} — {selectedShift.start_time?.slice(0, 5)}-{selectedShift.end_time?.slice(0, 5)}</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg bg-white/10 p-2 text-white/50 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex gap-1 rounded-lg bg-white/5 p-1 mb-4">
              {(['details', 'punches', 'breaks', 'history'] as ShiftDetailTab[]).map(tab => (
                <button key={tab} type="button" onClick={() => setDetailTab(tab)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${detailTab === tab ? 'bg-accent text-white' : 'text-white/50 hover:text-white'}`}>
                  {tab === 'details' ? (t.details ?? 'Dettagli') : tab === 'punches' ? (t.punches ?? 'Timbrature') : tab === 'breaks' ? (t.break_plural ?? 'Pause') : (t.history ?? 'Storico')}
                </button>
              ))}
            </div>

            {/* Details tab */}
            {detailTab === 'details' && (
              <div className="space-y-3">
                {canEdit && !isFrozen(selectedShift) && (
                  <div className="rounded-xl bg-white/5 p-3 space-y-2">
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
                <div className="rounded-xl bg-white/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">{t.status ?? 'Stato'}</span>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${isFrozen(selectedShift) ? 'text-amber-400' : selectedShift.approval_status === 'approved' ? 'text-emerald-400' : selectedShift.approval_status === 'confirmed' ? 'text-cyan-300' : 'text-white/70'}`}>
                      {isFrozen(selectedShift) ? (t.wst_frozen_badge ?? 'Congelato') : selectedShift.approval_status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">{t.department ?? 'Reparto'}</span>
                    <span className="text-[11px] font-bold text-white">{selectedShift.department || selectedUser?.department || '—'}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canEdit && !isShiftPayrollFrozen(selectedShift) && selectedShift.approval_status === 'draft' && (
                    <button type="button" onClick={() => handleApproveShift(selectedShift)}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-2 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/30 transition-colors">
                      <Check className="h-3.5 w-3.5" />{t.approve ?? 'Approva'}
                    </button>
                  )}
                  {canEdit && !isShiftPayrollFrozen(selectedShift) && (
                    <button type="button" onClick={() => handleDeleteShift(selectedShift)}
                      className="flex items-center gap-1.5 rounded-lg bg-rose-600/20 px-3 py-2 text-[11px] font-bold text-rose-300 hover:bg-rose-600/30 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />{t.delete ?? 'Elimina'}
                    </button>
                  )}
                  {canEdit && !isShiftPayrollFrozen(selectedShift) && selectedShift.approval_status === 'confirmed' && (
                    <button type="button" onClick={() => handleFreezeShift(selectedShift)}
                      className="flex items-center gap-1.5 rounded-lg bg-amber-600/20 px-3 py-2 text-[11px] font-bold text-amber-300 hover:bg-amber-600/30 transition-colors">
                      <Lock className="h-3.5 w-3.5" />{t.wst_freeze_btn ?? 'Congela'}
                    </button>
                  )}
                  {canEdit && isShiftPayrollFrozen(selectedShift) && (
                    <button type="button" onClick={() => handleFreezeShift(selectedShift)}
                      className="flex items-center gap-1.5 rounded-lg bg-accent/20 px-3 py-2 text-[11px] font-bold text-accent hover:bg-accent/30 transition-colors">
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
                  <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">{t.status ?? 'Stato'}:</span>
                    {!hasIn && !hasOut ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400"><AlertTriangle className="h-3 w-3" />{t.not_clocked ?? 'Non timbrato'}</span>
                    ) : hasIn && !hasOut ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-accent"><Clock className="h-3 w-3" />{t.clocked_in_only ?? 'Solo entrata'}</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400"><Check className="h-3 w-3" />{t.clocked_complete ?? 'Timbratura completa'}</span>
                    )}
                  </div>
                  <div className="rounded-xl bg-white/5 p-3 space-y-3">
                    {showEditFields ? (
                      <>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">
                            {t.punch_in ?? 'Entrata'}
                            <span className="ml-2 text-[9px] text-white/30 font-normal normal-case">({t.planned ?? 'pianificato'}: {selectedShift.start_time?.slice(0, 5)})</span>
                          </label>
                          <TimeInputField value={editIn} onChange={setEditIn} size="md" onMinutesEnter={handleSaveManualPunch} className={`w-full ${hasIn ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/20 bg-white/10'}`} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">
                            {t.punch_out ?? 'Uscita'}
                            <span className="ml-2 text-[9px] text-white/30 font-normal normal-case">({t.planned ?? 'pianificato'}: {selectedShift.end_time?.slice(0, 5)})</span>
                          </label>
                          <TimeInputField value={editOut} onChange={setEditOut} size="md" onMinutesEnter={handleSaveManualPunch} className={`w-full ${hasOut ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/20 bg-white/10'}`} />
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
              const breakMins = getBreakMinutesForShift(selectedShift, grossMins, selectedUser ?? null, breakRules);
              const netMins = Math.max(0, grossMins - breakMins);
              const hasAutoBreak = grossMins >= AUTO_BREAK_THRESHOLD_MINUTES && isAutoBreak;
              return (
                <div className="space-y-3">
                  <div className="rounded-xl bg-white/5 p-3 space-y-2">
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
                  <div className="rounded-xl bg-white/5 p-3 space-y-2">
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
              <div className="rounded-xl bg-white/5 p-4 text-center">
                <p className="text-xs text-white/40">{t.history_empty ?? 'Cronologia non disponibile per questo turno.'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create Shift Modal ── */}
      {createModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setCreateModal(null)}>
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/20 p-5 shadow-2xl z-10" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }} onClick={e => e.stopPropagation()}>
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
