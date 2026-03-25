import { useState, useEffect, useRef, useMemo } from 'react';
import { Bell, X, CheckCheck, Calendar, Clock, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  generateNotifications,
  getSeenIds,
  markAllSeen,
  syncNotificationFeed,
  AppNotification,
  NotifSeverity,
} from '../utils/notifications';
import { getTranslations } from '../utils/translations';
import { CenteredModalPortal } from './ui/CenteredModalPortal';

// ── Icon + colour helpers ─────────────────────────────────────────────────────

function severityRing(s: NotifSeverity): string {
  if (s === 'success')
    return 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800/50';
  if (s === 'warning')
    return 'bg-amber-50 border-amber-100 dark:bg-amber-950/40 dark:border-amber-800/50';
  return 'bg-accent/5 border-accent/10 dark:bg-accent/15 dark:border-accent/25';
}

function SeverityIcon({ s }: { s: NotifSeverity }) {
  if (s === 'success') return <CheckCircle size={15} className="text-emerald-500 shrink-0" />;
  if (s === 'warning') return <AlertCircle size={15} className="text-amber-500 shrink-0" />;
  return <Info size={15} className="text-accent shrink-0" />;
}

function TypeIcon({ type }: { type: AppNotification['type'] }) {
  if (type === 'new_shift') return <Clock size={13} className="text-slate-500 dark:text-neutral-400 shrink-0" />;
  return <Calendar size={13} className="text-slate-500 dark:text-neutral-400 shrink-0" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationCenter({ denseTrigger = false }: { denseTrigger?: boolean } = {}) {
  const { currentUser, shifts, holidays, users, effectiveLanguage } = useApp();
  const [open, setOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(() =>
    currentUser ? getSeenIds(currentUser.id) : new Set()
  );
  const [mergedFeed, setMergedFeed] = useState<AppNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const t = useMemo(() => getTranslations(effectiveLanguage), [effectiveLanguage]);

  const fresh = useMemo(() => {
    if (!currentUser) return [];
    return generateNotifications(currentUser, shifts, holidays, users, t, effectiveLanguage);
  }, [currentUser, shifts, holidays, users, t, effectiveLanguage]);

  useEffect(() => {
    if (!currentUser) {
      setMergedFeed([]);
      return;
    }
    setMergedFeed(syncNotificationFeed(currentUser.id, fresh));
  }, [currentUser, fresh]);

  useEffect(() => {
    if (!currentUser) {
      setSeenIds(new Set());
      return;
    }
    setSeenIds(getSeenIds(currentUser.id));
  }, [currentUser]);

  const unread = useMemo(
    () => mergedFeed.filter((n) => !seenIds.has(n.id)),
    [mergedFeed, seenIds]
  );

  const handleOpen = () => {
    setOpen((v) => !v);
  };

  const handleMarkAll = () => {
    if (!currentUser) return;
    const ids = mergedFeed.map((n) => n.id);
    markAllSeen(currentUser.id, ids);
    setSeenIds(getSeenIds(currentUser.id));
    try {
      window.dispatchEvent(new Event('notifications-seen'));
    } catch {
      /* ignore */
    }
  };

  if (!currentUser) return null;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t.notif_aria_open}
        aria-expanded={open}
        className={`relative flex items-center justify-center border transition-colors touch-manipulation ${
          denseTrigger
            ? 'min-h-[40px] min-w-[40px] rounded-lg'
            : 'min-h-[36px] min-w-[36px] rounded-md'
        } ${
          open
            ? 'bg-accent/10 border-accent/20 text-accent'
            : 'border-slate-200/80 text-slate-600 hover:border-slate-300 hover:bg-slate-50/90 dark:border-white/10 dark:text-neutral-300 dark:hover:border-white/15 dark:hover:bg-white/[0.06] dark:hover:text-neutral-100'
        }`}
      >
        <Bell size={denseTrigger ? 16 : 17} strokeWidth={2} />
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <CenteredModalPortal
          open
          onClose={() => setOpen(false)}
          panelRef={panelRef}
          backdropAriaLabel={t.close}
          ariaLabel={t.profile_notifications}
          maxWidthClass="max-w-md"
          maxHeightClass="max-h-[min(85dvh,560px)]"
          panelClassName="flex flex-col overflow-hidden p-0"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/10 shrink-0">
            <span className="text-sm font-semibold text-slate-800 dark:text-neutral-100">
              {t.profile_notifications}
            </span>
            <div className="flex items-center gap-2">
              {unread.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  title={t.notif_mark_all_title}
                  className="flex items-center gap-1 text-xs text-slate-500 dark:text-neutral-400 hover:text-accent transition-colors"
                >
                  <CheckCheck size={14} />
                  <span className="hidden sm:inline">{t.notif_mark_all_short}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 transition-colors"
                aria-label={t.close}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {mergedFeed.length === 0 ? (
              <div className="py-10 text-center px-4">
                <Bell size={28} className="mx-auto mb-2 text-slate-200 dark:text-neutral-500" />
                <p className="text-sm text-slate-500 dark:text-neutral-400">{t.notif_empty}</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50 dark:divide-white/5">
                {mergedFeed.map((n) => {
                  const isNew = !seenIds.has(n.id);
                  return (
                    <li
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                        isNew ? 'bg-slate-50/80 dark:bg-white/[0.04]' : 'bg-transparent'
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${severityRing(n.severity)}`}
                      >
                        <SeverityIcon s={n.severity} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-xs font-semibold text-slate-800 dark:text-neutral-100 ${isNew ? '' : 'opacity-70'}`}
                          >
                            {n.title}
                          </p>
                          {isNew && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-accent" />}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1">
                          <TypeIcon type={n.type} />
                          {n.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {mergedFeed.length > 0 && unread.length === 0 && (
            <div className="px-4 py-2.5 border-t border-slate-50 dark:border-white/10 text-center shrink-0">
              <p className="text-xs text-slate-500 dark:text-neutral-400">{t.notif_all_caught_up}</p>
            </div>
          )}
        </CenteredModalPortal>
      )}
    </div>
  );
}
