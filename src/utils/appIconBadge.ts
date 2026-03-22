/**
 * Badge sull’icona PWA (Badging API).
 * - Chrome / Edge / Android: di solito funziona senza permesso notifiche.
 * - **iOS / iPadOS (WebKit)**: il badge compare solo se l’utente ha concesso
 *   `Notification` — vedi https://webkit.org/blog/14112/badging-for-home-screen-web-apps/
 */

type NavigatorBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

/**
 * Solo da handler sincrono (tap): su iOS il prompt deve partire nello stesso turno del click.
 * Dopo la risposta utente ricalcola il badge.
 */
export function requestNotificationPermissionForBadgeOnUserGesture(): void {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'default') return;
  if (!isStandalonePwa()) return;
  void Notification.requestPermission().then(() => {
    window.dispatchEvent(new CustomEvent('app-badge-recheck'));
  });
}

export async function setAppLauncherBadgeUnreadCountAsync(count: number): Promise<void> {
  if (typeof navigator === 'undefined' || !globalThis.isSecureContext) return;
  const nav = navigator as NavigatorBadge;
  if (typeof nav.setAppBadge !== 'function') return;

  const n = Math.max(0, Math.min(99, Math.floor(count)));

  try {
    if (n === 0) {
      if (typeof nav.clearAppBadge === 'function') {
        await nav.clearAppBadge();
      } else {
        await nav.setAppBadge(0);
      }
    } else {
      await nav.setAppBadge(n);
    }
  } catch {
    /* iOS senza permesso notifiche, non installata, ecc. */
  }
}

/** Wrapper fire-and-forget per effetti React. */
export function setAppLauncherBadgeUnreadCount(count: number): void {
  void setAppLauncherBadgeUnreadCountAsync(count);
}
