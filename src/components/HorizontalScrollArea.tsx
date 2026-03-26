import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Variant = 'toolbar' | 'overlay';

export type HorizontalScrollWeekNav = {
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
};

type Props = {
  children: ReactNode;
  className?: string;
  scrollClassName?: string;
  /** Ricalcola overflow quando cambia il contenuto (es. settimana). */
  remeasureKey?: unknown;
  ariaLabelPrev: string;
  ariaLabelNext: string;
  /**
   * Se impostato (es. Presenze vista settimana), le frecce cambiano settimana nel periodo
   * invece di scorrere orizzontalmente.
   */
  weekNav?: HorizontalScrollWeekNav;
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
  'absolute top-0 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200/80 dark:border-white/12 bg-slate-50/55 text-slate-500 shadow-sm backdrop-blur-md transition-[color,box-shadow,transform] hover:border-slate-300 hover:bg-slate-50/90 hover:text-slate-800 dark:bg-neutral-900/45 dark:hover:border-white/18 dark:hover:bg-neutral-800/55 dark:hover:text-neutral-100 active:scale-95 disabled:pointer-events-none disabled:opacity-0';

export function HorizontalScrollArea({
  children,
  className = '',
  scrollClassName = 'overflow-x-auto-safe',
  remeasureKey,
  ariaLabelPrev,
  ariaLabelNext,
  weekNav,
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

  useEffect(() => {
    if (!weekNav) return;
    const el = scrollRef.current;
    if (el) el.scrollLeft = 0;
  }, [remeasureKey, weekNav]);

  const scrollBy = (dx: number) => {
    scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' });
  };

  const useWeekNav = weekNav != null;
  const showNav = useWeekNav ? weekNav.canPrev || weekNav.canNext : canLeft || canRight;
  const prevDisabled = useWeekNav ? !weekNav.canPrev : !canLeft;
  const nextDisabled = useWeekNav ? !weekNav.canNext : !canRight;
  const onPrevClick = useWeekNav ? weekNav.onPrev : () => scrollBy(-delta);
  const onNextClick = useWeekNav ? weekNav.onNext : () => scrollBy(delta);

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
            disabled={prevDisabled}
            onClick={onPrevClick}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center surface-glass-sm text-slate-600 transition-colors surface-ghost-interactive disabled:pointer-events-none disabled:opacity-35 dark:text-neutral-300"
            aria-label={ariaLabelPrev}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            disabled={nextDisabled}
            onClick={onNextClick}
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
            disabled={prevDisabled}
            onClick={onPrevClick}
            className={`left-[-1px] ${overlayBtnClass}`}
            aria-label={ariaLabelPrev}
          >
            <ChevronLeft className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          </button>
          <button
            type="button"
            disabled={nextDisabled}
            onClick={onNextClick}
            className={`right-0 ${overlayBtnClass}`}
            aria-label={ariaLabelNext}
          >
            <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}
