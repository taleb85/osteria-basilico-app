import { useEffect, useCallback, useState } from 'react';

/**
 * Hook per gestire le Push Notifications PWA.
 * Richiede il permesso all'utente e gestisce la subscription.
 * 
 * @returns {object} Stato e funzioni per le notifiche push
 */
export function usePushNotifications() {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verifica il supporto alle push notifications
  const isPushNotificationSupported = useCallback(() => {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }, []);

  // Carica lo stato iniziale
  useEffect(() => {
    if (!isPushNotificationSupported()) {
      setError('Push notifications non supportate su questo browser');
      return;
    }

    // Leggi il permesso corrente
    setNotificationPermission(Notification.permission);

    // Controlla se l'utente è già sottoscritto
    navigator.serviceWorker.ready.then((registration) => {
      if (!registration.pushManager) return;
      
      registration.pushManager
        .getSubscription()
        .then((subscription) => {
          setIsSubscribed(!!subscription);
        })
        .catch((err) => {
          console.warn('[usePushNotifications] Errore nel controllare subscription:', err);
        });
    });
  }, [isPushNotificationSupported]);

  /**
   * Richiede il permesso notifiche all'utente.
   */
  const requestNotificationPermission = useCallback(async () => {
    if (!isPushNotificationSupported()) {
      setError('Push notifications non supportate');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission !== 'granted') {
        setError('Permesso notifiche negato');
        setIsLoading(false);
        return false;
      }

      // Se il permesso è stato concesso, sottoscrivi alle notifiche
      const subscribed = await subscribeToPushNotifications();
      setIsLoading(false);
      return subscribed;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(`Errore nel richiedere permesso: ${errorMsg}`);
      setIsLoading(false);
      return false;
    }
  }, [isPushNotificationSupported]);

  /**
   * Sottoscrive l'utente alle push notifications.
   * Salva la subscription nel database per il server.
   */
  const subscribeToPushNotifications = useCallback(async (): Promise<boolean> => {
    if (!isPushNotificationSupported()) {
      setError('Push notifications non supportate');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (!registration.pushManager) {
        setError('PushManager non disponibile');
        return false;
      }

      // Sottoscrivi alle notifiche push (VAPID key necessaria per il server)
      // Nota: la VAPID public key deve essere fornita dal server
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // applicationServerKey deve essere fornito dal server (in base64)
        // Per ora, non lo includiamo qui; sarà configurato dal backend
      });

      // Salva la subscription nel database per il server
      await savePushSubscriptionToDatabase(subscription);

      setIsSubscribed(true);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Errore sconosciuto';
      setError(`Errore sottoscrizione: ${errorMsg}`);
      console.error('[usePushNotifications] Errore:', err);
      return false;
    }
  }, [isPushNotificationSupported]);

  /**
   * Salva la push subscription nel database Supabase.
   * Il server userà questi dati per inviare notifiche push specifiche per utente.
   */
  const savePushSubscriptionToDatabase = useCallback(
    async (subscription: PushSubscription) => {
      try {
        // Nota: questa funzione deve essere implementata in AppContext
        // e chiamare l'API del database per salvare la subscription
        const subscriptionData = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.getKey('p256dh'),
            auth: subscription.getKey('auth'),
          },
        };

        // Invia al backend (API endpoint che dovrai implementare)
        const response = await fetch('/api/push-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscriptionData),
        });

        if (!response.ok) {
          throw new Error(`Errore salvataggio subscription: ${response.statusText}`);
        }

        console.log('[usePushNotifications] Subscription salvata nel database');
      } catch (err) {
        console.error('[usePushNotifications] Errore nel salvare subscription:', err);
        throw err;
      }
    },
    []
  );

  /**
   * Cancella la subscription dalle notifiche push.
   */
  const unsubscribeFromPushNotifications = useCallback(async () => {
    if (!isPushNotificationSupported()) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Notifica il backend di rimuovere la subscription
        await fetch('/api/push-subscription', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        // Cancella la subscription localmente
        await subscription.unsubscribe();
        setIsSubscribed(false);
        return true;
      }
    } catch (err) {
      console.error('[usePushNotifications] Errore unsubscribe:', err);
      setError('Errore nel cancellarsi dalle notifiche');
      return false;
    }
  }, [isPushNotificationSupported]);

  return {
    notificationPermission,
    isSubscribed,
    isLoading,
    error,
    requestNotificationPermission,
    subscribeToPushNotifications,
    unsubscribeFromPushNotifications,
    isPushNotificationSupported: isPushNotificationSupported(),
  };
}
