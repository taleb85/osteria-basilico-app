/**
 * Rileva se l'app è aperta in modalità PWA standalone (installata dalla Home).
 * iOS: navigator.standalone | Android/Chrome: display-mode: standalone
 */
export function isPWAStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return false;
}

/** Rileva se è iOS (Safari) per mostrare istruzioni "Condividi → Aggiungi a Home" */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Rileva se è Android per mostrare istruzioni "Tre puntini → Installa App" */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/** Rileva se è un Computer/Desktop (non touch, non mobile) — permetti sempre login e accesso */
export function isDesktop(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isIOS() || isAndroid()) return false;
  return true;
}
