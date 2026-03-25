import { format, isValid, parseISO, type Locale } from 'date-fns';

/**
 * Converte input in Date solo se valida per date-fns (evita RangeError da `format`).
 */
export function toValidDate(input: Date | string | number | null | undefined): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return isValid(input) ? input : null;
  if (typeof input === 'number') {
    const d = new Date(input);
    return isValid(d) ? d : null;
  }
  const s = String(input).trim();
  if (!s) return null;
  try {
    const d = /^\d{4}-\d{2}-\d{2}/.test(s) ? parseISO(s) : new Date(s);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

/**
 * Come `format` ma non lancia mai: data non valida → fallback stringa o em dash.
 */
export function safeFormatDate(
  input: Date | string | number | null | undefined,
  fmt: string,
  options?: { locale?: Locale }
): string {
  const d = toValidDate(input);
  if (!d) return typeof input === 'string' && input.trim() ? input.trim() : '—';
  try {
    return format(d, fmt, options);
  } catch {
    return typeof input === 'string' && input.trim() ? input.trim() : '—';
  }
}
