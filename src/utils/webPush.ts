/**
 * Utilità Web Push (VAPID) — usabile dove serve iscriversi senza passare da usePushNotifications.
 * La chiave pubblica è in `VITE_VAPID_PUBLIC_KEY` (fallback: stessa usata dallo hook se presente in build).
 */
const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ||
  'BIcuwW889Xi8wQ_4s323vl86eCIYDxsjQNilZBY_q-XcDy-Nrjx3xPMq7TMJp1pbToofg7rk9zHOdctAlMrKB7k';

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0))) as BufferSource;
}

export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[webPush] Push non supportato');
    return null;
  }
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[webPush] VAPID public key mancante');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) return existing;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    return subscription;
  } catch (err) {
    console.error('[webPush] Errore subscription:', err);
    return null;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;
  return subscription.unsubscribe();
}
