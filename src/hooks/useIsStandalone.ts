import { useState, useEffect } from 'react';

/** Rileva PWA standalone (iOS: navigator.standalone, Android: display-mode). */
function checkStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

/** Hook centralizzato per rilevare se l'app è aperta in modalità PWA standalone. */
export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(checkStandalone());
    const mq = window.matchMedia('(display-mode: standalone)');
    const handler = () => setIsStandalone(checkStandalone());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isStandalone;
}
