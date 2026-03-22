/**
 * Matrice permessi e schede dashboard: **per ruolo**, con override opzionali da template salvati dall’Admin
 * (Storage `app-config/role_feature_templates.json` + localStorage).
 * I moduli della scheda Admin (Impostazioni) sono **globali** (`admin_sheet_modules.json`), modificabili solo dall’Admin.
 */
import type { RoleFeatureTemplatesOnDisk, RoleTemplateGroup } from './roleFeatureTemplates';
import { getRoleFeatureTemplatesCache } from './roleFeatureTemplates';
import { getAdminModulesGlobalCache } from './adminModulesGlobal';
import { SETTINGS_OPERATIONAL_PERM_KEYS, type SettingsOperationalPermKey } from './settingsPermissionRows';

export type { SettingsOperationalPermKey };

export type { RoleTemplateGroup };
export const PERMISSION_MATRIX_KEYS = [
  'team_view',
  'edit_shifts',
  'approve_shifts',
  'export_pdf',
  'view_stats',
  /** KPI “Costo stimato” (€/h × ore approvate) in Statistiche — utile soprattutto a chi cura contabilità / costi. */
  'view_estimated_cost',
  'desktop_access',
] as const;

export type PermissionMatrixKey = (typeof PERMISSION_MATRIX_KEYS)[number];

/** Schede aggiuntive in dashboard (oltre alla matrice da 6). */
export const DASHBOARD_TAB_FEATURE_KEYS = ['home_tab', 'ferie_tab', 'admin_tab'] as const;
export type DashboardTabFeatureKey = (typeof DASHBOARD_TAB_FEATURE_KEYS)[number];

export const ENABLED_FEATURE_KEYS = [
  ...PERMISSION_MATRIX_KEYS,
  ...DASHBOARD_TAB_FEATURE_KEYS,
] as const;

export type EnabledFeatureKey = (typeof ENABLED_FEATURE_KEYS)[number];

export type EnabledFeatures = Partial<Record<EnabledFeatureKey, boolean>>;

/** Chiave nel template per "visibile in tabellone turni". true = visibile, false = nascosto. Default true. */
export const TEMPLATE_TEAM_SCHEDULE_KEY = 'team_schedule_visible' as const;

export const FEATURE_LABELS: Record<EnabledFeatureKey, string> = {
  team_view: 'Visualizza Tabellone Team',
  edit_shifts: 'Modifica Operativa Turni',
  approve_shifts: 'Approvazione Finale (Verde)',
  export_pdf: 'Esportazione Report PDF',
  view_stats: 'Visualizzazione Statistiche',
  view_estimated_cost: 'Costo stimato del lavoro (Statistiche)',
  desktop_access: 'Accesso Browser Desktop (deprecato — il gate PWA è unificato)',
  home_tab: 'Visualizza scheda Dashboard',
  ferie_tab: 'Visualizza scheda Ferie',
  admin_tab: 'Visualizza scheda Admin (Impostazioni)',
};

/** Etichette orientate alle tab (stessi permessi; testo più chiaro nella sezione “Schede”). */
export const FEATURE_LABELS_TAB_FIRST: Record<EnabledFeatureKey, string> = {
  ...FEATURE_LABELS,
  home_tab: 'Scheda Dashboard — riepilogo',
  team_view: 'Scheda Turni — tabellone team',
  export_pdf: 'Scheda Presenze — foglio e PDF',
  view_stats: 'Scheda Statistiche',
  ferie_tab: 'Scheda Ferie',
  admin_tab: 'Scheda Admin — impostazioni e profili',
};

export type RoleTemplateRow = { kind: 'feature'; key: EnabledFeatureKey };

export type RoleTemplateSectionId = 'tabs_nav' | 'shift_ops' | 'other';

export type RoleTemplateSection = {
  readonly id: RoleTemplateSectionId;
  readonly rows: readonly RoleTemplateRow[];
};

/**
 * Ordine e raggruppamento permessi in UI (template ruoli, gestione profili, anteprima).
 * Ogni chiave in ENABLED_FEATURE_KEYS compare una sola volta.
 */
export const ROLE_TEMPLATE_FEATURE_SECTIONS: readonly RoleTemplateSection[] = [
  {
    id: 'tabs_nav',
    rows: [
      { kind: 'feature', key: 'home_tab' },
      { kind: 'feature', key: 'team_view' },
      { kind: 'feature', key: 'ferie_tab' },
      { kind: 'feature', key: 'export_pdf' },
      { kind: 'feature', key: 'view_stats' },
    ],
  },
  {
    id: 'shift_ops',
    rows: [
      { kind: 'feature', key: 'edit_shifts' },
      { kind: 'feature', key: 'approve_shifts' },
    ],
  },
  {
    id: 'other',
    rows: [{ kind: 'feature', key: 'view_estimated_cost' }],
  },
] as const;

export function roleTemplateSectionTitleKey(id: RoleTemplateSectionId): string {
  switch (id) {
    case 'tabs_nav':
      return 'role_template_section_tabs_nav';
    case 'shift_ops':
      return 'role_template_section_shift_ops';
    default:
      return 'role_template_section_other';
  }
}

/** Funzioni della scheda Impostazioni: config globale (solo Admin modifica), stessi valori per tutti i profili gestionali. */
export const ADMIN_MODULE_KEYS = [
  'visibility_management',
  'department_creation',
  'violation_rules',
  'master_control_panel',
  'auto_breaks',
] as const;

export type AdminModuleKey = (typeof ADMIN_MODULE_KEYS)[number];

/** Default per admin: tutte attive (cablate) */
const DEFAULT_ADMIN_FEATURES: EnabledFeatures = Object.fromEntries(
  ENABLED_FEATURE_KEYS.map((k) => [k, true])
) as EnabledFeatures;

/** Default codice: Manager e Assistant Manager (template gruppo `management`). */
const DEFAULT_MANAGER_FEATURES: EnabledFeatures = {
  home_tab: true,
  team_view: true,
  edit_shifts: true,
  approve_shifts: true,
  export_pdf: true,
  view_stats: true,
  view_estimated_cost: true,
  desktop_access: true,
  ferie_tab: true,
  /** Solo il ruolo `admin` vede la scheda Impostazioni / profili in barra (ignora template e JSONB). */
  admin_tab: false,
};

/** Default staff: come management (stesso `admin_tab` false). */
const DEFAULT_STAFF_FEATURES: EnabledFeatures = {
  ...DEFAULT_MANAGER_FEATURES,
};

export function getDefaultEnabledFeatures(role: string): EnabledFeatures {
  if (role === 'admin') return { ...DEFAULT_ADMIN_FEATURES };
  if (role === 'manager' || role === 'assistant_manager') return { ...DEFAULT_MANAGER_FEATURES };
  return { ...DEFAULT_STAFF_FEATURES };
}

/** Gruppo per file template: admin non ha file (sempre pieno). */
export function getRolePermissionGroup(role: string): 'admin' | RoleTemplateGroup {
  if (role === 'admin') return 'admin';
  if (role === 'manager' || role === 'assistant_manager') return 'management';
  return 'staff';
}

function applyDiskTemplateToBase(base: EnabledFeatures, group: RoleTemplateGroup): EnabledFeatures {
  const partial = getRoleFeatureTemplatesCache()?.[group];
  if (!partial) return base;
  const out = { ...base };
  for (const k of ENABLED_FEATURE_KEYS) {
    if (typeof partial[k] === 'boolean') out[k] = partial[k];
  }
  return out;
}

/** Default “codice” per un gruppo template (editor Admin / reset). */
export function getCodeDefaultsForTemplateGroup(group: RoleTemplateGroup): EnabledFeatures {
  if (group === 'management') return { ...getDefaultEnabledFeatures('manager') } as EnabledFeatures;
  return { ...getDefaultEnabledFeatures('waiter') } as EnabledFeatures;
}

/** Stato effettivo per l’editor (default codice + file salvato). */
export function buildMergedTemplateForAdminEditor(
  group: RoleTemplateGroup,
  disk: RoleFeatureTemplatesOnDisk | null
): EnabledFeatures {
  const base = getCodeDefaultsForTemplateGroup(group);
  const partial = disk?.[group];
  if (!partial) return base;
  const out = { ...base };
  for (const k of ENABLED_FEATURE_KEYS) {
    if (typeof partial[k] === 'boolean') out[k] = partial[k];
  }
  return out;
}

/** Default template "visibile in tabellone" per gruppo. true = visibile. */
export function getTemplateGroupTeamScheduleVisible(
  group: RoleTemplateGroup,
  disk: RoleFeatureTemplatesOnDisk | null
): boolean {
  const partial = disk?.[group];
  if (partial && typeof partial[TEMPLATE_TEAM_SCHEDULE_KEY] === 'boolean') {
    return partial[TEMPLATE_TEAM_SCHEDULE_KEY];
  }
  return true;
}

/** Default "visibile in tabellone" per ruolo (usa template). */
export function getTemplateDefaultTeamScheduleVisible(role: string): boolean {
  const disk = getRoleFeatureTemplatesCache();
  const grp = getRolePermissionGroup(role);
  if (grp === 'admin') return true;
  return getTemplateGroupTeamScheduleVisible(grp, disk);
}

/** Permessi operativi (DB) nel template: default tutti attivi, merge da file. */
export function buildMergedOperationalTemplateForGroup(
  group: RoleTemplateGroup,
  disk: RoleFeatureTemplatesOnDisk | null
): Record<SettingsOperationalPermKey, boolean> {
  const base = Object.fromEntries(SETTINGS_OPERATIONAL_PERM_KEYS.map((k) => [k, true])) as Record<
    SettingsOperationalPermKey,
    boolean
  >;
  const partial = disk?.[group];
  if (!partial) return base;
  const out = { ...base };
  for (const k of SETTINGS_OPERATIONAL_PERM_KEYS) {
    if (typeof partial[k] === 'boolean') out[k] = partial[k];
  }
  return out;
}

/** Serializza features + team_schedule_visible + permessi operativi per il JSON su Storage. */
export function serializeTemplateGroupForDisk(
  state: EnabledFeatures,
  teamScheduleVisible = true,
  operational?: Record<SettingsOperationalPermKey, boolean>
): Record<string, boolean> {
  const out: Record<string, boolean> = Object.fromEntries(
    ENABLED_FEATURE_KEYS.map((k) => [k, state[k] === true])
  ) as Record<string, boolean>;
  out[TEMPLATE_TEAM_SCHEDULE_KEY] = teamScheduleVisible;
  if (operational) {
    for (const k of SETTINGS_OPERATIONAL_PERM_KEYS) {
      out[k] = operational[k] === true;
    }
  }
  return out;
}

/**
 * Matrice + schede: default ruolo + template globale (se presente). L’admin resta sempre pieno.
 *
 * Per `role === 'admin'` **non** si applicano override da `users.enabled_features`: la barra tab,
 * `getVisibleManagementTabs` e ogni UI che usa `getEnabledFeatures` devono coincidere con
 * `isFeatureEnabled` (sempre true per l’admin). I dati JSONB restano in DB ma non limitano la sessione admin.
 */
export function getEnabledFeatures(user: { role: string; enabled_features?: unknown }): EnabledFeatures {
  const base = getDefaultEnabledFeatures(user.role);
  if (user.role === 'admin') {
    const result = { ...base };
    for (const k of PERMISSION_MATRIX_KEYS) result[k] = true;
    result.home_tab = true;
    result.admin_tab = true;
    result.ferie_tab = true;
    return result;
  }
  const grp = getRolePermissionGroup(user.role);
  if (grp === 'admin') return base;
  const merged = mergeUserFeatureOverrides(applyDiskTemplateToBase(base, grp), user.enabled_features);
  merged.admin_tab = false;
  return merged;
}

/** Override per-utente da colonna `users.enabled_features` (JSONB), se presente. */
function mergeUserFeatureOverrides(
  merged: EnabledFeatures,
  raw: unknown
): EnabledFeatures {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return merged;
  const o = raw as Record<string, unknown>;
  const out = { ...merged };
  for (const k of ENABLED_FEATURE_KEYS) {
    if (typeof o[k] === 'boolean') out[k] = o[k];
  }
  return out;
}

/** Scheda Admin / Impostazioni nella dashboard: solo ruolo `admin`. */
export function isAdminSettingsTabEnabled(user: { role: string; enabled_features?: unknown }): boolean {
  return user.role === 'admin';
}

/** Default per Manager/Assistant Manager: tutte le funzioni Impostazioni attive. */
const DEFAULT_ADMIN_MODULES: Partial<Record<AdminModuleKey, boolean>> = Object.fromEntries(
  ADMIN_MODULE_KEYS.map((k) => [k, true])
) as Partial<Record<AdminModuleKey, boolean>>;

/** Stato iniziale editor Admin (moduli globali + file salvato). */
export function buildMergedAdminModulesForAdminEditor(): Record<AdminModuleKey, boolean> {
  const result = { ...DEFAULT_ADMIN_MODULES } as Record<AdminModuleKey, boolean>;
  const g = getAdminModulesGlobalCache();
  if (g) {
    for (const k of ADMIN_MODULE_KEYS) {
      if (typeof g[k] === 'boolean') result[k] = g[k];
    }
  }
  return result;
}

/**
 * Moduli scheda Impostazioni: **solo config globale** (sincronizzata per tutti).
 * Proprietario / Manager / Assistant: stessi flag; Admin: sempre tutti attivi; Staff: nessuno.
 */
export function getAdminModuleEnabled(user: { role: string; enabled_features?: unknown }): Partial<Record<AdminModuleKey, boolean>> {
  // Admin: in UI mostra gli stessi flag globali dei manager (lettura coerente con Storage); l’accesso resta sempre sbloccato in isAdminModuleEnabled.
  if (user.role === 'admin') {
    const global = getAdminModulesGlobalCache();
    const base = { ...DEFAULT_ADMIN_MODULES } as Record<AdminModuleKey, boolean>;
    if (global && Object.keys(global).length > 0) {
      for (const k of ADMIN_MODULE_KEYS) {
        if (typeof global[k] === 'boolean') base[k] = global[k];
      }
    }
    return base;
  }
  const defaultForRole =
    user.role === 'manager' || user.role === 'assistant_manager' ? { ...DEFAULT_ADMIN_MODULES } : {};
  const global = getAdminModulesGlobalCache();
  if (!global || Object.keys(global).length === 0) {
    return defaultForRole;
  }
  const result = { ...defaultForRole };
  for (const k of ADMIN_MODULE_KEYS) {
    if (typeof global[k] === 'boolean') result[k] = global[k];
  }
  return result;
}

/** Restituisce true se l'utente ha il modulo admin abilitato. Solo admin: sempre tutti attivi; manager rispettano enabled_features. */
export function isAdminModuleEnabled(user: { role: string; enabled_features?: unknown }, key: AdminModuleKey): boolean {
  if (user.role === 'admin') return true;
  const mods = getAdminModuleEnabled(user);
  return mods[key] === true;
}

/** Admin: tutti TRUE. Altri: solo in base al ruolo (`getEnabledFeatures`). */
export function isFeatureEnabled(
  user: { role: string; enabled_features?: unknown },
  key: EnabledFeatureKey
): boolean {
  if (user.role === 'admin') return true;
  return getEnabledFeatures(user)[key] === true;
}
