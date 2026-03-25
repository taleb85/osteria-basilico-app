import { useEffect } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';

/**
 * Mentre `locked` è true, il documento sotto non scrolla (solo il contenuto del modale).
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [locked]);
}
