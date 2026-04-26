import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  computeEffectiveLayoutFromWidth,
  computeViewportClass,
  LAYOUT_BREAKPOINT_PX,
  type LayoutEffective,
  type ViewportClass,
} from '../utils/layoutPreset';

export type { LayoutEffective, ViewportClass };

export function LayoutPresetProvider({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : LAYOUT_BREAKPOINT_PX,
  );

  const effective = useMemo(() => computeEffectiveLayoutFromWidth(width), [width]);
  const viewportClass = useMemo(() => computeViewportClass(width), [width]);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-layout-preset', 'auto');
    document.documentElement.setAttribute('data-layout-effective', effective);
    document.documentElement.setAttribute('data-viewport-class', viewportClass);
  }, [effective, viewportClass]);

  return <>{children}</>;
}
