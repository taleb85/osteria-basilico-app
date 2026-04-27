/**
 * Stato e check per il modal permessi (prima visita) — separato dal componente
 * per soddisfare react-refresh/only-export-components.
 */
const STORAGE_KEY = 'app:permissions_requested';

export function alreadyAskedForPermissionModal(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPermissionModalAsked(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Ritorna true se il modal va mostrato (prima volta e almeno un permesso da chiedere) */
export async function shouldShowPermissionModal(): Promise<boolean> {
  if (alreadyAskedForPermissionModal()) return false;
  const notifPending = 'Notification' in window && Notification.permission === 'default';
  let locPending = true;
  try {
    if (navigator.permissions) {
      const r = await navigator.permissions.query({ name: 'geolocation' });
      locPending = r.state === 'prompt';
    }
  } catch {
    /* ignore */
  }
  return notifPending || locPending;
}
