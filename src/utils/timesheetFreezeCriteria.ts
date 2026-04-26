import type { Shift } from '../types';

/** Turno chiuso in contabilità: `approved` congelato oppure `absent` sigillato con `approved_at`. */
export function isShiftPayrollFrozen(shift: Pick<Shift, 'approval_status' | 'approved_at'>): boolean {
  if (!shift.approved_at) return false;
  const s = String(shift.approval_status || '').toLowerCase();
  return s === 'approved' || s === 'absent';
}
