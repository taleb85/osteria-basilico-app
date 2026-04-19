import { ReactNode } from 'react';
import { isPWAStandalone } from '../utils/pwaStandalone';
import PWAInstallRequired from '../components/PWAInstallRequired';

/**
 * PWA Gate — non-bloccante di default
 * 
 * Comportamento:
 * - Dev mode: sempre pass
 * - VITE_ALLOW_BROWSER_APP=true: sempre pass
 * - Prod + PWA standalone: pass
 * - Prod + browser: mostra install screen
 */
export function PwaGate({ children }: { children: ReactNode }) {
  // Bypass env: permette uso browser senza PWA (dev debug / test)
  const allowBrowser = import.meta.env.VITE_ALLOW_BROWSER_APP === 'true';
  
  // In dev o con bypass env: always pass
  if (import.meta.env.DEV || allowBrowser) {
    return <>{children}</>;
  }
  
  // Prod: mostra install screen solo se NON è PWA standalone
  if (!isPWAStandalone()) {
    return <PWAInstallRequired />;
  }
  
  return <>{children}</>;
}
