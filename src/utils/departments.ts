const KEY = 'osteria_departments';
/** Etichetta/colore personalizzati per sala | kitchen | bar (il `value` resta invariato). */
const BUILTIN_OVERRIDES_KEY = 'osteria_department_builtin_overrides';

type BuiltinOverride = { label?: string; color?: string };

function getBuiltinOverrides(): Record<string, BuiltinOverride> {
  try {
    const raw = localStorage.getItem(BUILTIN_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, BuiltinOverride>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveBuiltinOverrides(overrides: Record<string, BuiltinOverride>) {
  try {
    localStorage.setItem(BUILTIN_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore */
  }
}

function mergeBuiltinsWithOverrides(): Department[] {
  const ov = getBuiltinOverrides();
  return BUILTIN_DEPARTMENTS.map((d) => ({
    ...d,
    ...(ov[d.value] || {}),
  }));
}

/** Categorie predefinite: regole pausa e filtri che selezionano una di queste si applicano anche ai reparti personalizzati collegati. */
export type PermissionCategory = 'sala' | 'kitchen' | 'bar';

export interface Department {
  value: string;
  label: string;
  color?: string;
  /** Solo reparti personalizzati: unifica con Sala / Cucina / Bar per regole pausa (e stessa logica dove usato). */
  permissionCategory?: PermissionCategory;
}

// Default colors for built-in departments
export const BUILTIN_DEPARTMENTS: Department[] = [
  { value: 'sala',    label: 'Sala',   color: '#3b82f6' }, // blue-500
  { value: 'kitchen', label: 'Cucina', color: '#f97316' }, // orange-500
  { value: 'bar',     label: 'Bar',    color: '#2D5A27' },
];

const DEFAULT_CUSTOM_COLOR = '#2D5A27'; // accent green

/** Palette fissa per nuovi reparti (UI selettore colore). */
export const DEPARTMENT_COLOR_PRESETS: readonly string[] = [
  '#2D5A27',
  '#3b82f6',
  '#f97316',
  '#0d9488',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#ef4444',
  '#f59e0b',
  '#84cc16',
  '#14b8a6',
  '#0891b2',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#db2777',
  '#b45309',
  '#475569',
  '#1e293b',
  '#15803d',
];

export function getDepartments(): Department[] {
  try {
    const raw = localStorage.getItem(KEY);
    const builtin = mergeBuiltinsWithOverrides();
    if (!raw) return builtin;
    const custom = JSON.parse(raw) as Department[];
    const builtinValues = new Set(BUILTIN_DEPARTMENTS.map((d) => d.value));
    const extras = custom.filter((d) => !builtinValues.has(d.value));
    return [...builtin, ...extras];
  } catch {
    return mergeBuiltinsWithOverrides();
  }
}

/** Returns the hex color for a department value. */
export function getDeptColor(value: string): string {
  const dept = getDepartments().find((d) => d.value === value);
  return dept?.color ?? DEFAULT_CUSTOM_COLOR;
}

export function addDepartment(
  label: string,
  color?: string,
  permissionCategory?: PermissionCategory
): Department[] {
  const value = label.trim().toLowerCase().replace(/\s+/g, '_');
  const current = getDepartments();
  if (current.some((d) => d.value === value)) return current;
  const row: Department = {
    value,
    label: label.trim(),
    color: color ?? DEFAULT_CUSTOM_COLOR,
    ...(permissionCategory ? { permissionCategory } : {}),
  };
  const all = [...current, row];
  saveCustomDepartments(all);
  return all;
}

export function removeDepartment(value: string): Department[] {
  const builtinValues = new Set(BUILTIN_DEPARTMENTS.map((d) => d.value));
  if (builtinValues.has(value)) return getDepartments();
  const all = getDepartments().filter((d) => d.value !== value);
  saveCustomDepartments(all);
  return all;
}

/** Chiavi con cui confrontare il reparto utente vs `rule.departments` (valore proprio + categoria se impostata). */
export function getDeptPermissionMatchKeys(deptValue: string | null | undefined): string[] {
  if (!deptValue) return [];
  const list = getDepartments();
  const d = list.find((x) => x.value === deptValue);
  if (!d) return [deptValue];
  const builtinValues = new Set(BUILTIN_DEPARTMENTS.map((b) => b.value));
  if (builtinValues.has(d.value)) return [d.value];
  if (d.permissionCategory) return [d.value, d.permissionCategory];
  return [d.value];
}

/** Reparto utente soddisfa il filtro reparti della regola pausa? */
export function departmentMatchesBreakRuleDepartments(
  userDept: string | null | undefined,
  ruleDepts: string[]
): boolean {
  if (!ruleDepts.length) return true;
  const keys = getDeptPermissionMatchKeys(userDept);
  return keys.some((k) => ruleDepts.includes(k));
}

/**
 * Aggiorna reparto (`value` invariato).
 * Built-in: salva solo etichetta/colore in override locale (codice sala/kitchen/bar fisso).
 * Custom: `permissionCategory` opzionale; assente = non modificare la categoria.
 */
export function updateDepartment(
  value: string,
  updates: { label: string; color: string; permissionCategory?: PermissionCategory | '' }
): Department[] {
  const builtinValues = new Set(BUILTIN_DEPARTMENTS.map((d) => d.value));
  const label = updates.label.trim();
  if (!label) return getDepartments();
  const color = updates.color.trim() || DEFAULT_CUSTOM_COLOR;

  if (builtinValues.has(value)) {
    const overrides = { ...getBuiltinOverrides(), [value]: { label, color } };
    saveBuiltinOverrides(overrides);
    return getDepartments();
  }

  const current = getDepartments();
  if (!current.some((d) => d.value === value)) return current;
  const next = current.map((d) => {
    if (d.value !== value) return d;
    const nextRow: Department = { ...d, label, color };
    if ('permissionCategory' in updates) {
      if (updates.permissionCategory) {
        nextRow.permissionCategory = updates.permissionCategory;
      } else {
        delete nextRow.permissionCategory;
      }
    }
    return nextRow;
  });
  saveCustomDepartments(next);
  return next;
}

function saveCustomDepartments(all: Department[]) {
  try {
    const builtinValues = new Set(BUILTIN_DEPARTMENTS.map((d) => d.value));
    const custom = all.filter((d) => !builtinValues.has(d.value));
    localStorage.setItem(KEY, JSON.stringify(custom));
  } catch { /* ignore */ }
}
