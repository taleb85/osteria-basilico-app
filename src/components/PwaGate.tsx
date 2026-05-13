import { ReactNode } from 'react';
import { isPWAStandalone, isDesktop } from '../utils/pwaStandalone';
import PWAInstallRequired from '../components/PWAInstallRequired';

/**
 * PWA Gate — non-bloccante di default
 * 
 * Comportamento:
 * - Dev mode: sempre pass
 * - VITE_ALLOW_BROWSER_APP=true: sempre pass
 * - Prod + Desktop (browser): pass — l'utente può usare l'app direttamente senza installarla
 * - Prod + PWA standalone: pass
 * - Prod + Mobile (browser): mostra install screen
 */
export function PwaGate({ children }: { children: ReactNode }) {
  // Bypass env: permette uso browser senza PWA (dev debug / test)
  const allowBrowser = import.meta.env.VITE_ALLOW_BROWSER_APP === 'true';
  
  // In dev o con bypass env: always pass
  if (import.meta.env.DEV || allowBrowser) {
    return <>{children}</>;
  }

  // Desktop: non bloccare, l'utente usa l'app direttamente nel browser
  if (isDesktop()) {
    return <>{children}</>;
  }
  
  // Prod mobile: mostra install screen solo se NON è PWA standalone
  if (!isPWAStandalone()) {
    return <PWAInstallRequired />;
  }
  
  return <>{children}</>;
}
