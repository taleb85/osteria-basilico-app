import { format } from 'date-fns';
import type { Shift } from '../types';

export type PunchRecordLike = {
  shift_id?: string;
  user_id: string;
  timestamp: string;
  calculated_time?: string | null;
  clock_out_time?: string | null;
  type: 'in' | 'out';
};

export function punchTimeHHMM(ts: string | null | undefined): string | null {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

/**
 * Allinea IN/OUT allo stesso criterio di Presenze / Home: pranzo vs cena da ora pianificata,
 * match per shift_id se presente, altrimenti stesso user + data.
 */
export function getPunchPairForShift(
  shift: { id: string; user_id: string; date: string; start_time?: string; end_time?: string },
  punchRecords: PunchRecordLike[]
): {
  punchIn: PunchRecordLike | undefined;
  punchOut: PunchRecordLike | undefined;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
} {
  const dateStr = shift.date;
  const plannedStart = (shift.start_time || '').slice(0, 5);
  const plannedEnd = (shift.end_time || '').slice(0, 5);
  const shiftHour = parseInt(plannedStart.split(':')[0] ?? '0', 10);
  const isLunch = !Number.isNaN(shiftHour) && shiftHour < 16;

  const punchIn = punchRecords.find((p) => {
    if (p.type !== 'in') return false;
    if (shift.id && p.shift_id) return p.shift_id === shift.id;
    if (p.user_id !== shift.user_id) return false;
    const pDate = new Date(p.timestamp);
    if (format(pDate, 'yyyy-MM-dd') !== dateStr) return false;
    return isLunch ? pDate.getHours() < 16 : pDate.getHours() >= 16;
  });

  const punchOut = punchRecords.find((p) => {
    if (p.type !== 'out') return false;
    if (shift.id && p.shift_id) return p.shift_id === shift.id;
    if (p.user_id !== shift.user_id) return false;
    const pDate = new Date(p.timestamp);
    if (format(pDate, 'yyyy-MM-dd') !== dateStr) return false;
    return isLunch ? pDate.getHours() < 16 : pDate.getHours() >= 16;
  });

  const clockOutRaw = punchIn?.clock_out_time ?? null;
  const actualEndRaw = clockOutRaw ?? punchOut?.timestamp ?? null;

  const actualStart = punchIn
    ? punchTimeHHMM((punchIn.calculated_time || punchIn.timestamp) as string) ?? plannedStart
    : null;
  const actualEnd = actualEndRaw ? punchTimeHHMM(actualEndRaw) : null;

  return { punchIn, punchOut, plannedStart, plannedEnd, actualStart, actualEnd };
}

export type ResolvedClockSource = 'frozen' | 'punch' | 'planned';

/**
 * Orari usati per ore nette / confronti: dopo congelamento solo approved_* + approved_at;
 * altrimenti timbrature se complete, altrimenti pianificato.
 */
export function getResolvedStartEndForHours(
  shift: Shift,
  punchRecords: PunchRecordLike[]
): { start: string; end: string; source: ResolvedClockSource } {
  const aS = shift.approved_start_time?.trim();
  const aE = shift.approved_end_time?.trim();
  if (shift.approved_at && aS && aE) {
    return { start: aS.slice(0, 5), end: aE.slice(0, 5), source: 'frozen' };
  }

  const { actualStart, actualEnd, plannedStart, plannedEnd } = getPunchPairForShift(shift, punchRecords);
  if (actualStart && actualEnd) {
    return { start: actualStart, end: actualEnd, source: 'punch' };
  }
  if (actualStart && plannedEnd) {
    return { start: actualStart, end: plannedEnd, source: 'punch' };
  }
  return {
    start: plannedStart,
    end: plannedEnd || plannedStart,
    source: 'planned',
  };
}

/** Valori default per il modale di approvazione: timbrature se ci sono, altrimenti pianificato. */
export function getDefaultApprovalClockHHMM(
  shift: Shift,
  punchRecords: PunchRecordLike[]
): { start: string; end: string } {
  const { actualStart, actualEnd, plannedStart, plannedEnd } = getPunchPairForShift(shift, punchRecords);
  return {
    start: (actualStart ?? plannedStart).slice(0, 5),
    end: (actualEnd ?? plannedEnd ?? plannedStart).slice(0, 5),
  };
}
