import { format, parseISO, startOfWeek, startOfDay, addDays } from 'date-fns';

export const PERIOD_STORAGE_KEY = 'osteria_timesheet_period';

export type PeriodConfig = { startDate: string; numWeeks: 4 | 5 };

const PERIOD_UPDATED_EVENT = 'osteria_period_updated';

/** Notifica tutti i componenti che il periodo presenze è cambiato (localStorage o remoto). */
export function dispatchPeriodConfigUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PERIOD_UPDATED_EVENT));
  }
}

/**
 * Valida JSON remoto / oggetto arbitrario come PeriodConfig.
 * Ritorna null se non è utilizzabile (non sovrascrivere il locale).
 */
export function coercePeriodConfig(parsed: unknown): PeriodConfig | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const numWeeks = o.numWeeks === 5 ? 5 : 4;
  if (typeof o.startDate !== 'string') return null;
  const startStr = o.startDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr)) return null;
  const testDate = parseISO(startStr);
  if (Number.isNaN(testDate.getTime())) return null;
  return { startDate: startStr, numWeeks: numWeeks as 4 | 5 };
}

/** Carica la configurazione periodo da localStorage (data inizio + 4 o 5 settimane). */
export function loadPeriodConfig(): PeriodConfig {
  const now = new Date();
  const defaultStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return { startDate: defaultStart, numWeeks: 4 };
    }
    const raw = localStorage.getItem(PERIOD_STORAGE_KEY);
    if (!raw || typeof raw !== 'string') return { startDate: defaultStart, numWeeks: 4 };
    const parsed = JSON.parse(raw) as { startDate?: string; numWeeks?: number };
    const numWeeks = (parsed?.numWeeks === 5 ? 5 : 4) as 4 | 5;
    const startStr = parsed?.startDate ? String(parsed.startDate).slice(0, 10) : defaultStart;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr)) return { startDate: defaultStart, numWeeks };
    const testDate = parseISO(startStr);
    if (Number.isNaN(testDate.getTime())) return { startDate: defaultStart, numWeeks };
    return { startDate: startStr, numWeeks };
  } catch {
    try {
      localStorage.removeItem(PERIOD_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return { startDate: defaultStart, numWeeks: 4 };
  }
}

/** Salva la configurazione periodo in localStorage. */
export function savePeriodConfig(cfg: PeriodConfig): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(cfg));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Indice settimana (0-based) nel periodo configurato che contiene `refDate` (default: oggi).
 * Allineato al pulsante «Oggi» in Gestione turni: fuori dall’intervallo → clamp a 0 … ultima settimana.
 */
export function weekIndexForDateInPeriod(config: PeriodConfig, refDate: Date = new Date()): number {
  const periodStart = getPeriodStartDate(config);
  const maxWeekIndex = Math.max(0, config.numWeeks - 1);
  const refDay = startOfDay(refDate);
  const diffDays = Math.round((refDay.getTime() - periodStart.getTime()) / 86_400_000);
  return Math.max(0, Math.min(maxWeekIndex, Math.floor(diffDays / 7)));
}

/** Restituisce la data di inizio del periodo (startOfDay). */
export function getPeriodStartDate(config: PeriodConfig): Date {
  const defaultStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  try {
    const d = parseISO(config.startDate);
    if (Number.isNaN(d.getTime())) return startOfDay(parseISO(defaultStart));
    return startOfDay(d);
  } catch {
    return startOfDay(parseISO(defaultStart));
  }
}

/** Restituisce la data di fine del periodo (ultimo giorno). */
export function getPeriodEndDate(config: PeriodConfig): Date {
  const start = getPeriodStartDate(config);
  return addDays(start, Math.max(1, config.numWeeks) * 7 - 1);
}

/** Restituisce { startDate, endDate } in formato yyyy-MM-dd per il periodo. */
export function getPeriodDateRange(config: PeriodConfig): { startDate: string; endDate: string } {
  const start = getPeriodStartDate(config);
  const end = getPeriodEndDate(config);
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  };
}
