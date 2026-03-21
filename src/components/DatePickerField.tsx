import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  forwardRef,
  type MutableRefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO, isValid } from 'date-fns';
import { DayPicker, type Matcher } from 'react-day-picker';
import { Calendar, ChevronDown } from 'lucide-react';
import { it } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { getTranslations, getDateLocale } from '../utils/translations';

import 'react-day-picker/style.css';

export type DatePickerFieldProps = {
  value: string;
  onChange: (isoDate: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Mostra «Cancella» nel footer (default true). */
  allowClear?: boolean;
  'aria-label'?: string;
};

const DatePickerField = forwardRef<HTMLButtonElement, DatePickerFieldProps>(function DatePickerField(
  { value, onChange, min, max, disabled, className = '', id, allowClear = true, 'aria-label': ariaLabel },
  ref
) {
  const { effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);
  const locale = getDateLocale(effectiveLanguage) ?? it;
  const clearLabel = (t as { date_picker_clear?: string }).date_picker_clear ?? 'Cancella';
  const chooseLabel = (t as { date_picker_choose?: string }).date_picker_choose ?? 'Scegli data';

  const innerRef = useRef<HTMLButtonElement | null>(null);
  const setButtonRef = useCallback(
    (node: HTMLButtonElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as MutableRefObject<HTMLButtonElement | null>).current = node;
    },
    [ref]
  );

  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const selected = value && isValid(parseISO(value)) ? parseISO(value) : undefined;

  const updatePos = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const popH = 400;
    const flip = r.bottom + popH > window.innerHeight - 12 && r.top > popH;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 296));
    setPos({
      top: flip ? Math.max(8, r.top - popH - 8) : r.bottom + 8,
      left,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node;
      if (popRef.current?.contains(n) || innerRef.current?.contains(n)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const matchers: Matcher[] = [];
  if (min && isValid(parseISO(min))) matchers.push({ before: parseISO(min) });
  if (max && isValid(parseISO(max))) matchers.push({ after: parseISO(max) });

  const defaultMonth = selected ?? (min && isValid(parseISO(min)) ? parseISO(min) : new Date());

  const label = selected ? format(selected, 'd MMM yyyy', { locale }) : chooseLabel;

  const popover =
    open &&
    !disabled &&
    createPortal(
      <div
        ref={popRef}
        className="fixed z-[10050] min-w-[288px] rounded-3xl border border-slate-200/90 bg-white p-3.5 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.22),0_4px_16px_-4px_rgba(45,90,39,0.1)]"
        style={{ top: pos.top, left: pos.left }}
        role="dialog"
        aria-modal="true"
        aria-label={chooseLabel}
      >
        <DayPicker
          mode="single"
          required={false}
          selected={selected}
          onSelect={(d) => {
            if (d) onChange(format(d, 'yyyy-MM-dd'));
            setOpen(false);
          }}
          locale={locale}
          captionLayout="dropdown"
          defaultMonth={defaultMonth}
          disabled={matchers.length ? matchers : undefined}
          className="rdp-modern"
        />
        <div
          className={`mt-3 flex items-center gap-2.5 border-t border-slate-100 pt-3.5 ${allowClear ? 'justify-between' : 'justify-end'}`}
        >
          {allowClear ? (
            <button
              type="button"
              className="rounded-2xl px-2.5 py-1.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              {clearLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-2xl bg-accent px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
            onClick={() => {
              onChange(format(new Date(), 'yyyy-MM-dd'));
              setOpen(false);
            }}
          >
            {t.today}
          </button>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <button
        ref={setButtonRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel ?? chooseLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`inline-flex h-[22px] min-h-[22px] max-h-[22px] shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-left text-[13px] font-medium leading-none tabular-nums text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50/80 focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <Calendar className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
        <span className="min-w-0 truncate tabular-nums">{label}</span>
        <ChevronDown className="ml-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
      </button>
      {popover}
    </>
  );
});

export default DatePickerField;
