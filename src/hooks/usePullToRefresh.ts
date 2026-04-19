import { useRef, useState, useCallback, useEffect } from 'react';

export interface PullToRefreshState {
  pullDistance: number;
  isRefreshing: boolean;
  isTriggered: boolean;
}

const THRESHOLD = 64;
const RESISTANCE = 0.45;

export interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  /** Ref del contenitore scrollabile (default: window scroll). */
  containerRef?: React.RefObject<HTMLElement>;
  disabled?: boolean;
}

export function usePullToRefresh({ onRefresh, containerRef, disabled = false }: UsePullToRefreshOptions) {
  const [state, setState] = useState<PullToRefreshState>({
    pullDistance: 0,
    isRefreshing: false,
    isTriggered: false,
  });

  const startY = useRef(0);
  const pulling = useRef(false);
  const refreshing = useRef(false);

  const getScrollTop = useCallback(() => {
    if (containerRef?.current) return containerRef.current.scrollTop;
    return window.scrollY;
  }, [containerRef]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || refreshing.current) return;
    if (getScrollTop() > 2) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, [disabled, getScrollTop]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || refreshing.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      pulling.current = false;
      setState((s) => ({ ...s, pullDistance: 0, isTriggered: false }));
      return;
    }
    const clamped = Math.min(dy * RESISTANCE, THRESHOLD * 1.6);
    if (clamped > 4) e.preventDefault();
    setState({ pullDistance: clamped, isRefreshing: false, isTriggered: clamped >= THRESHOLD });
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;

    setState((s) => {
      if (s.pullDistance < THRESHOLD || refreshing.current) {
        return { pullDistance: 0, isRefreshing: false, isTriggered: false };
      }
      return s;
    });

    setState((prev) => {
      if (prev.pullDistance < THRESHOLD || refreshing.current) return prev;
      refreshing.current = true;
      void (async () => {
        try {
          await onRefresh();
        } finally {
          refreshing.current = false;
          setState({ pullDistance: 0, isRefreshing: false, isTriggered: false });
        }
      })();
      return { ...prev, isRefreshing: true };
    });
  }, [onRefresh]);

  useEffect(() => {
    const target = containerRef?.current ?? document;
    const opts: AddEventListenerOptions = { passive: false };
    target.addEventListener('touchstart', handleTouchStart as EventListener, { passive: true });
    target.addEventListener('touchmove', handleTouchMove as EventListener, opts);
    target.addEventListener('touchend', handleTouchEnd as EventListener, { passive: true });
    return () => {
      target.removeEventListener('touchstart', handleTouchStart as EventListener);
      target.removeEventListener('touchmove', handleTouchMove as EventListener);
      target.removeEventListener('touchend', handleTouchEnd as EventListener);
    };
  }, [containerRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const indicatorOpacity = Math.min(1, state.pullDistance / THRESHOLD);
  const indicatorRotation = (state.pullDistance / THRESHOLD) * 180;

  return { ...state, indicatorOpacity, indicatorRotation, threshold: THRESHOLD };
}
