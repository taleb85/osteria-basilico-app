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

/** Categorie predefinite: regole pausa e filtri che selezionano una di queste si applicano anche ai reparti personalizzati collegati. */
export type PermissionCategory = 'sala' | 'kitchen' | 'bar';

export interface Department {
  value: string;
  label: string;
  color?: string;
  /** Solo reparti personalizzati: unifica con Sala / Cucina / Bar per regole pausa (e stessa logica dove usato). */
  permissionCategory?: PermissionCategory;
}

// Reparti built-in: stessi colori “pieni” della palette (bar = verde brand)
export const BUILTIN_DEPARTMENTS: Department[] = [
  { value: 'sala',    label: 'Sala',   color: '#2196F3' },
  { value: 'kitchen', label: 'Cucina', color: '#F44336' },
  { value: 'bar',     label: 'Bar',    color: '#2D5A27' },
];

const DEFAULT_CUSTOM_COLOR = '#2D5A27'; // accent green

function mergeBuiltinsWithOverrides(): Department[] {
  const ov = getBuiltinOverrides();
  return BUILTIN_DEPARTMENTS.map((d) => ({
    ...d,
    ...(ov[d.value] || {}),
  }));
}

/** Snapshot per Storage `app-config/departments.json` — allinea colori/etichette/reparti custom su tutti i dispositivi. */
export type DepartmentsCloudV1 = {
  schemaVersion: 1;
  builtinOverrides: Record<string, BuiltinOverride>;
  custom: Array<{
    value: string;
    label: string;
    color: string;
    permissionCategory?: PermissionCategory;
  }>;
};

export function parseDepartmentsCloudPayload(raw: unknown): DepartmentsCloudV1 | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 1) return null;
  const builtinRaw = o.builtinOverrides;
  const builtinOverrides: Record<string, BuiltinOverride> =
    builtinRaw && typeof builtinRaw === 'object' && !Array.isArray(builtinRaw)
      ? (builtinRaw as Record<string, BuiltinOverride>)
      : {};
  const customIn = o.custom;
  const custom: DepartmentsCloudV1['custom'] = [];
  if (Array.isArray(customIn)) {
    const builtinValues = new Set(BUILTIN_DEPARTMENTS.map((d) => d.value));
    for (const row of customIn) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const r = row as Record<string, unknown>;
      const value = typeof r.value === 'string' ? r.value.trim() : '';
      if (!value || builtinValues.has(value)) continue;
      const label = typeof r.label === 'string' ? r.label.trim() : '';
      const color =
        typeof r.color === 'string' && r.color.trim() ? r.color.trim() : DEFAULT_CUSTOM_COLOR;
      const pc = r.permissionCategory;
      const permissionCategory =
        pc === 'sala' || pc === 'kitchen' || pc === 'bar' ? pc : undefined;
      custom.push(
        permissionCategory
          ? { value, label: label || value, color, permissionCategory }
          : { value, label: label || value, color }
      );
    }
  }
  return { schemaVersion: 1, builtinOverrides, custom };
}

export function getDepartmentsCloudSnapshot(): DepartmentsCloudV1 {
  const builtinOverrides = { ...getBuiltinOverrides() };
  let custom: Department[] = [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) custom = parsed as Department[];
    }
  } catch {
    custom = [];
  }
  const builtinValues = new Set(BUILTIN_DEPARTMENTS.map((d) => d.value));
  const outCustom: DepartmentsCloudV1['custom'] = [];
  for (const d of custom) {
    if (!d || typeof d !== 'object' || builtinValues.has(d.value)) continue;
    const label = typeof d.label === 'string' ? d.label.trim() : '';
    const color = typeof d.color === 'string' && d.color.trim() ? d.color.trim() : DEFAULT_CUSTOM_COLOR;
    const row: DepartmentsCloudV1['custom'][number] = {
      value: d.value,
      label: label || d.value,
      color,
    };
    if (d.permissionCategory === 'sala' || d.permissionCategory === 'kitchen' || d.permissionCategory === 'bar') {
      row.permissionCategory = d.permissionCategory;
    }
    outCustom.push(row);
  }
  return { schemaVersion: 1, builtinOverrides, custom: outCustom };
}

/** Applica quanto scaricato da Storage: sovrascrive le chiavi locali dei reparti. */
export function applyDepartmentsCloudSnapshot(data: DepartmentsCloudV1 | null): boolean {
  if (!data || data.schemaVersion !== 1) return false;
  const builtinValues = new Set(BUILTIN_DEPARTMENTS.map((d) => d.value));
  const sanitized = (Array.isArray(data.custom) ? data.custom : []).filter(
    (d) => d && typeof d.value === 'string' && d.value.trim() && !builtinValues.has(d.value)
  );
  try {
    const ov =
      data.builtinOverrides && typeof data.builtinOverrides === 'object' && !Array.isArray(data.builtinOverrides)
        ? (data.builtinOverrides as Record<string, BuiltinOverride>)
        : {};
    saveBuiltinOverrides(ov);
    localStorage.setItem(KEY, JSON.stringify(sanitized));
  } catch {
    return false;
  }
  return true;
}

/**
 * Colori pieni Material 500 (± brand): ogni swatch è una tinta netta, senza scale chiaro/scuro.
 * Ordine approssimativo spettro + marroni + grigio.
 */
export const DEPARTMENT_COLOR_PRESETS: readonly string[] = [
  '#F44336', // rosso
  '#E91E63', // rosa / magenta
  '#FF5722', // arancione scuro
  '#FF9800', // arancione
  '#FFC107', // ambra
  '#FFEB3B', // giallo
  '#CDDC39', // lime
  '#8BC34A', // verde chiaro
  '#4CAF50', // verde
  '#2D5A27', // verde basilico (brand)
  '#009688', // teal
  '#00BCD4', // ciano
  '#03A9F4', // azzurro
  '#2196F3', // blu
  '#3F51B5', // indaco
  '#673AB7', // viola profondo
  '#9C27B0', // viola
  '#795548', // marrone
  '#6D4C41', // marrone scuro
  '#9E9E9E', // grigio (neutro definito)
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
