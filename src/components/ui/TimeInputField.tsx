import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export type TimeInputFieldProps = {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  /** `lg` = drawer tabellone; `hero` = modali chiusura turno (testo molto grande). */
  size?: 'md' | 'lg' | 'hero';
  disabled?: boolean;
  id?: string;
  /** Ref al campo ore (es. focus da click su riepilogo). */
  hourInputRef?: React.Ref<HTMLInputElement>;
  'aria-label'?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  /** Dopo Invio sui minuti: flush applicato, poi questo callback (es. focus campo successivo o invio form). */
  onMinutesEnter?: () => void;
  /** Chiamato quando il focus esce dall'intero componente (dopo flush). Utile per auto-save. */
  onBlurCommit?: () => void;
  style?: React.CSSProperties;
  autoFocus?: boolean;
};

function splitIncoming(v: string): { h: string; m: string } {
  const t = (v || '').trim();
  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { h: '', m: '' };
  return { h: match[1], m: match[2] };
}

function digitsOnly(s: string, maxLen: number): string {
  return s.replace(/\D/g, '').slice(0, maxLen);
}

/**
 * Ora HH:mm senza `type="time"` (niente icona orologio del browser).
 * Due campi ore / minuti, invio valore normalizzato su blur e su Enter.
 */
export function TimeInputField({
  value,
  onChange,
  className = '',
  size = 'md',
  disabled,
  id,
  hourInputRef,
  'aria-label': ariaLabel,
  onKeyDown,
  onMinutesEnter,
  onBlurCommit,
  style,
  autoFocus,
}: TimeInputFieldProps) {
  const { h: h0, m: m0 } = splitIncoming(value);
  const [h, setH] = useState(h0);
  const [m, setM] = useState(m0);
  const minuteInputRef = useRef<HTMLInputElement | null>(null);
  /** Sempre valorizzato: serve per focus da click su bordo / “:” / padding. */
  const hourLocalRef = useRef<HTMLInputElement | null>(null);

  const setHourInputEl = useCallback(
    (node: HTMLInputElement | null) => {
      hourLocalRef.current = node;
      if (hourInputRef == null) return;
      if (typeof hourInputRef === 'function') {
        hourInputRef(node);
      } else {
        (hourInputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    },
    [hourInputRef]
  );

  const focusHourSelect = useCallback(() => {
    const hel = hourLocalRef.current;
    if (!hel || disabled) return;
    hel.focus({ preventScroll: true });
    queueMicrotask(() => hel.select());
  }, [disabled]);

  useEffect(() => {
    const { h: hi, m: mi } = splitIncoming(value);
    setH(hi);
    setM(mi);
  }, [value]);

  const flush = useCallback(() => {
    const hd = digitsOnly(h, 2);
    const md = digitsOnly(m, 2);
    const { h: prevH, m: prevM } = splitIncoming(value);

    if (!hd && !md) {
      flushSync(() => {
        onChange('');
      });
      setH('');
      setM('');
      return;
    }

    const hn =
      hd !== ''
        ? Math.min(23, parseInt(hd, 10) || 0)
        : (() => {
            const p = digitsOnly(prevH, 2);
            return p === '' ? 0 : Math.min(23, parseInt(p, 10) || 0);
          })();

    let mn: number;
    if (md !== '') {
      mn = Math.min(59, parseInt(md, 10) || 0);
    } else if (hd !== '') {
      const p = digitsOnly(prevM, 2);
      mn = p === '' ? 0 : Math.min(59, parseInt(p, 10) || 0);
    } else {
      const p = digitsOnly(prevM, 2);
      mn = p === '' ? 0 : Math.min(59, parseInt(p, 10) || 0);
    }

    const out = `${String(hn).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
    flushSync(() => {
      onChange(out);
    });
    setH(String(hn).padStart(2, '0'));
    setM(String(mn).padStart(2, '0'));
  }, [h, m, value, onChange]);

  const handleHourKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      flush();
      requestAnimationFrame(() => {
        minuteInputRef.current?.focus();
        minuteInputRef.current?.select();
      });
      return;
    }
    onKeyDown?.(e);
  };

  const handleMinuteKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      flush();
      (e.target as HTMLInputElement).blur();
      onMinutesEnter?.();
      return;
    }
    onKeyDown?.(e);
  };

  const boxSize =
    size === 'hero'
      ? 'min-h-[56px] gap-1 rounded-xl border px-2 py-2 text-3xl'
      : size === 'lg'
        ? 'min-h-[52px] gap-1 rounded-xl border px-1.5 py-2 text-xl'
        : 'min-h-[44px] gap-0.5 rounded-xl border-2 px-1 text-sm font-semibold';
  const inner =
    'min-w-0 flex-1 bg-transparent text-center font-bold tabular-nums text-white outline-none placeholder:text-white/30 focus:outline-none cursor-pointer';

  const borderTone =
    size === 'hero'
      ? 'border-white/20 focus-within:border-transparent focus-within:ring-2 focus-within:ring-accent'
      : size === 'lg'
        ? 'border-white/20 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30'
        : 'border-white/20 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25';

  return (
    <div
      className={`flex max-w-full min-w-0 touch-manipulation items-center justify-center bg-white/10 shadow-sm transition-colors ${boxSize} ${borderTone} ${disabled ? 'opacity-60' : 'cursor-text'} ${className}`.trim()}
      style={style}
      onBlur={(e) => {
        // Fires only when focus leaves the entire component (not moving between hour/minute)
        if (onBlurCommit && !e.currentTarget.contains(e.relatedTarget as Node)) {
          onBlurCommit();
        }
      }}
      onPointerDownCapture={(e) => {
        if (disabled) return;
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        const hel = hourLocalRef.current;
        if (!hel) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.pointerType === 'mouse') e.preventDefault();
        focusHourSelect();
      }}
    >
      <input
        id={id}
        ref={setHourInputEl}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        placeholder="00"
        aria-label={ariaLabel ? `${ariaLabel} — ore` : 'Ore'}
        disabled={disabled}
        autoFocus={autoFocus}
        value={h}
        onChange={(e) => {
          const next = digitsOnly(e.target.value, 2);
          const prevLen = h.length;
          setH(next);
          if (next.length === 2 && prevLen < 2) {
            requestAnimationFrame(() => {
              minuteInputRef.current?.focus();
              minuteInputRef.current?.select();
            });
          }
        }}
        onBlur={flush}
        onFocus={(e) => e.target.select()}
        onKeyDown={handleHourKeyDown}
        className={`${inner} pl-2 pr-0.5`}
      />
      <span className="select-none text-white/40" aria-hidden>
        :
      </span>
      <input
        ref={minuteInputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        placeholder="00"
        aria-label={ariaLabel ? `${ariaLabel} — minuti` : 'Minuti'}
        disabled={disabled}
        value={m}
        onChange={(e) => setM(digitsOnly(e.target.value, 2))}
        onBlur={flush}
        onFocus={(e) => e.target.select()}
        onKeyDown={handleMinuteKeyDown}
        className={`${inner} pl-0.5 pr-2`}
      />
    </div>
  );
}
