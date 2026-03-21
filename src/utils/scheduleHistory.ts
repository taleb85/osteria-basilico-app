const HISTORY_KEY = 'osteria_schedule_history';
const MAX_ENTRIES = 500;

export type HistoryAction = 'create' | 'update' | 'delete' | 'publish' | 'bulk_delete' | 'bulk_approve' | 'shift_edit';

export interface HistoryEntry {
  id: string;
  timestamp: string;       // ISO string
  action: HistoryAction;
  actorName: string;       // nome del manager che ha fatto l'azione
  description: string;     // testo leggibile
  shiftId?: string;        // id del turno modificato (per shift_edit)
  field?: string;          // campo modificato
  oldValue?: string;       // valore precedente
  newValue?: string;       // nuovo valore
}

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch { /* ignore quota */ }
}

export function logHistory(action: HistoryAction, actorName: string, description: string) {
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    action,
    actorName,
    description,
  };
  const existing = load();
  save([entry, ...existing]);
}

export function logShiftEdit(opts: {
  shiftId: string;
  actorName: string;
  field: string;
  oldValue: string;
  newValue: string;
  description: string;
}) {
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    action: 'shift_edit',
    actorName: opts.actorName,
    description: opts.description,
    shiftId: opts.shiftId,
    field: opts.field,
    oldValue: opts.oldValue,
    newValue: opts.newValue,
  };
  const existing = load();
  save([entry, ...existing]);
}

export function getShiftHistory(shiftId: string): HistoryEntry[] {
  return load().filter((e) => e.shiftId === shiftId);
}

export function getHistory(): HistoryEntry[] {
  return load();
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}
