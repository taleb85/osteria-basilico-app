/**
 * Verifica se un turno è "completato".
 * 
 * Semplificazione: un turno è completato quando ha almeno una timbratura
 * di entrata (type: 'in') e una di uscita (type: 'out') associate.
 * 
 * Non esiste più il concetto di "congelamento" o "approvazione con PIN".
 * La presenza di punch_records determina lo stato di completamento.
 */

import type { Shift, PunchRecord } from '../types';

export interface PunchRecordLike {
  id?: string;
  shift_id?: string;
  user_id: string;
  timestamp: string;
  calculated_time?: string | null;
  clock_out_time?: string | null;
  type: 'in' | 'out';
}

/**
 * Verifica se un turno ha timbratura di entrata registrata.
 */
export function hasPunchIn(
  shift: Pick<Shift, 'id' | 'user_id' | 'date' | 'start_time'>,
  punchRecords: PunchRecordLike[]
): boolean {
  const shiftHour = parseInt((shift.start_time || '00:00').split(':')[0] ?? '0', 10);
  const isLunch = !isNaN(shiftHour) && shiftHour < 16;

  return punchRecords.some((p) => {
    if (p.type !== 'in') return false;
    if (shift.id && p.shift_id) return p.shift_id === shift.id;
    if (p.user_id !== shift.user_id) return false;
    const pDate = new Date(p.timestamp);
    if (isNaN(pDate.getTime())) return false;
    const pDateStr = pDate.toISOString().split('T')[0];
    if (pDateStr !== shift.date) return false;
    return isLunch ? pDate.getHours() < 16 : pDate.getHours() >= 16;
  });
}

/**
 * Verifica se un turno ha timbratura di uscita registrata.
 * Supporta night-rollover (turno serale con uscita il giorno dopo).
 */
export function hasPunchOut(
  shift: Pick<Shift, 'id' | 'user_id' | 'date' | 'start_time'>,
  punchRecords: PunchRecordLike[]
): boolean {
  const shiftHour = parseInt((shift.start_time || '00:00').split(':')[0] ?? '0', 10);
  const isLunch = !isNaN(shiftHour) && shiftHour < 16;
  const isEvening = !isLunch;

  const punchIn = punchRecords.find((p) => {
    if (p.type !== 'in') return false;
    if (shift.id && p.shift_id) return p.shift_id === shift.id;
    if (p.user_id !== shift.user_id) return false;
    return true;
  });

  // clock_out_time sul record di entrata
  if (punchIn?.clock_out_time) return true;

  return punchRecords.some((p) => {
    if (p.type !== 'out') return false;
    if (shift.id && p.shift_id) return p.shift_id === shift.id;
    if (p.user_id !== shift.user_id) return false;
    const pDate = new Date(p.timestamp);
    if (isNaN(pDate.getTime())) return false;
    const pDateStr = pDate.toISOString().split('T')[0];
    // Stesso giorno
    if (pDateStr === shift.date) {
      return isLunch ? pDate.getHours() < 16 : pDate.getHours() >= 16;
    }
    // Night-rollover per turni serali
    if (isEvening && pDateStr === _nextDay(shift.date)) {
      return true;
    }
    return false;
  });
}

function _nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

/**
 * Un turno è completato se ha sia entrata che uscita.
 * È il concetto che sostituisce "isShiftPayrollFrozen".
 */
export function isShiftComplete(
  shift: Pick<Shift, 'id' | 'user_id' | 'date' | 'start_time'>,
  punchRecords: PunchRecordLike[]
): boolean {
  return hasPunchIn(shift, punchRecords) && hasPunchOut(shift, punchRecords);
}


