/** Tag registrato con `SyncManager` (Chrome/Edge/Android WebView; non su Safari iOS). */
export const OSTERIA_BACKGROUND_SYNC_TAG = 'osteria-data-sync';

/** True in Chromium (Chrome, Edge, Android WebView compatibile); assente su Safari iOS. */
export function supportsBackgroundSync(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  return typeof (window as Window & { SyncManager?: new () => unknown }).SyncManager === 'function';
}

/**
 * Accoda un sync one-shot: quando la rete torna disponibile lo SW può risvegliarsi
 * anche con scheda in background e inviare `OSTERIA_BACKGROUND_SYNC` alle client.
 */
export async function registerOsteriaBackgroundSync(): Promise<boolean> {
  if (!supportsBackgroundSync()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register: (t: string) => Promise<void> } }).sync;
    if (!sync?.register) return false;
    await sync.register(OSTERIA_BACKGROUND_SYNC_TAG);
    return true;
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[backgroundSync] register', e);
    return false;
  }
}

/** Coda workbox / sync tag @see scripts/vite.config.mjs runtimeCaching + public/pwa-background-sync.js */
export const PUNCH_SYNC_QUEUE = 'punch-queue';


