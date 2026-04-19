/**
 * Auto-Conferma Timbrature
 *
 * Scansiona i turni del giorno precedente e approva automaticamente quelli che
 * soddisfano tutti e tre i criteri:
 *   1. GPS verificato al momento della timbratura (source === 'kiosk')
 *   2. Scarto orario ≤ thresholdMinutes rispetto al turno pianificato
 *   3. Nessuna anomalia (sia entrata che uscita presenti)
 *
 * I turni che non soddisfano i criteri rimangono in stato 'draft' per revisione manuale.
 */

import { addDays, format, isValid, parseISO } from 'date-fns';
import type { Shift, PunchRecord } from '../types';

const AUTO_APPROVE_ACTOR = 'Sistema (Auto)';

// ── Helpers ────────────────────────────────────────────────────────────────────

function hmToMins(hhmm: string): number {
  const parts = hhmm.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  if (!isValid(d)) return '00:00';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Core logic ─────────────────────────────────────────────────────────────────

export interface AutoApproveShiftResult {
  ok: boolean;
  approvedStart?: string;
  approvedEnd?: string;
  /** Motivo del rifiuto, utile per debug/logging. */
  reason?: string;
}

/**
 * Valuta se un singolo turno soddisfa i criteri di auto-approvazione.
 * Non modifica alcun dato — restituisce solo il risultato della valutazione.
 */
export function shouldAutoApproveShift(
  shift: Shift,
  allPunches: PunchRecord[],
  thresholdMinutes = 5,
): AutoApproveShiftResult {
  // 1. Salta turni già processati
  if (shift.approval_status === 'approved' || shift.approval_status === 'absent') {
    return { ok: false, reason: 'already_processed' };
  }
  if (shift.approved_at) {
    return { ok: false, reason: 'already_has_approved_at' };
  }

  const plannedStart = (shift.start_time || '').slice(0, 5);
  const plannedEnd = (shift.end_time || '').slice(0, 5);
  if (!plannedStart || !plannedEnd) return { ok: false, reason: 'no_planned_times' };

  const shiftHour = parseInt(plannedStart.split(':')[0] ?? '0', 10);
  const isLunch = shiftHour < 16;

  // 2. Cerca timbratura di entrata con la stessa logica di Timesheets.tsx
  const punchIn = allPunches.find((p) => {
    if (p.type !== 'in') return false;
    if (shift.id && p.shift_id) return p.shift_id === shift.id;
    if (p.user_id !== shift.user_id) return false;
    const pDate = new Date(p.timestamp);
    if (!isValid(pDate)) return false;
    if (format(pDate, 'yyyy-MM-dd') !== shift.date) return false;
    return isLunch ? pDate.getHours() < 16 : pDate.getHours() >= 16;
  });

  if (!punchIn) return { ok: false, reason: 'missing_punch_in' };

  // 3. Criterio GPS: la timbratura deve provenire da 'kiosk' (geofence verificato in-app)
  if (punchIn.source !== 'kiosk') {
    return { ok: false, reason: `non_kiosk_source:${punchIn.source ?? 'null'}` };
  }

  // 4. Cerca timbratura di uscita (stessa logica di Timesheets.tsx, incluso night-rollover)
  let parsedShiftDate: Date;
  try {
    parsedShiftDate = parseISO(shift.date);
  } catch {
    return { ok: false, reason: 'invalid_shift_date' };
  }
  const nextDayStr = format(addDays(parsedShiftDate, 1), 'yyyy-MM-dd');

  const punchOut = allPunches.find((p) => {
    if (p.type !== 'out') return false;
    if (shift.id && p.shift_id) return p.shift_id === shift.id;
    if (p.user_id !== shift.user_id) return false;
    const pDate = new Date(p.timestamp);
    if (!isValid(pDate)) return false;
    const pDateStr = format(pDate, 'yyyy-MM-dd');
    if (pDateStr === shift.date) {
      return isLunch ? pDate.getHours() < 16 : pDate.getHours() >= 16;
    }
    // Night-rollover per turni serali: uscita il giorno dopo entro 24h
    if (!isLunch && pDateStr === nextDayStr) {
      const diff =
        pDate.getTime() -
        new Date(punchIn.calculated_time || punchIn.timestamp).getTime();
      return diff > 0 && diff <= 24 * 60 * 60 * 1000;
    }
    return false;
  });

  // clock_out_time sul record di entrata (campo aggregato) oppure record separato 'out'
  const clockOutTimestamp =
    (punchIn as { clock_out_time?: string | null }).clock_out_time ??
    punchOut?.timestamp ??
    null;

  if (!clockOutTimestamp) return { ok: false, reason: 'missing_punch_out' };

  // 5. Calcola orari effettivi (usa calculated_time se disponibile, più preciso)
  const actualStart = isoToHHMM(punchIn.calculated_time || punchIn.timestamp);
  const actualEnd = isoToHHMM(clockOutTimestamp);

  // 6. Controlla scarto rispetto al pianificato
  const startDelta = Math.abs(hmToMins(actualStart) - hmToMins(plannedStart));
  const endDelta = Math.abs(hmToMins(actualEnd) - hmToMins(plannedEnd));

  if (startDelta > thresholdMinutes) {
    return { ok: false, reason: `start_delta_${startDelta}m` };
  }
  if (endDelta > thresholdMinutes) {
    return { ok: false, reason: `end_delta_${endDelta}m` };
  }

  return { ok: true, approvedStart: actualStart, approvedEnd: actualEnd };
}

// ── Batch runner ───────────────────────────────────────────────────────────────

export interface AutoApproveOptions {
  /** Data target (YYYY-MM-DD). Default: ieri. */
  targetDate?: string;
  /** Soglia minuti per lo scarto orario. Default: 5. */
  thresholdMinutes?: number;
}

export interface AutoApproveRunResult {
  approved: number;
  skipped: number;
  errors: number;
}

/**
 * Scansiona i turni della data target e auto-approva quelli eleggibili.
 * Opera in background — non blocca la UI.
 * Restituisce il conteggio di turni approvati, saltati e falliti.
 */
export async function runAutoApprove(
  shifts: Shift[],
  punchRecords: PunchRecord[],
  updateShiftFn: (id: string, updates: Partial<Shift>) => Promise<void>,
  options: AutoApproveOptions = {},
): Promise<AutoApproveRunResult> {
  const {
    targetDate = format(addDays(new Date(), -1), 'yyyy-MM-dd'),
    thresholdMinutes = 5,
  } = options;

  const candidateShifts = shifts.filter(
    (s) =>
      s.date === targetDate &&
      (s.approval_status === 'draft' || s.approval_status === 'confirmed') &&
      !s.approved_at,
  );

  let approved = 0;
  let skipped = 0;
  let errors = 0;

  const now = new Date().toISOString();

  for (const shift of candidateShifts) {
    const result = shouldAutoApproveShift(shift, punchRecords, thresholdMinutes);

    if (!result.ok || !result.approvedStart || !result.approvedEnd) {
      skipped++;
      continue;
    }

    try {
      await updateShiftFn(shift.id, {
        approval_status: 'approved',
        approved_at: now,
        approved_by: AUTO_APPROVE_ACTOR,
        approved_start_time: result.approvedStart,
        approved_end_time: result.approvedEnd,
      });
      approved++;
    } catch {
      errors++;
    }
  }

  return { approved, skipped, errors };
}
