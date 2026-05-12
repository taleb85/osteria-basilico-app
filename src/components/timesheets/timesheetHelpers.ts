import type { CSSProperties } from 'react';
import {
  format,
  addDays,
  parseISO,
  isValid,
} from 'date-fns';
import {
  normalizeTimeInputToHHmm,
} from '../../utils/timeCalculations';
import {
  getNetShiftMinutes,
  type BreakMinutesComputeOptions,
  type BreakRule,
} from '../../utils/breakRules';
import { getTranslations } from '../../utils/translations';
import type { PunchRecord, PunchRecordSource, Shift, User } from '../../types';

// ── Style ───────────────────────────────────────────────────────────────────

/** Pill reparto: sfondo colore reparto, testo bianco (scurisce il rgb se troppo chiaro per il contrasto). */
export function departmentChipStyle(hex: string): CSSProperties {
  const raw = hex.replace('#', '').trim();
  const six = raw.length === 6 && /^[0-9a-fA-F]{6}$/.test(raw) ? raw : '6b6b6b';
  let r = parseInt(six.slice(0, 2), 16);
  let g = parseInt(six.slice(2, 4), 16);
  let b = parseInt(six.slice(4, 6), 16);
  const lin = (x: number) => {
    const c = x / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const relLum = () => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  for (let i = 0; i < 10 && relLum() > 0.48; i++) {
    r = Math.max(0, Math.floor(r * 0.82));
    g = Math.max(0, Math.floor(g * 0.82));
    b = Math.max(0, Math.floor(b * 0.82));
  }
  return {
    backgroundColor: `rgb(${r},${g},${b})`,
    borderColor: 'rgba(255,255,255,0.25)',
    color: '#ffffff',
  };
}

// ── Time ────────────────────────────────────────────────────────────────────

export function toMinutesFromMidnight(hhmm: string): number {
  const [h, m] = (hhmm || '00:00').slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Uscita sul calendario del giorno dopo il turno, entro 24h dall’ingresso: chiusura notturna (es. 18:00 → 00:00),
 * non errore "data errata".
 */
export function isTimesheetNightRolloverOk(
  shiftDateStr: string,
  actualEndISO: string,
  punchIn: { calculated_time?: string; timestamp: string } | undefined,
  isLunchSlot: boolean,
  punchActualStart: string | null
): boolean {
  if (!punchIn) return false;
  const outD = new Date(actualEndISO);
  if (!isValid(outD)) return false;
  const shiftD = parseISO(shiftDateStr);
  if (!isValid(shiftD)) return false;
  const actualEndDate = format(outD, 'yyyy-MM-dd');
  const nextShiftDay = format(addDays(shiftD, 1), 'yyyy-MM-dd');
  if (actualEndDate !== nextShiftDay) return false;
  const inMs = new Date(punchIn.calculated_time || punchIn.timestamp).getTime();
  const outMs = outD.getTime();
  const elapsed = outMs - inMs;
  if (elapsed <= 0 || elapsed > 24 * 60 * 60 * 1000) return false;
  if (isLunchSlot) {
    const eveningIn =
      !!punchActualStart && toMinutesFromMidnight(punchActualStart) >= 14 * 60;
    if (!eveningIn) return false;
  }
  return true;
}

/**
 * Se data uscita = giorno turno ma l’ora è prima dell’ingresso (es. IN 18:00, OUT 00:00), assume giorno successivo.
 */
export function resolveTimesheetPunchOutDateStr(
  shiftDateStr: string,
  manualOutDateStr: string | undefined,
  inHHMM: string,
  outHHMM: string
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDateStr)) return null;
  const trimmedManual = (manualOutDateStr || '').trim();
  const base =
    trimmedManual && /^\d{4}-\d{2}-\d{2}$/.test(trimmedManual) ? trimmedManual : shiftDateStr;
  const inSlice = (inHHMM || '').trim().slice(0, 5);
  const outSlice = (outHHMM || '').trim().slice(0, 5);
  const inNorm = normalizeTimeInputToHHmm(inSlice) || inSlice;
  const outNorm = normalizeTimeInputToHHmm(outSlice) || outSlice;
  if (!/^\d{1,2}:\d{2}$/.test(inNorm) || !/^\d{1,2}:\d{2}$/.test(outNorm)) return base;
  const pad2 = (hm: string) => {
    const [h, m] = hm.split(':').map((x) => parseInt(String(x), 10) || 0);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const inP = pad2(inNorm);
  const outP = pad2(outNorm);
  const inM = toMinutesFromMidnight(inP);
  const outM = toMinutesFromMidnight(outP);
  if (base === shiftDateStr && outM < inM) {
    return format(addDays(parseISO(shiftDateStr), 1), 'yyyy-MM-dd');
  }
  return base;
}

// ── Freeze / Review Payload ─────────────────────────────────────────────────

/** Dati per il popup congelo dopo salvataggio timbrature in coda revisione giornata/settimana. */
export function buildReviewQueueFreezeApprovalPayload(args: {
  shiftId: string;
  employeeName: string;
  shiftDateStr: string;
  plannedStart: string;
  plannedEnd: string;
  plannedMins: number;
  fullShift: Shift;
  user: User;
  breakRules: BreakRule[];
  breakComputeOpts: BreakMinutesComputeOptions;
  inHm: string;
  outHm: string;
  resolvedOutDate: string;
}): {
  shiftId: string;
  employeeName: string;
  dateStr: string;
  plannedStart: string;
  plannedEnd: string;
  plannedMins: number;
  actualStart: string | null;
  actualEnd: string | null;
  actualMins: number;
  deltaMins: number;
  freezeUsesPlannedTimes: boolean;
  afterFreeze: 'advance_review';
} {
  const inNorm = normalizeTimeInputToHHmm(args.inHm.trim()) || args.inHm.trim().slice(0, 5);
  const outNorm = normalizeTimeInputToHHmm(args.outHm.trim()) || args.outHm.trim().slice(0, 5);
  const pad2 = (hm: string) => {
    const [h, m] = hm.split(':').map((x) => parseInt(String(x), 10) || 0);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  const inP = pad2(inNorm);
  const outP = pad2(outNorm);
  const actualMins = getNetShiftMinutes(
    args.fullShift,
    inP,
    outP,
    args.user,
    args.breakRules,
    args.breakComputeOpts
  );
  const deltaMins = actualMins - args.plannedMins;
  return {
    shiftId: args.shiftId,
    employeeName: args.employeeName,
    dateStr: args.shiftDateStr,
    plannedStart: args.plannedStart,
    plannedEnd: args.plannedEnd,
    plannedMins: args.plannedMins,
    actualStart: inP,
    actualEnd: outP,
    actualMins,
    deltaMins,
    freezeUsesPlannedTimes: false,
    afterFreeze: 'advance_review',
  };
}

// ── Formatting ──────────────────────────────────────────────────────────────

export function fmtHM(mins: number): string {
  if (mins === 0) return '0h';
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  const sign = mins < 0 ? '−' : '';
  return m > 0 ? `${sign}${h}h${m.toString().padStart(2, '0')}` : `${sign}${h}h`;
}

/** Durata pausa detratta in forma leggibile (es. 30 → "30m", 90 → "1h30m"). */
export function fmtBreakDeductionShort(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

/** Formatta un valore audit: se è un ISO timestamp lo converte in dd/MM HH:mm, altrimenti lo restituisce as-is */
export function fmtAuditValue(v: string | null | undefined): string {
  if (!v) return '—';
  // Plain ISO timestamp
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    try {
      const d = new Date(v);
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { return v; }
  }
  // "approved @ ISO" pattern
  const approvedMatch = v.match(/^approved\s*@\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[^\s]*)/i);
  if (approvedMatch && approvedMatch[1]) {
    try {
      const d = new Date(approvedMatch[1]);
      return `Approvato ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    } catch { /* fall through */ }
  }
  // Status label translations
  const statusMap: Record<string, string> = {
    confirmed: 'Confermato', approved: 'Approvato', draft: 'Bozza',
    absent: 'Assente', frozen: 'Congelato', published: 'Pubblicato',
  };
  if (statusMap[v.toLowerCase()]) return statusMap[v.toLowerCase()];
  // Boolean
  if (v === 'true') return 'Sì';
  if (v === 'false') return 'No';
  return v;
}

export const FIELD_LABEL_MAP: Record<string, string> = {
  STATUS: 'Stato', STATO: 'Stato', APPROVAL_STATUS: 'Stato',
  CALCULATED_TIME: 'Ore calcolate', START_TIME: 'Inizio', END_TIME: 'Fine',
  DEDUCT_BREAK: 'Detrae pausa', APPROVED_AT: 'Data approvazione',
  APPROVED_BY: 'Approvato da', APPROVAZIONE_TURNO: 'Approvazione',
  PUNCH_IN: 'Entrata', PUNCH_OUT: 'Uscita', PUNCH_IN_TIME: 'Ora entrata',
  PUNCH_OUT_TIME: 'Ora uscita', NOTE: 'Note', DEPARTMENT: 'Reparto',
  ROLE: 'Ruolo', BREAK_MINUTES: 'Pausa (min)',
};

export function humanizeFieldName(field: string | undefined): string {
  if (field == null || field === '') return '—';
  const up = field.toUpperCase();
  return FIELD_LABEL_MAP[up] ?? field.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

export function punchTimeHHMM(ts: string | null | undefined): string | null {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return null; }
}

export function punchSourceLabel(
  source: PunchRecordSource | null | undefined,
  t: ReturnType<typeof getTranslations>
): string {
  if (source === 'manual') return t.ts_punch_source_manual;
  if (source === 'manager') return t.ts_punch_source_manager;
  if (source === 'kiosk') return t.ts_punch_source_kiosk;
  return t.ts_punch_source_legacy;
}

// ── Punch finding ───────────────────────────────────────────────────────────

/** Stesso criterio della griglia presenze (`timesheetData`) per l’IN. */
export function findPunchInForShiftOnDate(
  shift: Shift,
  userId: string,
  dateStr: string,
  punchRecords: PunchRecord[]
): PunchRecord | undefined {
  const plannedStart = (shift.start_time || '').slice(0, 5);
  const shiftHour = parseInt(plannedStart.split(':')[0], 10);
  const isLunch = shiftHour < 16;
  return punchRecords.find((p) => {
    if (p.type !== 'in') return false;
    if (shift.id && p.shift_id) return p.shift_id === shift.id;
    if (p.user_id !== userId) return false;
    const pDate = new Date(p.timestamp);
    if (!isValid(pDate)) return false;
    if (format(pDate, 'yyyy-MM-dd') !== dateStr) return false;
    return isLunch ? pDate.getHours() < 16 : pDate.getHours() >= 16;
  });
}

// ── Week storage ────────────────────────────────────────────────────────────

/** Indice settimana nel periodo Presenze: sopravvive a uscite dalla pagina (stesso browser). */
export function timesheetWeekStorageKey(startDate: string, numWeeks: 4 | 5): string {
  return `osteria_ts_weekIdx_${startDate}_${numWeeks}`;
}

export function readStoredWeekIndex(startDate: string, numWeeks: 4 | 5): number {
  try {
    const raw = sessionStorage.getItem(timesheetWeekStorageKey(startDate, numWeeks));
    if (raw == null) return 0;
    const n = parseInt(raw, 10);
    const max = numWeeks - 1;
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(n, max);
  } catch {
    return 0;
  }
}
