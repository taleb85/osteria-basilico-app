/**
 * Gate PWA: dopo il login l’app è usabile solo in modalità installata (standalone),
 * su qualsiasi dispositivo (PC, tablet, telefono). Stesso storage e stesso comportamento ovunque.
 *
 * - PWA installata / avviata da icona Home: accesso completo.
 * - Non loggato: accesso al browser (login, kiosk timbratura).
 * - Dev, localhost, `VITE_ALLOW_BROWSER_APP`: anteprima senza installazione.
 * Nessun bypass per utente: regola unica qui.
 */
import { useApp } from '../context/appContextCore';
import { isPWAStandalone } from '../utils/pwaStandalone';
import PWAInstallRequired from './PWAInstallRequired';

interface PwaGateProps {
  children: React.ReactNode;
}

/**
 * Anteprima nel browser senza PWA installata:
 * - `npm run dev` (import.meta.env.DEV)
 * - `npm run preview` su localhost / 127.0.0.1
 * - variabile `VITE_ALLOW_BROWSER_APP=true` (es. Vercel, solo se serve)
 */
function allowBrowserWithoutPwa(): boolean {
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_ALLOW_BROWSER_APP === 'true') return true;
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return true;
  }
  return false;
}

export default function PwaGate({ children }: PwaGateProps) {
  // Gate disattivato: l'app si carica normalmente anche da browser non-standalone.
  // Safari iOS gestisce il prompt "Aggiungi a Home" nativamente tramite i meta tag.
  void useApp;
  void isPWAStandalone;
  void allowBrowserWithoutPwa;
  return <>{children}</>;
}
