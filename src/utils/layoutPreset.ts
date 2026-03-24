/** Allineare a `index.html` (script layout) se si cambia. */
export const LAYOUT_BREAKPOINT_PX = 768;

/** Larghezza &lt; questo valore ⇒ `phone` (critico per layout touch / spazio). Allineare a `index.html`. */
export const VIEWPORT_PHONE_MAX_PX = 480;

/** Larghezza &lt; questo valore ⇒ `tablet` se già ≥ phone; altrimenti `desktop`. */
export const VIEWPORT_TABLET_MAX_PX = 1024;

export type ViewportClass = 'phone' | 'tablet' | 'desktop';

export type LayoutEffective = 'compact' | 'comfortable';

/** Sempre da larghezza finestra: &lt; 768px compatto, altrimenti comodo. */
export function computeEffectiveLayoutFromWidth(innerWidth: number): LayoutEffective {
  return innerWidth < LAYOUT_BREAKPOINT_PX ? 'compact' : 'comfortable';
}

export function computeViewportClass(innerWidth: number): ViewportClass {
  if (innerWidth < VIEWPORT_PHONE_MAX_PX) return 'phone';
  if (innerWidth < VIEWPORT_TABLET_MAX_PX) return 'tablet';
  return 'desktop';
}
