import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, CheckCheck, Calendar, Clock, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getTranslations } from '../utils/translations';
import { generateNotifications, getSeenIds, markAllSeen, AppNotification, NotifSeverity } from '../utils/notifications';

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

export default function NotificationCenter({ denseTrigger = false }: NotificationCenterProps) {
  const { currentUser, shifts, holidays, users, effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(() =>
    currentUser ? getSeenIds(currentUser.id) : new Set()
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelBox, setPanelBox] = useState({ top: 0, left: 0, width: 320 });

  const updatePanelPosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const margin = 16;
    const width = Math.min(320, window.innerWidth - 2 * margin);
    let left = rect.right - width;
    left = Math.max(margin, Math.min(left, window.innerWidth - margin - width));
    let top = rect.bottom + 8;
    const estH = 340;
    if (top + estH > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - estH - 8);
    }
    setPanelBox({ top, left, width });
  }, []);

  useEffect(() => {
    if (currentUser) setSeenIds(getSeenIds(currentUser.id));
  }, [currentUser?.id]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    window.addEventListener('scroll', updatePanelPosition, true);
    window.addEventListener('resize', updatePanelPosition);
    return () => {
      window.removeEventListener('scroll', updatePanelPosition, true);
      window.removeEventListener('resize', updatePanelPosition);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const node = e.target as Node;
      if (wrapRef.current?.contains(node)) return;
      if (panelRef.current?.contains(node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const allNotifs = useMemo(() => {
    if (!currentUser) return [];
    return generateNotifications(currentUser, shifts, holidays, users, t, effectiveLanguage);
  }, [currentUser, shifts, holidays, users, t, effectiveLanguage]);

  const unread = useMemo(
    () => allNotifs.filter((n) => !seenIds.has(n.id)),
    [allNotifs, seenIds]
  );

  const handleOpen = () => {
    setOpen((v) => !v);
  };

  const handleMarkAll = () => {
    if (!currentUser) return;
    const ids = allNotifs.map((n) => n.id);
    markAllSeen(currentUser.id, ids);
    setSeenIds(new Set(ids));
    /** Estensibile (badge altrove): oggi nessun listener in app. */
    window.dispatchEvent(new CustomEvent('notifications-seen'));
  };

  if (!currentUser) return null;

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-label={t.profile_notifications}
          initial={{ opacity: 0, scale: 0.96, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -6 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            top: panelBox.top,
            left: panelBox.left,
            width: panelBox.width,
            zIndex: 200,
          }}
          className="max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-800">{t.profile_notifications}</span>
            <div className="flex items-center gap-2">
              {unread.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  title={t.notif_mark_all_title}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-accent transition-colors"
                >
                  <CheckCheck size={14} />
                  <span className="hidden sm:inline">{t.notif_mark_all_short}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto overscroll-contain">
            {allNotifs.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={28} className="mx-auto mb-2 text-slate-200" />
                <p className="text-sm text-slate-400">{t.notif_empty}</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {allNotifs.map((n) => {
                  const isNew = !seenIds.has(n.id);
                  return (
                    <li
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                        isNew ? 'bg-slate-50/80' : 'bg-white'
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${severityRing(n.severity)}`}
                      >
                        <SeverityIcon s={n.severity} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs font-semibold text-slate-800 ${isNew ? '' : 'opacity-70'}`}>
                            {n.title}
                          </p>
                          {isNew && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-accent" />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-start gap-1 break-words">
                          <TypeIcon type={n.type} />
                          <span>{n.body}</span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {allNotifs.length > 0 && unread.length === 0 && (
            <div className="px-4 py-2.5 border-t border-slate-50 text-center">
              <p className="text-xs text-slate-400">{t.notif_all_caught_up}</p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={wrapRef} className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
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

      {typeof document !== 'undefined' && createPortal(panel, document.body)}
    </div>
  );
}
