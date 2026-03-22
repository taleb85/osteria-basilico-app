import { useState, useLayoutEffect, useEffect, useCallback, type RefObject } from 'react';

const DROPDOWN_VIEW_MARGIN = 8;

/**
 * Posizione `fixed` sotto il trigger, larghezza clampata, orizzontale nel viewport.
 */
export function useClampedFixedDropdown(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  preferredWidth: number
): { top: number; left: number; width: number } | null {
  const [style, setStyle] = useState<{ top: number; left: number; width: number } | null>(null);

  const update = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!open || !containerRef.current) {
      setStyle(null);
      return;
    }
    const r = containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const w = Math.min(preferredWidth, vw - DROPDOWN_VIEW_MARGIN * 2);
    let left = r.right - w;
    if (left < DROPDOWN_VIEW_MARGIN) left = DROPDOWN_VIEW_MARGIN;
    if (left + w > vw - DROPDOWN_VIEW_MARGIN) left = vw - w - DROPDOWN_VIEW_MARGIN;
    const top = r.bottom + 4;
    setStyle({ top, left, width: w });
  }, [open, containerRef, preferredWidth]);

  useLayoutEffect(() => {
    update();
  }, [update]);

  useEffect(() => {
    if (!open) return;
    update();
    const onReposition = () => update();
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open, update]);

  return style;
}
