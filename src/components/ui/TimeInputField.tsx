import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

export type TimeInputFieldProps = {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  /** `lg` = drawer tabellone; `hero` = modali chiusura turno (testo molto grande). */
  size?: 'md' | 'lg' | 'hero';
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
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
  'aria-label': ariaLabel,
  onKeyDown,
  style,
  autoFocus,
}: TimeInputFieldProps) {
  const { h: h0, m: m0 } = splitIncoming(value);
  const [h, setH] = useState(h0);
  const [m, setM] = useState(m0);

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

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      flush();
      (e.target as HTMLInputElement).blur();
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
    'min-w-0 flex-1 bg-transparent text-center font-bold tabular-nums text-slate-900 outline-none placeholder:text-slate-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500';

  const borderTone =
    size === 'hero'
      ? 'border-slate-200 bg-white focus-within:border-transparent focus-within:ring-2 focus-within:ring-accent dark:border-white/10 dark:bg-neutral-950 dark:focus-within:ring-accent'
      : size === 'lg'
        ? 'border-slate-200 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 dark:border-white/10 dark:bg-neutral-800 dark:focus-within:border-accent'
        : 'border-slate-300 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 dark:border-white/15 dark:bg-neutral-800 dark:focus-within:border-accent';

  return (
    <div
      className={`flex max-w-full min-w-0 items-center justify-center bg-white shadow-sm transition-colors ${boxSize} ${borderTone} ${disabled ? 'opacity-60' : ''} ${className}`.trim()}
      style={style}
    >
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        placeholder="00"
        aria-label={ariaLabel ? `${ariaLabel} — ore` : 'Ore'}
        disabled={disabled}
        autoFocus={autoFocus}
        value={h}
        onChange={(e) => setH(digitsOnly(e.target.value, 2))}
        onBlur={flush}
        onKeyDown={handleKeyDown}
        className={`${inner} pl-2 pr-0.5`}
      />
      <span className="select-none text-slate-400 dark:text-neutral-500" aria-hidden>
        :
      </span>
      <input
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
        onKeyDown={handleKeyDown}
        className={`${inner} pl-0.5 pr-2`}
      />
    </div>
  );
}
