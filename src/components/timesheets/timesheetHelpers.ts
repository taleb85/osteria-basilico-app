import { getTranslations } from '../../utils/translations';
import type { PunchRecordSource } from '../../types';

// ── Time ────────────────────────────────────────────────────────────────────

export function toMinutesFromMidnight(hhmm: string): number {
  const [h, m] = (hhmm || '00:00').slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
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
    confirmed: 'Pubblicato', approved: 'Approvato', draft: 'Bozza',
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

export function punchSourceLabel(
  source: PunchRecordSource | null | undefined,
  t: ReturnType<typeof getTranslations>
): string {
  if (source === 'manual') return t.ts_punch_source_manual;
  if (source === 'manager') return t.ts_punch_source_manager;
  if (source === 'kiosk') return t.ts_punch_source_kiosk;
  return t.ts_punch_source_legacy;
}

// ── Week storage ────────────────────────────────────────────────────────────

/** Indice settimana nel periodo Presenze: sopravvive a uscite dalla pagina (stesso browser). */
export function timesheetWeekStorageKey(startDate: string, numWeeks: 4 | 5): string {
  return `osteria_ts_weekIdx_${startDate}_${numWeeks}`;
}
