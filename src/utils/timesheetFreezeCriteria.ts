import type { PunchRecord, Shift } from '../types';

/** Turno chiuso in contabilità: `approved` congelato oppure `absent` sigillato con `approved_at`. */
export function isShiftPayrollFrozen(shift: Pick<Shift, 'approval_status' | 'approved_at'>): boolean {
  if (!shift.approved_at) return false;
  const s = String(shift.approval_status || '').toLowerCase();
  return s === 'approved' || s === 'absent';
}

export type PunchCompleteness = { complete: boolean; missingIn: boolean; missingOut: boolean };

export function punchCompletenessForShift(shift: Shift, punchRecords: PunchRecord[]): PunchCompleteness {
  const punchIn = punchRecords.find(
    (p) => p.type === 'in' && (p.shift_id === shift.id || p.user_id === shift.user_id)
  );
  const missingIn = !punchIn;
  const clockOutRaw = punchIn ? ((punchIn as { clock_out_time?: string | null }).clock_out_time ?? null) : null;
  const punchOut = punchRecords.find(
    (p) => p.type === 'out' && (p.shift_id === shift.id || p.user_id === shift.user_id)
  );
  const actualEndRaw = clockOutRaw ?? punchOut?.timestamp ?? null;
  const missingOut = !!punchIn && !actualEndRaw;
  return {
    complete: !!punchIn && !!actualEndRaw,
    missingIn,
    missingOut,
  };
}

/** Presenze: congelamento sempre possibile per turni non futuri e non già sigillati. */
export function shiftCanBeFrozenFromTimesheet(
  shift: Shift,
  punchRecords: PunchRecord[],
  todayStr: string
): boolean {
  if (shift.date > todayStr) return false;
  if (isShiftPayrollFrozen(shift)) return false;
  if (shift.approval_status === 'absent') return true;
  const st = shift.approval_status;
  if (st !== 'confirmed' && st !== 'draft' && !(st === 'approved' && !shift.approved_at)) return false;
  // Permetti sempre il congelamento se non è futuro e non è già sigillato
  return true;
}
