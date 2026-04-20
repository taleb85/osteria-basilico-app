import { useState, useMemo, useCallback } from 'react';
import { Bell, BellOff, X, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations } from '../utils/translations';
import {
  generateNotifications,
  syncNotificationFeed,
  getSeenIds,
  markAllSeen,
} from '../utils/notifications';
import { CenteredModalPortal } from './ui/CenteredModalPortal';

/**
 * Centro Notifiche:
 * - Genera notifiche in tempo reale dai dati in memoria (turni, ferie).
 * - Persiste lo stato "visto" in localStorage.
 * - Supporta notifiche push/desktop se il browser lo consente.
 */
export default function NotificationCenter({ denseTrigger = false }: { denseTrigger?: boolean } = {}) {
  const { currentUser, shifts, holidays, users, effectiveLanguage } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  // Tick incrementato dopo markAllSeen per forzare re-lettura seenIds da localStorage
  const [seenTick, setSeenTick] = useState(0);
  const t = getTranslations(effectiveLanguage);

  // Generazione e sincronizzazione feed
  const feed = useMemo(() => {
    if (!currentUser) return [];
    const fresh = generateNotifications(currentUser, shifts, holidays, users, t, effectiveLanguage);
    return syncNotificationFeed(currentUser.id, fresh);
  }, [currentUser, shifts, holidays, users, t, effectiveLanguage]);

  // seenTick incluso nelle dipendenze per aggiornare subito dopo markAllSeen
  const seenIds = useMemo(
    () => (currentUser ? getSeenIds(currentUser.id) : new Set<string>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, feed, seenTick]
  );
  const unreadCount = feed.filter((n) => !seenIds.has(n.id)).length;

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    if (currentUser && unreadCount > 0) {
      markAllSeen(currentUser.id, feed.map((n) => n.id));
      setSeenTick((x) => x + 1);
      // Notifica AppContext di ricalcolare il badge sull'icona PWA
      window.dispatchEvent(new CustomEvent('notifications-seen'));
    }
  }, [currentUser, unreadCount, feed]);

  const getIcon = (_type: string, severity: string) => {
    switch (severity) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-brand-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-accent" />;
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`relative flex items-center justify-center transition-all h-full w-full text-white/60 hover:text-white`}
        title={t.profile_notifications}
      >
        <Bell className={`${denseTrigger ? 'h-4 w-4' : 'h-5 w-5'} ${unreadCount > 0 ? 'animate-ring text-red-500' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <CenteredModalPortal open={isOpen} onClose={() => setIsOpen(false)}>
        <div className="flex h-full max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="text-lg font-bold text-white">{t.profile_notifications}</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 hover:bg-white/10"
            >
              <X className="h-5 w-5 text-white/60" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {feed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
                  <BellOff className="h-8 w-8 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-white/60">{t.notif_empty_state}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {feed.map((n) => (
                  <div
                    key={n.id}
                    className={`relative flex gap-3 rounded-2xl p-4 transition-colors ${
                      !seenIds.has(n.id) ? 'bg-accent/[0.06]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{getIcon(n.type, n.severity)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">{n.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-white/70">{n.body}</p>
                      <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-white/50">
                        {n.timestamp}
                      </p>
                    </div>
                    {!seenIds.has(n.id) && (
                      <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-white/5 p-4">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white transition-transform active:scale-95"
            >
              {t.close}
            </button>
          </div>
        </div>
      </CenteredModalPortal>
    </>
  );
}
