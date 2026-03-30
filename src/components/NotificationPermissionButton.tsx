import { Bell, BellOff, Loader2, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { getTranslations } from '../utils/translations';

interface NotificationPermissionButtonProps {
  effectiveLanguage?: string;
  compact?: boolean;
}

/**
 * Componente per richiedere e gestire le Push Notifications.
 * Mostra uno stato visivo dell'iscrizione alle notifiche.
 */
export function NotificationPermissionButton({
  effectiveLanguage = 'it',
  compact = false,
}: NotificationPermissionButtonProps) {
  const t = getTranslations(effectiveLanguage);
  const {
    notificationPermission,
    isSubscribed,
    isLoading,
    error,
    requestNotificationPermission,
    unsubscribeFromPushNotifications,
    isPushNotificationSupported,
  } = usePushNotifications();

  // Se il browser non supporta le push notifications, non mostrare il pulsante
  if (!isPushNotificationSupported) {
    return null;
  }

  // Se il permesso è stato negato, mostra un messaggio
  if (notificationPermission === 'denied') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        <span>Notifiche disabilitate nel browser</span>
      </div>
    );
  }

  const handleToggleNotifications = async () => {
    if (isSubscribed) {
      await unsubscribeFromPushNotifications();
    } else {
      await requestNotificationPermission();
    }
  };

  const buttonText = isSubscribed ? 'Notifiche Attive' : 'Attiva Notifiche';
  const buttonClass = isSubscribed
    ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/50'
    : 'bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800';

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleToggleNotifications}
        disabled={isLoading}
        title={isSubscribed ? 'Disattiva notifiche' : 'Attiva notifiche'}
        className={`inline-flex items-center justify-center h-10 w-10 rounded-lg transition-colors ${
          isSubscribed
            ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-950/60'
            : 'bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
        } disabled:opacity-50`}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="h-5 w-5 flex-shrink-0" />
        ) : (
          <BellOff className="h-5 w-5 flex-shrink-0" />
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleToggleNotifications}
        disabled={isLoading}
        className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonClass}`}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="h-4 w-4 flex-shrink-0" />
        ) : (
          <BellOff className="h-4 w-4 flex-shrink-0" />
        )}
        <span>{buttonText}</span>
      </button>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notificationPermission === 'default' && !isSubscribed && (
        <p className="text-[11px] text-slate-600 dark:text-slate-400">
          Attiva le notifiche per ricevere aggiornamenti su approvazioni e modifiche turni.
        </p>
      )}
    </div>
  );
}
