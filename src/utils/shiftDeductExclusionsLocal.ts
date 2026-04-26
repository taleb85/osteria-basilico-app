/**
 * Fallback quando `deduct_excluded_rule_ids` non è ancora sul DB o l'UPDATE fallisce.
 * Chiave per turno: esclusioni come array di id (regole admin o __flow_meal_*).
 */
const STORAGE_KEY = 'flow_shift_deduct_exclusions_v1';

function readMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return {};
    return p as Record<string, string[]>;
  } catch {
    return {};
  }
}

function writeMap(m: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function getLocalDeductExcludedRuleIds(shiftId: string): string[] | undefined {
  const m = readMap();
  const v = m[shiftId];
  return Array.isArray(v) ? v : undefined;
}

export function setLocalDeductExcludedRuleIds(shiftId: string, ids: string[]): void {
  const m = readMap();
  if (ids.length === 0) delete m[shiftId];
  else m[shiftId] = [...ids];
  writeMap(m);
}

export function clearLocalDeductExcludedRuleIds(shiftId: string): void {
  const m = readMap();
  if (shiftId in m) {
    delete m[shiftId];
    writeMap(m);
  }
}

/** Unisce nel turno le esclusioni salvate in locale se il server non restituisce l’array. */
export function mergeShiftDeductExclusionsFromLocal<T extends { id: string; deduct_excluded_rule_ids?: string[] }>(
  shift: T
): T {
  const server = shift.deduct_excluded_rule_ids;
  const serverNonEmpty = Array.isArray(server) && server.length > 0;
  if (serverNonEmpty) {
    return shift;
  }
  const local = getLocalDeductExcludedRuleIds(shift.id);
  if (local && local.length > 0) {
    return { ...shift, deduct_excluded_rule_ids: [...local] };
  }
  if (Array.isArray(shift.deduct_excluded_rule_ids)) {
    return shift;
  }
  return shift;
}

export function mergeShiftsDeductExclusionsFromLocal<T extends { id: string; deduct_excluded_rule_ids?: string[] }>(
  shifts: T[]
): T[] {
  return shifts.map(mergeShiftDeductExclusionsFromLocal);
}
