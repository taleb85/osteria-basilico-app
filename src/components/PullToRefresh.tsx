import { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

const PULL_THRESHOLD = 60;
const RESISTANCE = 0.4;

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export default function PullToRefresh({ onRefresh, children, className = '', disabled }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const scrollTop = useRef(0);
  const mainRef = useRef<HTMLElement | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshing) return;
      startY.current = e.touches[0].clientY;
      const el = e.currentTarget;
      scrollTop.current = el.scrollTop;
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshing) return;
      if (scrollTop.current > 0) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;
      if (diff > 0) {
        const resisted = Math.min(diff * RESISTANCE, PULL_THRESHOLD * 1.5);
        setPullDistance(resisted);
        // preventDefault è gestito dal listener nativo con { passive: false } sotto
      }
    },
    [disabled, isRefreshing]
  );

  // Listener nativo con passive: false per poter chiamare preventDefault (altrimenti il browser lo ignora)
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      if (scrollTop.current > 0) return;
      if (e.touches.length === 0) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;
      if (diff > 2) e.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [disabled, isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (disabled || isRefreshing) return;
    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(0);
      onRefresh()
        .then(() => {})
        .catch(() => {})
        .finally(() => setIsRefreshing(false));
    } else {
      setPullDistance(0);
    }
  }, [disabled, isRefreshing, pullDistance, onRefresh]);

  const showRefresher = pullDistance > 0 || isRefreshing;
  const refresherHeight = Math.max(pullDistance, isRefreshing ? PULL_THRESHOLD : 0);

  return (
    <div className={`flex flex-col flex-1 min-h-0 ${className}`}>
      <div
        className="flex-shrink-0 flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out bg-[#f8fafc]"
        style={{ height: refresherHeight }}
      >
        {showRefresher && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-6 h-6 text-accent animate-spin" strokeWidth={2.5} />
          </div>
        )}
      </div>
      <main
        ref={mainRef}
        className="flex-1 w-full overflow-y-scroll overflow-x-hidden scrollbar-hide smooth-touch min-h-0 touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {children}
      </main>
    </div>
  );
}
