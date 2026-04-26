/* eslint-disable react-refresh/only-export-components -- contesto: Provider + hook nello stesso file */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  computeEffectiveLayoutFromWidth,
  computeViewportClass,
  LAYOUT_BREAKPOINT_PX,
  type LayoutEffective,
  type ViewportClass,
} from '../utils/layoutPreset';

export type { LayoutEffective, ViewportClass };

type LayoutPresetContextValue = {
  /** Derivato solo dalla larghezza finestra (&lt;768 compatto). */
  effective: LayoutEffective;
  /** phone &lt; 640px (come `sm:`), tablet fino a 1024px, desktop oltre. */
  viewportClass: ViewportClass;
  innerWidth: number;
};

const LayoutPresetContext = createContext<LayoutPresetContextValue | null>(null);

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

  const value = useMemo(
    () => ({ effective, viewportClass, innerWidth: width }),
    [effective, viewportClass, width],
  );

  return <LayoutPresetContext.Provider value={value}>{children}</LayoutPresetContext.Provider>;
}

export function useLayoutPreset(): LayoutPresetContextValue {
  const ctx = useContext(LayoutPresetContext);
  if (!ctx) {
    throw new Error('useLayoutPreset must be used within LayoutPresetProvider');
  }
  return ctx;
}
