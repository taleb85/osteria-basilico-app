import { useEffect, useCallback, useState } from 'react';

/**
 * Chiave pubblica VAPID per Web Push.
 * La chiave privata è conservata come segreto Supabase (VAPID_PRIVATE_KEY).
 */
const VAPID_PUBLIC_KEY = 'BIcuwW889Xi8wQ_4s323vl86eCIYDxsjQNilZBY_q-XcDy-Nrjx3xPMq7TMJp1pbToofg7rk9zHOdctAlMrKB7k';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function usePushNotifications(userId?: string) {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const isPushNotificationSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  // Controlla lo stato reale (permesso + subscription nel browser)
  useEffect(() => {
    if (!isPushNotificationSupported) return;
    const perm = Notification.permission;
    setNotificationPermission(perm);

    if (perm === 'granted') {
      // Verifica che ci sia anche una subscription attiva nel browser
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setIsSubscribed(!!sub))
        .catch(() => setIsSubscribed(false));
    }
  }, [isPushNotificationSupported]);

  /** Salva subscription nel backend */
  const saveSubscription = useCallback(async (sub: PushSubscription): Promise<boolean> => {
    if (!userId) {
      console.warn('[Push] userId mancante, subscription non salvata');
      return false;
    }
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const keys = sub.toJSON().keys ?? {};

      const response = await fetch(`${supabaseUrl}/functions/v1/push-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          user_id: userId,
          endpoint: sub.endpoint,
          p256dh: keys.p256dh ?? '',
          auth_key: keys.auth ?? '',
          user_agent: navigator.userAgent.slice(0, 200),
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.warn('[Push] Errore salvataggio:', response.status, text);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[Push] Errore salvataggio subscription:', err);
      return false;
    }
  }, [userId]);

  /** Attiva push: richiede permesso, forza nuova subscription, salva nel DB */
  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (!isPushNotificationSupported) {
      setError('Notifiche push non supportate su questo browser/dispositivo');
      return false;
    }

    setIsLoading(true);
    setError(null);
    setSavedOk(false);

    try {
      // 1. Permesso browser
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission !== 'granted') {
        setError(
          permission === 'denied'
            ? 'Notifiche bloccate — riabilita in: Impostazioni browser → Sito → Notifiche'
            : 'Permesso notifiche non concesso'
        );
        setIsLoading(false);
        return false;
      }

      // 2. Forza nuova subscription (elimina quella vecchia se c'è, per evitare endpoint scaduti)
      const registration = await navigator.serviceWorker.ready;
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // 3. Salva nel DB
      const saved = await saveSubscription(subscription);
      setSavedOk(saved);

      if (!saved) {
        setError('Notifiche attivate nel browser ma non sincronizzate — riprova');
      }

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Errore: ${msg}`);
      console.error('[Push]', err);
      // Anche se pushManager.subscribe fallisce, il browser permission è ok per in-app
      if (Notification.permission === 'granted') setIsSubscribed(true);
      setIsLoading(false);
      return false;
    }
  }, [isPushNotificationSupported, saveSubscription]);

  /** Disiscrive dal push */
  const unsubscribeFromPushNotifications = useCallback(async (): Promise<boolean> => {
    if (!isPushNotificationSupported) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

        await fetch(`${supabaseUrl}/functions/v1/push-subscription`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({ user_id: userId, endpoint: subscription.endpoint }),
        });

        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
      setSavedOk(false);
      return true;
    } catch (err) {
      console.error('[Push] Errore unsubscribe:', err);
      return false;
    }
  }, [isPushNotificationSupported, userId]);

  return {
    notificationPermission,
    isSubscribed,
    isLoading,
    error,
    savedOk,
    requestNotificationPermission,
    unsubscribeFromPushNotifications,
    isPushNotificationSupported,
  };
}
