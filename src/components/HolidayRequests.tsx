import { useState, useEffect } from 'react';
import { Calendar, Check, X, Palmtree, Trash2 } from 'lucide-react';
import { getTranslations } from '../utils/translations';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { canApproveShiftActions } from '../utils/permissions';
import { isUiWidgetVisible } from '../utils/uiScreenWidgets';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isBefore, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import type { HolidayRequest } from '../types';
import { safeFormatDate } from '../utils/safeDateFormat';

// ─── Status helpers ────────────────────────────────────────────────────────────
// STATUS_CONFIG is built inside the component to use translations

export default function HolidayRequests() {
  const { currentUser, holidays, users, addHolidayRequest, updateHolidayStatus, deleteHolidayRequest, showSuccess, silentRefreshData, effectiveLanguage, featureFlags } = useApp();

  /**
   * Aggiorna turni/ferie/timbrature da DB aprendo la scheda.
   * `skipRemoteRevisionCheck`: evita di innescare `forceGlobalRefresh` + overlay PIN / main `pointer-events-none`
   * solo perché la revisione cloud è avanti rispetto all’ack locale (comportamento da “app bloccata”).
   */
  useEffect(() => {
    void silentRefreshData({ skipRemoteRevisionCheck: true });
  }, [silentRefreshData]);

  const [showForm, setShowForm]       = useState(false);
  const [selectedH, setSelectedH]     = useState<HolidayRequest | null>(null);
  const [updatingId, setUpdatingId]   = useState<string | null>(null);
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [reason, setReason]           = useState('');

  if (!currentUser) return null;

  const t = getTranslations(effectiveLanguage);

  const STATUS_CONFIG = {
    approved: {
      label: t.status_approved,
      dot: 'bg-[#60a5fa]',
      badge: 'bg-[#60a5fa]/15 text-[#93c5fd] border border-[#60a5fa]/30',
    },
    pending: {
      label: t.pending,
      dot: 'bg-amber-400',
      badge: 'bg-amber-100 text-amber-800 border border-amber-200/80',
    },
    rejected: {
      label: t.rejected,
      dot: 'bg-red-500',
      badge: 'bg-red-100 text-red-800 border border-red-200/80',
    },
  } as const;

  if (featureFlags['staff_requests'] === false) {
    return (
      <div className="pb-content w-full app-horizontal-pad font-sans min-h-[40vh] flex items-center justify-center">
        <div className="surface-glass max-w-md px-6 py-8 text-center">
          <Palmtree className="w-10 h-10 text-accent mx-auto mb-3 opacity-90" />
          <p className="text-white/80 font-semibold text-sm">{t.staff_requests_feature_off}</p>
        </div>
      </div>
    );
  }

  const isAdmin = canApproveShiftActions(currentUser);
  const uiW = (key: string) => isUiWidgetVisible(currentUser, key);

  const myHolidays     = holidays.filter((h) => h.user_id === currentUser.id && h.type !== 'indisponibilita');
  const realHolidays   = holidays.filter((h) => h.type !== 'indisponibilita');
  const pendingAll     = realHolidays.filter((h) => h.status === 'pending');
  const approvedFuture = realHolidays.filter((h) => h.status === 'approved' && new Date(h.end_date) >= new Date());
  const rejectedAll    = realHolidays.filter((h) => h.status === 'rejected');

  // ── Calendar helpers ──────────────────────────────────────────────────────
  const now        = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd   = endOfMonth(now);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const emptyDays   = Array.from({ length: getDay(monthStart) === 0 ? 6 : getDay(monthStart) - 1 });
  const weekDays    = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

  const calHolidays = isAdmin ? realHolidays : myHolidays;

  const getDayStatus = (day: Date): HolidayRequest['status'] | null => {
    const ds = format(day, 'yyyy-MM-dd');
    for (const h of calHolidays) {
      try {
        const days = eachDayOfInterval({ start: parseISO(h.start_date), end: parseISO(h.end_date) });
        if (days.some((d) => format(d, 'yyyy-MM-dd') === ds)) return h.status;
      } catch { /* skip */ }
    }
    return null;
  };

  const getHolidayForDay = (day: Date): HolidayRequest | null => {
    const ds = format(day, 'yyyy-MM-dd');
    for (const h of calHolidays) {
      try {
        const days = eachDayOfInterval({ start: parseISO(h.start_date), end: parseISO(h.end_date) });
        if (days.some((d) => format(d, 'yyyy-MM-dd') === ds)) return h;
      } catch { /* skip */ }
    }
    return null;
  };

  const formatDiscursiveDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString('en-US', { month: 'long' });
    const getSuffix = (n: number) => {
      if (n > 3 && n < 21) return 'th';
      switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    return `${day}${getSuffix(day)} of ${month}`;
  };

  const handleStatusChange = async (id: string, status: 'approved' | 'rejected') => {
    setUpdatingId(id);
    const request = holidays.find((h) => h.id === id);
    const user = request ? users.find((u) => u.id === request.user_id) : null;
    try {
      const result = await updateHolidayStatus(id, status);
      if (status === 'rejected' && request && (request.requester_email || user?.email)) {
        const employeeEmail = request.requester_email || user?.email || '';
        const displayStart = formatDiscursiveDate(request.start_date);
        const displayEnd = formatDiscursiveDate(request.end_date);
        const displayDates = `${displayStart} until ${displayEnd}`;
        const subject = encodeURIComponent('Update: Holiday Request');
        const body = encodeURIComponent(`Hi ${user?.first_name ?? 'there'},\n\nRegarding your request for ${displayDates}, it has been rejected.\n\nRegards,\nManagement`);
        try {
          window.location.href = `mailto:${employeeEmail}?subject=${subject}&body=${body}`;
        } catch (err) {
          console.warn('[HolidayRequests] mailto failed:', err);
        }
      }
      setSelectedH(null);
      showSuccess(result?.emailSent ? t.email_sent : t.holiday_saved_email_sent);
    } catch {
      setSelectedH(null);
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    addHolidayRequest({
      user_id: currentUser.id,
      start_date: startDate,
      end_date: endDate,
      type: 'ferie',
      requester_email: currentUser.email ?? '',
      ...((reason ?? '').trim() && { reason: (reason ?? '').trim() }),
    });

    const displayStart = formatDiscursiveDate(startDate);
    const displayEnd = formatDiscursiveDate(endDate);
    // Se manca il cognome usa il nome; se mancano entrambi fallback 'Employee'
    const requesterName = (currentUser.first_name && currentUser.last_name)
      ? `${currentUser.first_name} ${currentUser.last_name}`.trim()
      : (currentUser.first_name || currentUser.last_name || 'Employee').trim();

    const mailSubject = encodeURIComponent(`Holiday Request - ${requesterName}`);
    const mailBody = encodeURIComponent(`Hi, hope you are well,\nI'd like to request a week of holiday that goes from the ${displayStart} until the ${displayEnd}.\nLooking forward to hear from you.\n\nKind Regards`);
    const configuredEmail = (() => { try { return localStorage.getItem('osteria_holiday_request_email')?.trim() ?? ''; } catch { return ''; } })();
    const toEmail = configuredEmail || 'info@flow-workinmotion.com';
    try {
      window.location.href = `mailto:${toEmail}?subject=${mailSubject}&body=${mailBody}`;
    } catch (err) {
      console.warn('[HolidayRequests] mailto failed:', err);
    }

    setStartDate(''); setEndDate(''); setReason('');
    setShowForm(false);
  };

  // ── Shared input style ────────────────────────────────────────────────────
  const inputCls =
    'w-full rounded-lg px-3 py-2 text-sm outline-none transition-all';
  const inputStyle = {
    background: 'rgba(255, 255, 255, 0.16)',
    border: '1px solid rgba(255,255,255,0.20)',
    color: '#ffffff',
  } as React.CSSProperties;
  const labelCls = 'block text-xs font-semibold uppercase tracking-wider mb-1';
  const labelStyle = { color: 'rgba(255,255,255,0.60)' } as React.CSSProperties;

  return (
    <div className="pb-content pt-2 w-full max-w-full font-sans h-[calc(100dvh-140px)] flex flex-col">
      <motion.div
        className="flex flex-col flex-1 min-h-0"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {uiW('ferie.header') && (
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isAdmin && pendingAll.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold"
              style={{ background: 'rgba(245,158,11,0.25)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.35)' }}>
              {pendingAll.length}
            </span>
          )}
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {isAdmin ? t.pending : `${myHolidays.length} ${t.request_holiday}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="ui-toolbar-accent gap-1.5 px-3 text-[11px] uppercase tracking-wider shadow-sm transition-transform hover:bg-accent-hover active:scale-[0.98]"
        >
          {t.request_holiday}
        </button>
      </div>
      )}

      {/* ── New request modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          >
            <motion.form
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              onSubmit={handleSubmit}
              onClick={(e) => e.stopPropagation()}
              className="modal-glass-panel w-full max-w-md rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-semibold text-base">{t.new_request}</h3>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                  style={{ color: 'rgba(255,255,255,0.60)' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls} style={labelStyle}>{t.holiday_start_date ?? 'Data inizio'}</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className={labelCls} style={labelStyle}>{t.holiday_end_date ?? 'Data fine'}</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required min={startDate} className={inputCls} style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label className={labelCls} style={labelStyle}>{t.holiday_request_reason} <span className="normal-case font-normal" style={{ color: 'rgba(255,255,255,0.40)' }}>{t.holiday_request_reason_optional}</span></label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t.holiday_request_reason_placeholder}
                    className={`${inputCls} resize-none h-20`}
                    style={inputStyle}
                  />
                </div>

                <button type="submit" className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-accent-hover">
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  {t.request_holiday}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Approve/reject modal (admin click on pending day) ─────────────── */}
      <AnimatePresence>
        {selectedH && selectedH.status === 'pending' && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={() => setSelectedH(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="modal-glass-panel w-full max-w-sm rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">{t.pending}</h3>
                <button type="button" onClick={() => setSelectedH(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/10"
                  style={{ color: 'rgba(255,255,255,0.60)' }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              {(() => {
                const u = users.find((u) => u.id === selectedH.user_id);
                return (
                  <>
                    <div className="surface-glass-sm mb-4 p-4">
                      <p className="text-white font-semibold text-sm">{u?.first_name} {u?.last_name}</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
                        {safeFormatDate(selectedH.start_date, 'd MMM', { locale: it })} – {safeFormatDate(selectedH.end_date, 'd MMM yyyy', { locale: it })}
                      </p>
                      {'reason' in selectedH && selectedH.reason && (
                        <p className="text-xs mt-1 italic" style={{ color: 'rgba(255,255,255,0.50)' }}>{String(selectedH.reason)}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedH.id, 'approved')}
                        disabled={updatingId === selectedH.id}
                        className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-accent text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updatingId === selectedH.id ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                            {t.approve}
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedH.id, 'rejected')}
                        disabled={updatingId === selectedH.id}
                        className="flex h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}
                      >
                        {updatingId === selectedH.id ? (
                          <span className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <X className="w-3.5 h-3.5" strokeWidth={3} />
                            {t.rejected}
                          </>
                        )}
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Layout ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 md:items-stretch flex-1">

        {/* Left: calendar */}
        <div className="md:col-span-1 space-y-4 h-full">
          {uiW('ferie.calendar') && (
          <div className="surface-glass p-4 h-full" style={{ background: 'rgba(255, 255, 255, 0.16)', border: '1px solid rgba(255, 255, 255, 0.14)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-xl" style={{ color: '#ffffff' }}>
                {format(now, 'MMMM yyyy', { locale: it })}
              </h3>
              <div className="flex items-center gap-3 text-xs" style={{ color: '#ffffff' }}>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{t.pending}</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />{t.status_approved}</span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {weekDays.map((d, i) => (
                <div key={i} className="text-center text-xs font-semibold uppercase" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {emptyDays.map((_, i) => <div key={`e${i}`} />)}
              {daysInMonth.map((day) => {
                const status = getDayStatus(day);
                const holiday = getHolidayForDay(day);
                const isPending = status === 'pending' && holiday;
                const today = isToday(day);
                const isPast = !today && isBefore(day, startOfDay(new Date()));
                
                let dayStyle: React.CSSProperties = { color: isPast ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)' };
                
                if (status === 'approved') {
                  dayStyle = { background: 'rgba(16, 185, 129, 0.3)', color: '#34d399', fontWeight: 600 };
                } else if (status === 'pending') {
                  dayStyle = { background: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24', fontWeight: 600 };
                } else if (status === 'rejected') {
                  dayStyle = { background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' };
                } else if (today) {
                  dayStyle = { background: '#3b82f6', color: '#ffffff', fontWeight: 700 };
                }
                
                return (
                  <div
                    key={day.toString()}
                    onClick={() => isPending && isAdmin && setSelectedH(holiday)}
                    className={`min-h-[44px] min-w-[44px] aspect-square rounded-xl flex items-center justify-center text-xs font-semibold transition-all select-none touch-target
                      ${isPending && isAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                    style={dayStyle}
                    onMouseEnter={(e) => {
                      if (!status && !today) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.color = '#ffffff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!status && !today) {
                        e.currentTarget.style.background = '';
                        e.currentTarget.style.color = isPast ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)';
                      }
                    }}
                  >
                    {format(day, 'd')}
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* My requests list (staff only) */}
          {!isAdmin && uiW('ferie.list') && (
            <div className="surface-glass overflow-hidden">
              <div className="px-5 py-4 border-b border-[#60a5fa]/15">
                <h3 className="text-white font-semibold text-xl">{t.request_holiday}</h3>
              </div>
              <div className="divide-y divide-[#60a5fa]/10 max-h-80 overflow-y-auto">
                {myHolidays.length === 0 ? (
                  <p className="text-white/70 text-sm text-center py-10">{t.no_holidays_yet}</p>
                ) : myHolidays
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((h) => {
                      const cfg = STATUS_CONFIG[h.status];
                      return (
                        <div key={h.id} className="flex items-center justify-between px-5 py-3.5">
                          <div>
                            <p className="text-white text-[12px] font-medium">
                              {safeFormatDate(h.start_date, 'd MMM', { locale: it })} – {safeFormatDate(h.end_date, 'd MMM', { locale: it })}
                            </p>
                            <p className="text-white/70 text-xs mt-0.5 uppercase tracking-wider">
                              {h.type ?? 'Ferie'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${cfg.badge}`}>
                              {cfg.label}
                            </span>
                            {h.status === 'rejected' && (
                              <button
                                type="button"
                                onClick={() => void deleteHolidayRequest(h.id)}
                                disabled={updatingId === h.id}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                                title="Elimina richiesta"
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>
          )}
        </div>

        {/* Right: admin panels */}
        <div className="md:col-span-2 space-y-4 h-full">

          {/* Pending (manager) */}
          {isAdmin && uiW('ferie.list') && pendingAll.length > 0 && (
            <div className="surface-glass overflow-hidden h-full">
              <div className="px-5 py-4 border-b border-[#60a5fa]/15 flex items-center justify-between">
                <h3 className="text-white font-semibold text-xl">{t.pending}</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200/80">{pendingAll.length}</span>
              </div>
              <div className="divide-y divide-[#60a5fa]/10">
                {pendingAll.map((h) => {
                  const u = users.find((u) => u.id === h.user_id);
                  return (
                    <div key={h.id} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{u?.first_name} {u?.last_name}</p>
                          <p className="text-white/70 text-xs">
                            {safeFormatDate(h.start_date, 'd MMM', { locale: it })} – {safeFormatDate(h.end_date, 'd MMM yyyy', { locale: it })}
                            {h.reason && ` · ${h.reason}`}
                          </p>
                        </div>
                      </div>
                      <div className="ml-3 flex flex-shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(h.id, 'approved')}
                          disabled={updatingId === h.id}
                          className="ui-toolbar-accent gap-1 text-[11px] uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingId === h.id ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <>
                              <Check className="h-3 w-3" strokeWidth={3} />
                              {t.approve}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(h.id, 'rejected')}
                          disabled={updatingId === h.id}
                          className="ui-toolbar-outline gap-1 border-slate-200 text-[11px] uppercase tracking-wider hover:border-red-200 hover:bg-red-500/15 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingId === h.id ? (
                            <span className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <X className="w-3 h-3" strokeWidth={3} />
                              {t.rejected}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming approved */}
          {isAdmin && uiW('ferie.list') && approvedFuture.length > 0 && (
            <div className="surface-glass p-4 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-50">
                <h3 className="text-white font-semibold text-xl">{t.home_upcoming_holidays}</h3>
              </div>
              <div className="divide-y divide-[#60a5fa]/10 max-h-80 overflow-y-auto">
                {approvedFuture
                  .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                  .map((h) => {
                    const u = users.find((u) => u.id === h.user_id);
                    return (
                      <div key={h.id} className="flex items-center justify-between px-5 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <Palmtree className="w-4 h-4 text-accent flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-white text-sm font-semibold truncate">{u?.first_name} {u?.last_name}</p>
                            <p className="text-white/70 text-xs">
                              {safeFormatDate(h.start_date, 'd MMM', { locale: it })} – {safeFormatDate(h.end_date, 'd MMM yyyy', { locale: it })}
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-[#60a5fa]/15 text-[#93c5fd] text-xs font-semibold uppercase border border-[#60a5fa]/30">
                          {t.status_approved}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Rejected (admin) */}
          {isAdmin && uiW('ferie.list') && rejectedAll.length > 0 && (
            <div className="surface-glass overflow-hidden">
              <div className="px-5 py-4 border-b border-[#60a5fa]/15 flex items-center justify-between">
                <h3 className="text-white font-semibold text-xl">{t.rejected}</h3>
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold border border-red-200/80">{rejectedAll.length}</span>
              </div>
              <div className="divide-y divide-[#60a5fa]/10">
                {rejectedAll
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((h) => {
                    const u = users.find((u) => u.id === h.user_id);
                    return (
                      <div key={h.id} className="flex items-center justify-between px-5 py-3.5">
                        <div className="min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{u?.first_name} {u?.last_name}</p>
                          <p className="text-white/70 text-xs">
                            {safeFormatDate(h.start_date, 'd MMM', { locale: it })} – {safeFormatDate(h.end_date, 'd MMM yyyy', { locale: it })}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteHolidayRequest(h.id)}
                          className="ml-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20"
                          title="Elimina richiesta"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {isAdmin && uiW('ferie.list') && pendingAll.length === 0 && approvedFuture.length === 0 && (
            <div className="surface-glass p-12 flex flex-col items-center justify-center text-center">
              <Palmtree className="w-10 h-10 text-accent mb-3 opacity-90" />
              <p className="text-white/70 text-sm">{t.no_holidays_yet}</p>
            </div>
          )}

          {/* Staff: my upcoming approved */}
          {!isAdmin && uiW('ferie.list') && myHolidays.filter(h => h.status === 'approved' && new Date(h.end_date) >= new Date()).length > 0 && (
            <div className="surface-glass overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-white font-semibold text-xl">{t.home_upcoming_holidays}</h3>
              </div>
              <div className="divide-y divide-[#60a5fa]/10">
                {myHolidays
                  .filter(h => h.status === 'approved' && new Date(h.end_date) >= new Date())
                  .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                  .map((h) => (
                    <div key={h.id} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-accent" />
                        <span className="text-white text-[12px] font-medium">
                          {safeFormatDate(h.start_date, 'd MMM', { locale: it })} – {safeFormatDate(h.end_date, 'd MMM yyyy', { locale: it })}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#60a5fa]/15 text-[#93c5fd] text-xs font-semibold uppercase border border-[#60a5fa]/30">{t.status_approved}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </motion.div>
    </div>
  );
}
