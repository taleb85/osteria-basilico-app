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
