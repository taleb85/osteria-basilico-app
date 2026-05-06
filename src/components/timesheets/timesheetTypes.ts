import type { PunchAuditEntry } from '../../types';
import type { HistoryEntry } from '../../utils/scheduleHistory';
import { isShiftPayrollFrozen } from '../../utils/timesheetFreezeCriteria';

// ── Closing Shift State ─────────────────────────────────────────────────────

export interface ClosingShiftState {
  shiftId: string;
  punchInId: string;
  dateStr: string;
  plannedStart: string;
  plannedEnd: string;
  plannedMins: number;
  actualStart: string;
  employeeName: string;
}

// ── Shift Row ───────────────────────────────────────────────────────────────

export interface ShiftRow {
  id: string;
  plannedStart: string;
  plannedEnd: string;
  plannedMins: number;
  /** Detrazione pausa sul pianificato (regole / fallback sul turno pianificato). */
  breakMinutes: number;
  /** Detrazione pausa sulle ore effettive (timbratura / congelato); 0 se effettivo incompleto. */
  breakMinutesActual: number;
  actualStart: string | null;
  actualEnd: string | null;
  actualEndFull?: string;
  actualMins: number;
  deltaMins: number;
  /** In griglia l’effettivo deriva da orari congelati (approved_start/end), non da timbrature grezze. */
  displayFromFrozenApprovedTimes?: boolean;
  status: 'approved' | 'confirmed' | 'draft' | 'absent';
  punched: boolean;
  punchInId?: string;
  punchOutId?: string;
  punchInSource?: import('../../types').PunchRecordSource | null;
  punchOutSource?: import('../../types').PunchRecordSource | null;
  isLate: boolean;
  hasMissingOut: boolean;
  isCrossDay?: boolean;
  /** Uscita legittima il giorno dopo (mezzanotte / notte), solo informativo in UI. */
  nightRolloverOk?: boolean;
  approved_by?: string;
  approved_at?: string;
}

// ── Partition shifts by planned hour ────────────────────────────────────────

/** Pranzo / mattina < 16:00 in alto; cena (inizio pianificato ≥ 16:00) in basso nella cella. */
export function partitionShiftsByPlannedHour16(shifts: ShiftRow[]): { before16: ShiftRow[]; from16: ShiftRow[] } {
  const before16: ShiftRow[] = [];
  const from16: ShiftRow[] = [];
  for (const s of shifts) {
    const hour = parseInt((s.plannedStart || '00:00').split(':')[0], 10) || 0;
    if (hour >= 16) from16.push(s);
    else before16.push(s);
  }
  return { before16, from16 };
}

// ── Day Data ────────────────────────────────────────────────────────────────

export interface DayData {
  dateStr: string;
  shifts: ShiftRow[];
  totalPlannedMins: number;
  totalActualMins: number;
  totalDeltaMins: number;
  /** Somma ore nette da turni con orario ufficiale congelato (solo per totali in modalità solo pianificato). */
  totalFrozenOfficialMins: number;
}

// ── Drawer Data ─────────────────────────────────────────────────────────────

export interface DrawerData {
  shift: ShiftRow;
  userId: string;
  employeeName: string;
  department?: string;
  dateStr: string;
  punchAuditEntries: PunchAuditEntry[];
  shiftEdits: HistoryEntry[];
}

// ── Review Queue ────────────────────────────────────────────────────────────

/** Coda «revisione giornata» / settimana per dipendente: stesso modal, navigazione 1/N e salva/prossimo. */
export type DrawerReviewQueueItem = {
  userId: string;
  employeeName: string;
  department?: string;
  shift: ShiftRow;
  /** Giorno di calendario del turno (yyyy-MM-dd). */
  dateStr: string;
};

export type DrawerReviewQueue = {
  dateStr: string;
  items: DrawerReviewQueueItem[];
  currentIdx: number;
  reviewScope?: 'day' | 'employee_week';
  completed?: boolean;
};

// ── Shift predicates ────────────────────────────────────────────────────────

export function shiftRowPayrollFrozen(s: ShiftRow): boolean {
  return isShiftPayrollFrozen({
    approval_status: s.status,
    approved_at: s.approved_at ?? null,
  });
}

/** Stessi criteri di `handleOpenDayReview` (header «revisiona» e modal). */
export function shiftEligibleForDayReview(s: ShiftRow): boolean {
  if (s.status === 'absent') return false;
  return s.status !== 'approved' && !shiftRowPayrollFrozen(s);
}

/** Turno pronto per approvazione massiva: assenza, già congelato in griglia, o timbratura con entrata e uscita (niente uscita mancante). */
export function shiftRowCompleteForToolbarApprove(row: ShiftRow): boolean {
  if (row.status === 'absent') return true;
  if (row.displayFromFrozenApprovedTimes) return true;
  if (shiftRowPayrollFrozen(row)) return true;
  if (row.hasMissingOut) return false;
  if (!row.punched) return false;
  return !!(row.actualStart && row.actualEnd);
}

