import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Variant = 'toolbar' | 'overlay';

type Props = {
  children: ReactNode;
  className?: string;
  scrollClassName?: string;
  /** Ricalcola overflow quando cambia il contenuto (es. settimana). */
  remeasureKey?: unknown;
  ariaLabelPrev: string;
  ariaLabelNext: string;
  delta?: number;
  /** Classi Tailwind sulla riga dei pulsanti (solo `variant="toolbar"`). */
  navRowClassName?: string;
  /**
   * `toolbar`: riga pulsanti sopra lo scroll (default).
   * `overlay`: pulsanti tondi sui bordi (senza fascia gradiente, evita artefatti verticali).
   */
  variant?: Variant;
};

const overlayBtnClass =
  'absolute top-3 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 dark:border-white/12 bg-slate-50/55 text-slate-500 shadow-sm backdrop-blur-md transition-[color,box-shadow,transform] hover:border-slate-300 hover:bg-slate-50/90 hover:text-slate-800 dark:bg-neutral-900/45 dark:hover:border-white/18 dark:hover:bg-neutral-800/55 dark:hover:text-neutral-100 active:scale-95 disabled:pointer-events-none disabled:opacity-0';

export function HorizontalScrollArea({
  children,
  className = '',
  scrollClassName = 'overflow-x-auto-safe',
  remeasureKey,
  ariaLabelPrev,
  ariaLabelNext,
  delta = 280,
  navRowClassName = '',
  variant = 'toolbar',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 1;
    setCanLeft(overflow && scrollLeft > 2);
    setCanRight(overflow && scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [update, remeasureKey]);

  const scrollBy = (dx: number) => {
    scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' });
  };

  const showNav = canLeft || canRight;

  const rootClass =
    variant === 'overlay'
      ? `relative ${className}`.trim()
      : className;

  return (
    <div className={rootClass}>
      {variant === 'toolbar' && showNav && (
        <div className={`flex justify-end gap-1 pb-2 ${navRowClassName}`}>
          <button
            type="button"
            disabled={!canLeft}
            onClick={() => scrollBy(-delta)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center surface-glass-sm text-slate-600 transition-colors surface-ghost-interactive disabled:pointer-events-none disabled:opacity-35 dark:text-neutral-300"
            aria-label={ariaLabelPrev}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            disabled={!canRight}
            onClick={() => scrollBy(delta)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center surface-glass-sm text-slate-600 transition-colors surface-ghost-interactive disabled:pointer-events-none disabled:opacity-35 dark:text-neutral-300"
            aria-label={ariaLabelNext}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      <div ref={scrollRef} onScroll={update} className={scrollClassName}>
        {children}
      </div>
      {variant === 'overlay' && showNav && (
        <>
          <button
            type="button"
            disabled={!canLeft}
            onClick={() => scrollBy(-delta)}
            className={`left-1 ${overlayBtnClass}`}
            aria-label={ariaLabelPrev}
          >
            <ChevronLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            disabled={!canRight}
            onClick={() => scrollBy(delta)}
            className={`right-1 ${overlayBtnClass}`}
            aria-label={ariaLabelNext}
          >
            <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}
