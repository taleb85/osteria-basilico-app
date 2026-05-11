import { useState, useCallback } from 'react';
import {
  Calendar, Clock, BarChart3, AlertTriangle, Check, Lock, Plus,
  ChevronLeft, ChevronRight, Copy, Send, Filter,
  Trash2, Save, X, ShieldAlert,
} from 'lucide-react';
import type { Shift, PunchRecord, User } from '../types';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { getTranslations, getDateLocale } from '../utils/translations';
import { formatMinutesToHoursAndMinutes, calculateShiftMinutesGross } from '../utils/timeCalculations';
import { shiftPastPlannedEndWithoutClockIn } from '../utils/shiftResolvedClockTimes';
import { useApp } from '../context/AppContext';
import { isManagementRole, canEditTeamShifts } from '../utils/permissions';

export type GridMode = 'planning' | 'realtime' | 'comparison';

interface UnifiedShiftGridProps {
  mode: GridMode;
  onModeChange: (mode: GridMode) => void;
  filterUserId?: string;
}

interface DayShiftGroup {
  shift: Shift;
  punchIn?: PunchRecord;
  punchOut?: PunchRecord;
  actualMinutes: number;
  deltaMinutes: number;
  isAbsent: boolean;
  isMissingPunch: boolean;
}

type ShiftDetailTab = 'details' | 'punches' | 'history';

export default function UnifiedShiftGrid({ mode, onModeChange, filterUserId }: UnifiedShiftGridProps) {
  const t = useT();
  const {
    currentUser, users, shifts: allShifts, punchRecords: allPunchRecords,
    effectiveLanguage, showSuccess, showError,
    deleteShift, approveShift, bulkCopyPreviousWeek, publishWeekShifts,
    addPunchRecord, addShift,
  } = useApp();
  const locale = getDateLocale(effectiveLanguage) ?? it;

  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const canEdit = currentUser ? canEditTeamShifts(currentUser) : false;
  const isMgmt = currentUser ? isManagementRole(currentUser.role) : false;

  // ── Detail drawer state ──
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<ShiftDetailTab>('details');

  // ── Create shift modal state ──
  const [createModal, setCreateModal] = useState<{ userId: string; date: string; defaultTime: string } | null>(null);
  const [createStart, setCreateStart] = useState('10:00');
  const [createEnd, setCreateEnd] = useState('16:00');

  // ── Manual punch edit state ──
  const [editIn, setEditIn] = useState('');
  const [editOut, setEditOut] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Department filter ──
  const [deptFilter, setDeptFilter] = useState<string | null>(null);

  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));
  const goToday = () => setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));

  const visibleUsers = filterUserId
    ? users.filter(u => u.id === filterUserId)
    : users.filter(u => u.status === 'active')
      .filter(u => !deptFilter || u.department === deptFilter);

  const weekDateStrings = weekDays.map(d => format(d, 'yyyy-MM-dd'));

  const weekShifts = allShifts.filter(s =>
    weekDateStrings.includes(s.date) &&
    (!filterUserId || s.user_id === filterUserId)
  );
  const weekPunchRecords = allPunchRecords.filter(pr =>
    weekDateStrings.some(ds => pr.timestamp?.startsWith(ds))
  );

  const departments = [...new Set(users.filter(u => u.department).map(u => u.department as string))];

  const MODES: { key: GridMode; icon: React.ReactNode; label: string }[] = [
    { key: 'planning', icon: <Calendar className="h-3.5 w-3.5" />, label: t.tab_planning ?? 'Planning' },
    { key: 'realtime', icon: <Clock className="h-3.5 w-3.5" />, label: t.tab_realtime ?? 'Real-time' },
    { key: 'comparison', icon: <BarChart3 className="h-3.5 w-3.5" />, label: t.tab_comparison ?? 'Confronto' },
  ];

  function getPunchForShift(shift: Shift) {
    const sp = weekPunchRecords.filter(
      pr => pr.shift_id === shift.id || (pr.user_id === shift.user_id && pr.timestamp?.startsWith(shift.date))
    ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return { in: sp.find(p => p.type === 'in'), out: sp.findLast(p => p.type === 'out') };
  }

  function getDayGroup(userId: string, dateStr: string): DayShiftGroup[] {
    return weekShifts.filter(s => s.user_id === userId && s.date === dateStr).map(shift => {
      const { in: punchIn, out: punchOut } = getPunchForShift(shift);
      const plannedMins = calculateShiftMinutesGross(shift.start_time ?? '', shift.end_time ?? '');
      const actualMins = punchIn && punchOut
        ? (new Date(punchOut.timestamp).getTime() - new Date(punchIn.timestamp).getTime()) / 60000
        : 0;
      return {
        shift, punchIn, punchOut,
        actualMinutes: Math.round(actualMins),
        deltaMinutes: Math.round(actualMins - plannedMins),
        isAbsent: shift.approval_status === 'absent',
        isMissingPunch: !punchIn && shiftPastPlannedEndWithoutClockIn(shift, allPunchRecords),
      };
    });
  }

  function getTotalPlanned(userId: string) {
    return weekDateStrings.reduce((acc, ds) => {
      const groups = getDayGroup(userId, ds);
      return acc + groups.reduce((s, g) => s + calculateShiftMinutesGross(g.shift.start_time ?? '', g.shift.end_time ?? ''), 0);
    }, 0);
  }
  function getTotalActual(userId: string) {
    return weekDateStrings.reduce((acc, ds) => {
      const groups = getDayGroup(userId, ds);
      return acc + groups.reduce((s, g) => s + g.actualMinutes, 0);
    }, 0);
  }

  // ── Actions ──
  const handlePublishWeek = useCallback(async () => {
    if (!confirm(t.confirm_publish_week ?? 'Pubblicare tutti i turni della settimana?')) return;
    try { await publishWeekShifts(weekStart); showSuccess(t.week_published ?? 'Settimana pubblicata.'); }
    catch { showError(t.error_generic ?? 'Errore durante la pubblicazione.'); }
  }, [publishWeekShifts, weekStart, showSuccess, showError, t]);

  const handleCopyWeek = useCallback(async () => {
    try {
      const n = await bulkCopyPreviousWeek(weekStart);
      showSuccess(n > 0 ? (t.copied_n_shifts ?? '{n} turni copiati.').replace('{n}', String(n)) : (t.no_shifts_to_copy ?? 'Nessun turno da copiare.'));
    } catch { showError(t.error_generic ?? 'Errore durante la copia.'); }
  }, [bulkCopyPreviousWeek, weekStart, showSuccess, showError, t]);

  const handleDeleteShift = useCallback(async (shift: Shift) => {
    if (!confirm(t.confirm_delete_shift ?? 'Eliminare questo turno?')) return;
    try { await deleteShift(shift.id); showSuccess(t.shift_deleted ?? 'Turno eliminato.'); setDrawerOpen(false); }
    catch { showError(t.error_generic ?? 'Errore.'); }
  }, [deleteShift, showSuccess, showError, t]);

  const handleApproveShift = useCallback(async (shift: Shift) => {
    try { await approveShift(shift.id, { approvedStart: shift.start_time, approvedEnd: shift.end_time }); showSuccess(t.shift_approved ?? 'Turno approvato.'); }
    catch { showError(t.error_generic ?? 'Errore.'); }
  }, [approveShift, showSuccess, showError, t]);

  const handleSaveManualPunch = useCallback(async () => {
    if (!selectedShift) return;
    setSaving(true);
    try {
      const shift = selectedShift;
      const todayStr = new Date().toISOString().slice(0, 10);
      const punchDate = shift.date <= todayStr ? shift.date : todayStr;

      if (editIn) {
        const ts = `${punchDate}T${editIn}:00`;
        await addPunchRecord({
          id: shift.id + '_in_' + Date.now(),
          user_id: shift.user_id,
          shift_id: shift.id,
          timestamp: ts,
          type: 'in',
          source: 'manual',
        });
      }
      if (editOut) {
        const ts = `${punchDate}T${editOut}:00`;
        await addPunchRecord({
          id: shift.id + '_out_' + Date.now(),
          user_id: shift.user_id,
          shift_id: shift.id,
          timestamp: ts,
          type: 'out',
          source: 'manual',
        });
      }
      showSuccess(t.punch_saved ?? 'Timbratura salvata.');
      setEditIn('');
      setEditOut('');
    } catch { showError(t.error_generic ?? 'Errore.'); }
    finally { setSaving(false); }
  }, [selectedShift, editIn, editOut, addPunchRecord, showSuccess, showError, t]);

  const handleCreateShift = useCallback(async () => {
    if (!createModal) return;
    setSaving(true);
    try {
      await addShift({
        user_id: createModal.userId,
        date: createModal.date,
        start_time: createStart + ':00',
        end_time: createEnd + ':00',
        type: 'lunch',
        approval_status: 'draft',
        department: users.find(u => u.id === createModal.userId)?.department ?? null,
      });
      showSuccess(t.shift_created ?? 'Turno creato.');
      setCreateModal(null);
    } catch { showError(t.error_generic ?? 'Errore.'); }
    finally { setSaving(false); }
  }, [createModal, createStart, createEnd, addShift, showSuccess, showError, t, users]);

  const handleOpenDrawer = useCallback((shift: Shift) => {
    const u = users.find(us => us.id === shift.user_id) ?? null;
    setSelectedShift(shift);
    setSelectedUser(u);
    setDetailTab('details');
    setEditIn('');
    setEditOut('');
    setDrawerOpen(true);
  }, [users]);

  // ── Render ──
  return (
    <div className="w-full font-sans">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        {/* Mode tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
          {MODES.map(m => (
            <button key={m.key} type="button" onClick={() => onModeChange(m.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                mode === m.key ? 'bg-accent text-white shadow-lg shadow-accent/25' : 'text-white/50 hover:text-white/80'
              }`}
            >{m.icon}{m.label}</button>
          ))}
        </div>

        {/* Week nav */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevWeek} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-white/70 hover:text-white transition-colors text-sm font-bold"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={goToday} className="rounded-lg bg-white/10 px-3 py-1.5 text-white/70 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider">{t.today_btn ?? 'Oggi'}</button>
          <button type="button" onClick={nextWeek} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-white/70 hover:text-white transition-colors text-sm font-bold"><ChevronRight className="h-3.5 w-3.5" /></button>
          <span className="text-sm font-semibold text-white/60 min-w-[180px] text-center tabular-nums">
            {format(weekStart, 'd MMM', { locale })} — {format(weekEnd, 'd MMM yyyy', { locale })}
          </span>
        </div>

        {/* Actions */}
        {isMgmt && (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={handlePublishWeek}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/30 transition-colors uppercase tracking-wider">
              <Send className="h-3 w-3" />{t.publish_week ?? 'Pubblica'}
            </button>
            <button type="button" onClick={handleCopyWeek}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600/20 px-3 py-1.5 text-[11px] font-bold text-blue-300 hover:bg-blue-600/30 transition-colors uppercase tracking-wider">
              <Copy className="h-3 w-3" />{t.copy_week ?? 'Copia'}
            </button>
          </div>
        )}

        {/* Dept filter */}
        {departments.length > 1 && (
          <div className="flex items-center gap-1">
            <Filter className="h-3 w-3 text-white/40" />
            <select value={deptFilter ?? ''} onChange={e => setDeptFilter(e.target.value || null)}
              className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-bold text-white/70 uppercase tracking-wider outline-none">
              <option value="">{t.department_filter_all ?? 'Tutti'}</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Grid ── */}
      <div className="overflow-x-auto rounded-2xl border border-white/10" style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
        <table className="w-full min-w-[720px] table-fixed border-collapse">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 bg-[#0a1628] text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/50 border-b border-white/10" style={{ width: 160, minWidth: 160 }}>
                {t.employee ?? 'Dipendente'}
              </th>
              {weekDays.map((day, i) => (
                <th key={i} className={`px-2 py-2.5 text-center border-b border-white/10 ${isToday(day) ? 'bg-accent/10' : 'bg-[#0a1628]'}`} style={{ width: 130, minWidth: 110 }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">{format(day, 'EEE', { locale })}</div>
                  <div className={`text-sm font-black ${isToday(day) ? 'text-accent' : 'text-white/80'}`}>{format(day, 'd')}</div>
                </th>
              ))}
              {(mode === 'realtime' || mode === 'comparison') && (
                <th className="px-2 py-2.5 text-center border-b border-white/10 bg-[#0a1628]" style={{ width: 100, minWidth: 90 }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">{t.total_hours ?? 'Ore'}</div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((user, uIdx) => {
              const totalPlanned = getTotalPlanned(user.id);
              const totalActual = getTotalActual(user.id);
              return (
                <tr key={user.id} className={uIdx % 2 === 0 ? 'bg-white/[0.03]' : ''}>
                  <td className="sticky left-0 z-10 bg-[#0d1b2a] px-3 py-2 border-b border-white/5" style={{ width: 160, minWidth: 160 }}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">{user.first_name} {user.last_name?.[0] ?? ''}</span>
                    </div>
                    {(mode === 'realtime' || mode === 'comparison') && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-semibold text-white/40 tabular-nums">{formatMinutesToHoursAndMinutes(totalPlanned)}P</span>
                        <span className="text-[10px] font-semibold text-white/40">/</span>
                        <span className={`text-[10px] font-bold tabular-nums ${totalActual > totalPlanned ? 'text-accent' : 'text-emerald-400'}`}>{formatMinutesToHoursAndMinutes(totalActual)}E</span>
                      </div>
                    )}
                  </td>
                  {weekDays.map((day, dIdx) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const groups = getDayGroup(user.id, dateStr);
                    return (
                      <td key={dIdx} className={`px-1.5 py-1 border-b border-white/5 align-top ${isToday(day) ? 'bg-accent/[0.04]' : ''}`}>
                        {groups.length === 0 ? (
                          <div className="flex items-center justify-center h-full min-h-[48px]">
                            {canEdit ? (
                              <button type="button" onClick={() => setCreateModal({ userId: user.id, date: dateStr, defaultTime: '10:00' })}
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
                              const isApproved = g.shift.approval_status === 'approved' && g.shift.approved_at;
                              const isConfirmed = g.shift.approval_status === 'confirmed';
                              let borderColor = 'border-l-cyan-400/70';
                              let bgColor = 'bg-white/[0.06]';
                              if (isDraft) { borderColor = 'border-l-blue-500/50'; bgColor = 'bg-white/[0.03]'; }
                              if (isApproved) { borderColor = 'border-l-emerald-400'; bgColor = 'bg-emerald-500/10'; }
                              if (g.isAbsent) { borderColor = 'border-l-rose-400/60'; bgColor = 'bg-rose-500/10'; }
                              if (g.isMissingPunch) { borderColor = 'border-l-amber-400'; bgColor = 'bg-amber-500/10'; }
                              return (
                                <button key={gIdx} type="button" onClick={() => handleOpenDrawer(g.shift)}
                                  className={`w-full text-left rounded-lg border-l-[3px] ${borderColor} ${bgColor} px-2 py-1.5 hover:brightness-125 transition-all ${
                                    isDraft ? 'border-dashed opacity-60' : ''
                                  }`}>
                                  <div className="flex items-center justify-between gap-1">
                                    <span className={`text-[11px] font-bold tabular-nums ${g.isAbsent ? 'text-rose-400 line-through' : 'text-white'}`}>
                                      {g.shift.start_time?.slice(0, 5)}-{g.shift.end_time?.slice(0, 5)}
                                    </span>
                                    <div className="flex items-center gap-0.5">
                                      {isApproved && <Lock className="h-2.5 w-2.5 text-emerald-400" />}
                                      {isConfirmed && <Check className="h-2.5 w-2.5 text-cyan-300" />}
                                      {g.isMissingPunch && <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />}
                                    </div>
                                  </div>
                                  {(mode === 'realtime' || mode === 'comparison') && g.punchIn && (
                                    <div className="flex items-center justify-between mt-0.5">
                                      <span className="text-[10px] font-medium text-white/50 tabular-nums">
                                        {g.punchIn.timestamp?.slice(11, 16)}{g.punchOut ? `-${g.punchOut.timestamp?.slice(11, 16)}` : ' →'}
                                      </span>
                                      {mode === 'comparison' && g.punchOut && (
                                        <span className={`text-[9px] font-bold tabular-nums ${g.deltaMinutes > 15 ? 'text-accent' : g.deltaMinutes < -15 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                          {g.deltaMinutes > 0 ? '+' : ''}{g.deltaMinutes}'
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {mode === 'realtime' && !g.punchIn && !g.isAbsent && (
                                    <div className="mt-0.5 text-[9px] font-bold text-amber-400/80 uppercase tracking-wider">{t.no_punch ?? 'No entry'}</div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {(mode === 'realtime' || mode === 'comparison') && (
                    <td className="px-2 py-1 border-b border-white/5 text-center align-middle">
                      <div className="text-xs font-bold text-white tabular-nums">{formatMinutesToHoursAndMinutes(totalActual)}</div>
                      {mode === 'comparison' && (
                        <div className={`text-[10px] font-bold tabular-nums ${totalActual > totalPlanned ? 'text-accent' : 'text-emerald-400'}`}>
                          {totalActual > totalPlanned ? '+' : ''}{totalActual - totalPlanned}'
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Legend ── */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-white/40">
        <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-dashed border-blue-500/60" /> {t.shift_draft ?? 'Draft'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-solid border-cyan-400/60" /> {t.shift_published ?? 'Published'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-solid border-emerald-400/60" /> {t.shift_approved ?? 'Approved'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-solid border-amber-400/60" /> {t.shift_missing_punch ?? 'No entry'}</span>
      </div>

      {/* ── Detail Drawer ── */}
      {drawerOpen && selectedShift && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-12 sm:pt-16" onClick={() => setDrawerOpen(false)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/20 bg-[#0d1b2a] p-5 shadow-2xl max-h-[80vh] overflow-y-auto z-10" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedUser?.first_name ?? ''} {selectedUser?.last_name ?? ''}</h3>
                <p className="text-[11px] text-white/50">{format(parseISO(selectedShift.date), 'EEEE d MMMM', { locale })} — {selectedShift.start_time?.slice(0, 5)}-{selectedShift.end_time?.slice(0, 5)}</p>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-lg bg-white/10 p-2 text-white/50 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg bg-white/5 p-1 mb-4">
              {(['details', 'punches', 'history'] as ShiftDetailTab[]).map(tab => (
                <button key={tab} type="button" onClick={() => setDetailTab(tab)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                    detailTab === tab ? 'bg-accent text-white' : 'text-white/50 hover:text-white'
                  }`}>
                  {tab === 'details' ? (t.details ?? 'Dettagli') : tab === 'punches' ? (t.punches ?? 'Timbrature') : (t.history ?? 'Storico')}
                </button>
              ))}
            </div>

            {/* Tab: Details */}
            {detailTab === 'details' && (
              <div className="space-y-3">
                <div className="rounded-xl bg-white/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">{t.status ?? 'Stato'}</span>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${
                      selectedShift.approval_status === 'approved' ? 'text-emerald-400' :
                      selectedShift.approval_status === 'confirmed' ? 'text-cyan-300' : 'text-white/70'
                    }`}>{selectedShift.approval_status}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">{t.role ?? 'Ruolo'}</span>
                    <span className="text-[11px] font-bold text-white">{selectedUser?.role ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">{t.department ?? 'Reparto'}</span>
                    <span className="text-[11px] font-bold text-white">{selectedShift.department ?? '—'}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {canEdit && selectedShift.approval_status === 'draft' && (
                    <button type="button" onClick={() => handleApproveShift(selectedShift)}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-2 text-[11px] font-bold text-emerald-300 hover:bg-emerald-600/30 transition-colors">
                      <Check className="h-3.5 w-3.5" />{t.approve ?? 'Approva'}
                    </button>
                  )}
                  {canEdit && selectedShift.approval_status !== 'approved' && (
                    <button type="button" onClick={() => handleDeleteShift(selectedShift)}
                      className="flex items-center gap-1.5 rounded-lg bg-rose-600/20 px-3 py-2 text-[11px] font-bold text-rose-300 hover:bg-rose-600/30 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />{t.delete ?? 'Elimina'}
                    </button>
                  )}
                  {canEdit && selectedShift.approval_status === 'approved' && (
                    <button type="button" onClick={() => handleApproveShift(selectedShift)}
                      className="flex items-center gap-1.5 rounded-lg bg-amber-600/20 px-3 py-2 text-[11px] font-bold text-amber-300 hover:bg-amber-600/30 transition-colors">
                      <ShieldAlert className="h-3.5 w-3.5" />{t.freeze ?? 'Congela'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Punches */}
            {detailTab === 'punches' && (
              <div className="space-y-3">
                <div className="rounded-xl bg-white/5 p-3 space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">{t.punch_in ?? 'Entrata'}</label>
                    <input type="time" value={editIn} onChange={e => setEditIn(e.target.value)}
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">{t.punch_out ?? 'Uscita'}</label>
                    <input type="time" value={editOut} onChange={e => setEditOut(e.target.value)}
                      className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white outline-none focus:border-accent" />
                  </div>
                  <button type="button" onClick={handleSaveManualPunch} disabled={saving || (!editIn && !editOut)}
                    className="w-full rounded-lg bg-accent px-4 py-2.5 text-[11px] font-bold text-white hover:bg-accent-hover disabled:opacity-40 transition-all uppercase tracking-wider">
                    {saving ? (t.saving ?? 'Salvataggio...') : <><Save className="h-3.5 w-3.5 inline-block mr-1.5" />{t.save_punches ?? 'Salva timbrature'}</>}
                  </button>
                </div>
              </div>
            )}

            {/* Tab: History */}
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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/20 bg-[#0d1b2a] p-5 shadow-2xl z-10" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-4">{t.create_shift ?? 'Nuovo turno'}</h3>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">{t.start_time ?? 'Inizio'}</label>
                <input type="time" value={createStart} onChange={e => setCreateStart(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block mb-1">{t.end_time ?? 'Fine'}</label>
                <input type="time" value={createEnd} onChange={e => setCreateEnd(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white outline-none focus:border-accent" />
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
    </div>
  );
}

function useT() {
  const { effectiveLanguage } = useApp();
  return getTranslations(effectiveLanguage);
}
