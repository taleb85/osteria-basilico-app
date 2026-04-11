import { Bell, BellOff, Loader2, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import type { Language } from '../types';
import { getTranslations } from '../utils/translations';

interface NotificationPermissionButtonProps {
  effectiveLanguage?: string;
  compact?: boolean;
  userId?: string;
}

export function NotificationPermissionButton({
  effectiveLanguage,
  compact = false,
  userId,
}: NotificationPermissionButtonProps) {
  const t = getTranslations((effectiveLanguage ?? 'it') as Language);
  const {
    notificationPermission,
    isSubscribed,
    isLoading,
    error,
    savedOk,
    requestNotificationPermission,
    unsubscribeFromPushNotifications,
    isPushNotificationSupported,
  } = usePushNotifications(userId);

  // Browser che non supporta push (es. Safari < 16, Firefox su iOS)
  if (!isPushNotificationSupported) {
    return (
      <div className="flex items-start gap-2 px-3 py-2.5 text-xs font-medium text-slate-500 dark:text-neutral-400 bg-slate-50 dark:bg-neutral-800/50 rounded-lg border border-slate-100 dark:border-neutral-700">
        <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span>{t.notif_push_not_supported}</span>
      </div>
    );
  }

  // Permesso bloccato esplicitamente dall'utente
  if (notificationPermission === 'denied') {
    return (
      <div className="flex items-start gap-2 px-3 py-2.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <span>{t.notif_push_blocked}</span>
          <span className="font-normal text-red-600 dark:text-red-400">
            {t.notif_push_blocked_hint}
          </span>
        </div>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribeFromPushNotifications();
    } else {
      await requestNotificationPermission();
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        title={isSubscribed ? t.notif_push_active_title : t.notif_push_activate_title}
        className={`inline-flex items-center justify-center h-10 w-10 rounded-lg transition-colors disabled:opacity-50 ${
          isSubscribed
            ? 'bg-brand-100 dark:bg-[#001A80]/12 text-brand-700 dark:text-brand-300'
            : 'bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
        }`}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="h-5 w-5" />
        ) : (
          <BellOff className="h-5 w-5" />
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          isSubscribed
            ? 'bg-brand-50 dark:bg-[#001A80]/10 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800'
            : 'bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800'
        }`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="h-4 w-4" />
        ) : (
          <BellOff className="h-4 w-4" />
        )}
        <span>{isSubscribed ? (t.notif_push_deactivate ?? 'Disattiva Notifiche') : (t.notif_push_activate ?? 'Attiva Notifiche')}</span>
        {isSubscribed && savedOk && (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-auto" />
        )}
      </button>

      {/* Stato corrente */}
      <div className="flex items-center gap-3 px-1">
        {/* Permesso browser (qui non è mai "denied": già gestito sopra) */}
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full flex-shrink-0 ${
              notificationPermission === 'granted' ? 'bg-green-500' : 'bg-amber-400'
            }`}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
            {notificationPermission === 'granted' ? 'Permesso concesso' : 'Permesso non richiesto'}
          </span>
        </div>
        <span className="text-slate-200 dark:text-white/10 text-xs">·</span>
        {/* Iscrizione push */}
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${isSubscribed ? 'bg-green-500' : 'bg-slate-300 dark:bg-white/20'}`} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/30">
            {isSubscribed ? 'Iscritto' : 'Non iscritto'}
          </span>
        </div>
      </div>

      {/* Conferma salvataggio */}
      {isSubscribed && savedOk && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          <span>{t.notif_push_saved}</span>
        </div>
      )}

      {/* Errore */}
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Suggerimento iniziale */}
      {notificationPermission === 'default' && !isSubscribed && (
        <p className="text-[11px] text-slate-500 dark:text-neutral-400 leading-relaxed">
          {t.notif_push_hint}
        </p>
      )}
    </div>
  );
}
