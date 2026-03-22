/**
 * Eccezioni per utente sopra ai template di ruolo (Storage + default codice).
 * `enabled_features` contiene solo override; chiavi assenti = eredita dal template.
 */
import type { User } from '../types';
import type { FeatureFlags } from './featureFlags';
import {
  getEnabledFeatures,
  DASHBOARD_TAB_FEATURE_KEYS,
  PERMISSION_MATRIX_KEYS,
  type EnabledFeatureKey,
} from './enabledFeatures';
import {
  getEnabledModules,
  ENABLED_MODULES,
  type EnabledModule,
  getUnifiedNavTabs,
  MODULE_TO_TAB_MANAGEMENT,
  MODULE_TO_TAB_STAFF,
  type AppNavTab,
} from './enabledModules';

/** Raggruppa widget UI (`screenGroup`) sotto la scheda bottom bar / hub anteprima. */
const UI_SCREEN_GROUP_TO_PREVIEW_TAB: Record<string, AppNavTab> = {
  home_mgmt: 'home',
  home_compact: 'home',
  staff_home: 'home',
  turni: 'turni',
  staff_shifts: 'turni',
  ferie: 'ferie',
  staff_holidays: 'ferie',
  timesheet: 'timesheet',
  stats: 'reports',
  staff_profile: 'settings',
};

export function screenGroupToPreviewTab(screenGroup: string): AppNavTab {
  return UI_SCREEN_GROUP_TO_PREVIEW_TAB[screenGroup] ?? 'home';
}

/** Dove mostrare il toggle permesso nella hub “Cosa vede chi” (per scheda). */
export function featureKeyToPreviewTab(key: EnabledFeatureKey): AppNavTab {
  switch (key) {
    case 'home_tab':
      return 'home';
    case 'team_view':
    case 'edit_shifts':
    case 'approve_shifts':
      return 'turni';
    case 'export_pdf':
      return 'timesheet';
    case 'view_stats':
    case 'view_estimated_cost':
      return 'reports';
    case 'desktop_access':
      return 'settings';
    case 'ferie_tab':
      return 'ferie';
    case 'admin_tab':
      return 'settings';
    default:
      return 'settings';
  }
}

/** Schede nell’anteprima admin: identiche alla bottom bar reale. */
export function getProfileHubTabs(
  user: User,
  isManagement: boolean,
  featureFlags?: FeatureFlags | null
): AppNavTab[] {
  return getUnifiedNavTabs(user, isManagement, featureFlags);
}

export function staffModuleToPreviewTab(mod: EnabledModule, isManagement: boolean): AppNavTab {
  if (isManagement) {
    const t = MODULE_TO_TAB_MANAGEMENT[mod];
    if (t === 'home') return 'home';
    if (t === 'turni') return 'turni';
    if (t === 'ferie') return 'ferie';
    if (t === 'timesheet') return 'timesheet';
    if (t === 'reports') return 'reports';
    return 'home';
  }
  const t = MODULE_TO_TAB_STAFF[mod];
  if (t === 'home') return 'home';
  if (t === 'shifts') return 'turni';
  if (t === 'holidays') return 'ferie';
  if (t === 'stats') return 'reports';
  if (t === null && mod === 'pdf_export') return 'timesheet';
  return 'home';
}

export function getTemplateOnlyFeaturesUser(user: User): User {
  return { ...user, enabled_features: undefined };
}

/** Valori effettivi (template + eventuali override su questo utente). */
export function getEffectiveFeaturesForUser(user: User) {
  return getEnabledFeatures(user);
}

/** Solo template di ruolo + file globale, senza `users.enabled_features`. */
export function getTemplateBaselineFeatures(user: User) {
  return getEnabledFeatures(getTemplateOnlyFeaturesUser(user));
}

export function isFeatureExplicitlyOverridden(user: User, key: EnabledFeatureKey): boolean {
  const raw = user.enabled_features;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  return typeof (raw as Record<string, unknown>)[key] === 'boolean';
}

/**
 * Dopo il toggle: se coincide col template, rimuove l'override per quella chiave.
 * Restituisce `null` se non resta nessun override (persisti come `{}` per JSONB pulito).
 */
export function computeNextEnabledFeaturesOverride(
  user: User,
  key: EnabledFeatureKey,
  desiredOn: boolean
): Record<string, boolean> | null {
  const baseline = getTemplateBaselineFeatures(user);
  const baselineOn = baseline[key] === true;
  const prev = { ...(user.enabled_features ?? {}) } as Record<string, boolean>;

  if (desiredOn === baselineOn) {
    delete prev[key];
  } else {
    prev[key] = desiredOn;
  }

  if (Object.keys(prev).length === 0) return null;
  return prev as Record<string, boolean>;
}

export const PROFILE_VISIBILITY_FEATURE_KEYS: EnabledFeatureKey[] = [
  ...PERMISSION_MATRIX_KEYS,
  ...DASHBOARD_TAB_FEATURE_KEYS,
];

export function toggleStaffModule(user: User, module: EnabledModule, enable: boolean): EnabledModule[] {
  const current = new Set(getEnabledModules(user));
  if (enable) current.add(module);
  else current.delete(module);
  return ENABLED_MODULES.filter((m) => current.has(m));
}

const MODULE_LABELS_IT: Record<EnabledModule, string> = {
  my_shifts: 'I miei turni',
  team_schedule: 'Tabellone team',
  stats_hours: 'Statistiche ore',
  financial_reports: 'Report / finanziari',
  vacation_requests: 'Ferie e permessi',
  pdf_export: 'PDF presenze',
};

export function getModuleLabel(module: EnabledModule, lang: string): string {
  if (lang === 'en') {
    const en: Record<EnabledModule, string> = {
      my_shifts: 'My shifts',
      team_schedule: 'Team schedule',
      stats_hours: 'Hours stats',
      financial_reports: 'Reports',
      vacation_requests: 'Time off',
      pdf_export: 'Attendance PDF',
    };
    return en[module];
  }
  return MODULE_LABELS_IT[module];
}
