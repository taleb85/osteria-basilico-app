import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, Calendar, Clock, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getTranslations } from '../utils/translations';
import { generateNotifications, getSeenIds, markAllSeen, AppNotification, NotifSeverity } from '../utils/notifications';
import { isStandalonePwa, requestNotificationPermissionForBadgeOnUserGesture } from '../utils/appIconBadge';

const TS_FILTER_KEY = 'osteria_timesheet_filter';

function openTimesheetWithConfirmedFilter() {
  try {
    sessionStorage.setItem(TS_FILTER_KEY, 'confirmed');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent('osteria-navigate', {
      detail: { tab: 'timesheet' as const, anchor: 'timesheet-section-main-grid' },
    })
  );
}

// ── Icon + colour helpers ─────────────────────────────────────────────────────

function severityRing(s: NotifSeverity): string {
  if (s === 'success') return 'bg-accent/10 border-accent/20';
  if (s === 'warning') return 'bg-amber-50 border-amber-100';
  return 'bg-accent/5 border-accent/10';
}

function SeverityIcon({ s }: { s: NotifSeverity }) {
  if (s === 'success') return <CheckCircle size={15} className="text-accent shrink-0" />;
  if (s === 'warning') return <AlertCircle size={15} className="text-amber-500 shrink-0" />;
  return <Info size={15} className="text-accent shrink-0" />;
}

function TypeIcon({ type }: { type: AppNotification['type'] }) {
  if (type === 'new_shift') return <Clock size={13} className="opacity-50 shrink-0" />;
  return <Calendar size={13} className="opacity-50 shrink-0" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface NotificationCenterProps {
  /** Pulsante campanella più compatto (header gestione personale PWA) */
  denseTrigger?: boolean;
}

/** Stesso pattern di portal di `UserAvatarMenu`: overlay centrato, blur, card max-w-sm. */
export default function NotificationCenter({ denseTrigger = false }: NotificationCenterProps) {
  const { currentUser, shifts, holidays, users, effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);
  const tv = t as Record<string, string>;
  const [open, setOpen] = useState(false);
  const [showPortal, setShowPortal] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(() =>
    currentUser ? getSeenIds(currentUser.id) : new Set()
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setShowPortal(true);
  }, [open]);

  useEffect(() => {
    if (currentUser) setSeenIds(getSeenIds(currentUser.id));
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (modalRef.current?.contains(target)) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const allNotifs = useMemo(() => {
    if (!currentUser) return [];
    return generateNotifications(currentUser, shifts, holidays, users, t, effectiveLanguage);
  }, [currentUser, shifts, holidays, users, t, effectiveLanguage]);

  const unread = useMemo(
    () => allNotifs.filter((n) => !seenIds.has(n.id)),
    [allNotifs, seenIds]
  );

  const closeModal = useCallback(() => setOpen(false), []);

  const handleBellClick = () => {
    if (!open) {
      requestNotificationPermissionForBadgeOnUserGesture();
      if (typeof Notification === 'undefined' || Notification.permission !== 'default' || !isStandalonePwa()) {
        window.dispatchEvent(new CustomEvent('app-badge-recheck'));
      }
    }
    setOpen((v) => !v);
  };

  const handleMarkAll = () => {
    if (!currentUser) return;
    const ids = allNotifs.map((n) => n.id);
    markAllSeen(currentUser.id, ids);
    setSeenIds(new Set(ids));
    window.dispatchEvent(new CustomEvent('notifications-seen'));
  };

  if (!currentUser) return null;

  return (
    <div ref={menuRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={handleBellClick}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t.notif_aria_open}
        className={`relative flex items-center justify-center border transition-colors touch-manipulation ${
          denseTrigger ? 'min-h-[40px] min-w-[40px] rounded-lg' : 'min-h-[44px] min-w-[44px] rounded-xl'
        } ${
          open
            ? 'bg-accent/10 border-accent/20 text-accent'
            : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
        }`}
      >
        <Bell size={denseTrigger ? 15 : 17} strokeWidth={2} />
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {showPortal &&
        typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence onExitComplete={() => setShowPortal(false)}>
            {open && (
              <motion.div
                key="notifications-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center font-sans"
                role="presentation"
              >
                <div
                  onClick={closeModal}
                  className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
                  aria-hidden
                />
                <motion.div
                  ref={modalRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label={t.profile_notifications}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative z-[9999] mx-4 flex max-h-[min(90dvh,640px)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
                >
                  <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-5 pb-3 pt-5">
                    <h3 className="text-base font-bold text-slate-900">{t.profile_notifications}</h3>
                    <div className="flex shrink-0 items-center gap-1">
                      {unread.length > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAll}
                          title={t.notif_mark_all_title}
                          className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/10"
                        >
                          <CheckCheck size={16} />
                          <span className="hidden min-[360px]:inline">{t.notif_mark_all_short}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={closeModal}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                        aria-label={tv.close ?? 'Chiudi'}
                      >
                        <span className="text-xl leading-none">×</span>
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-0">
                    {allNotifs.length === 0 ? (
                      <div className="flex flex-col items-center px-5 py-12 text-center">
                        <Bell size={32} className="mb-2 text-slate-200" aria-hidden />
                        <p className="text-sm text-slate-500">{t.notif_empty}</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {allNotifs.map((n) => {
                          const isNew = !seenIds.has(n.id);
                          const isApprovalNav = n.type === 'approval_needed';
                          const Row = (
                            <>
                              <div
                                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${severityRing(n.severity)}`}
                              >
                                <SeverityIcon s={n.severity} />
                              </div>
                              <div className="min-w-0 flex-1 text-left">
                                <div className="flex items-center justify-between gap-2">
                                  <p className={`text-xs font-semibold text-slate-800 ${isNew ? '' : 'opacity-70'}`}>
                                    {n.title}
                                  </p>
                                  {isNew && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                                </div>
                                <p className="mt-0.5 flex items-start gap-1 break-words text-xs text-slate-500">
                                  <TypeIcon type={n.type} />
                                  <span>{n.body}</span>
                                </p>
                                {isApprovalNav && (
                                  <p className="mt-1 text-[10px] font-semibold text-accent">{t.notif_tap_open_timesheet}</p>
                                )}
                              </div>
                            </>
                          );
                          if (isApprovalNav) {
                            return (
                              <li key={n.id} className={`p-0 ${isNew ? 'bg-slate-50/80' : 'bg-white'}`}>
                                <button
                                  type="button"
                                  className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-100/90 active:bg-slate-100"
                                  onClick={() => {
                                    if (currentUser) markAllSeen(currentUser.id, [n.id]);
                                    setSeenIds((prev) => new Set([...prev, n.id]));
                                    openTimesheetWithConfirmedFilter();
                                    setOpen(false);
                                    window.dispatchEvent(new CustomEvent('notifications-seen'));
                                  }}
                                >
                                  {Row}
                                </button>
                              </li>
                            );
                          }
                          return (
                            <li
                              key={n.id}
                              className={`flex items-start gap-3 px-5 py-3.5 transition-colors ${
                                isNew ? 'bg-slate-50/80' : 'bg-white'
                              }`}
                            >
                              {Row}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {allNotifs.length > 0 && unread.length === 0 && (
                    <div className="shrink-0 border-t border-slate-100 px-5 py-3 text-center">
                      <p className="text-xs text-slate-400">{t.notif_all_caught_up}</p>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
