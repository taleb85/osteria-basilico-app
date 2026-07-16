import type { Shift } from '../types';

/**
 * Verifica se un turno è congelato per la gestione stipendi/payroll.
 * Un turno è congelato se è stato approvato (approval_status === 'approved')
 * o se è confermato (approval_status === 'confirmed') con un timestamp di approvazione.
 */
export function isShiftPayrollFrozen(shift: Pick<Shift, 'approval_status' | 'approved_at'>): boolean {
  return (
    shift.approval_status === 'frozen' ||
    shift.approval_status === 'approved' ||
    (shift.approval_status === 'confirmed' && !!shift.approved_at)
  );
}
