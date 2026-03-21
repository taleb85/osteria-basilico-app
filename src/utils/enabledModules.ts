import { getEnabledFeatures } from './enabledFeatures';
import type { FeatureFlags } from './featureFlags';

/** Richieste ferie/permessi: disattivabile dal Master Control (`staff_requests`). */
export function isStaffRequestsFeatureEnabled(featureFlags?: FeatureFlags | null): boolean {
  return featureFlags == null || featureFlags.staff_requests !== false;
}

/**
 * Moduli abilitabili per profilo utente.
 * Ogni modulo controlla la visibilità di una scheda nella dashboard.
 */
export const ENABLED_MODULES = [
  'my_shifts',
  'team_schedule',
  'stats_hours',
  'financial_reports',
  'vacation_requests',
  'pdf_export',
] as const;

export type EnabledModule = (typeof ENABLED_MODULES)[number];

/** Mappa modulo → tab (management) */
export const MODULE_TO_TAB_MANAGEMENT: Record<EnabledModule, string | null> = {
  my_shifts: 'home',
  team_schedule: 'turni',
  stats_hours: 'reports',
  financial_reports: 'reports',
  vacation_requests: 'ferie',
  pdf_export: 'timesheet',
};

/** Mappa modulo → tab (staff - StaffPersonalDashboard) */
export const MODULE_TO_TAB_STAFF: Record<EnabledModule, string | null> = {
  my_shifts: 'home',
  team_schedule: 'shifts',
  stats_hours: 'stats',
  financial_reports: 'stats',
  vacation_requests: 'holidays',
  pdf_export: null, // staff non ha timesheet diretto
};

/** Moduli di default per admin (tutti) */
const DEFAULT_ADMIN: EnabledModule[] = [...ENABLED_MODULES];

/** Moduli di default per staff (solo my_shifts) */
const DEFAULT_STAFF: EnabledModule[] = ['my_shifts'];

export function getDefaultEnabledModules(role: string): EnabledModule[] {
  if (role === 'admin' || role === 'proprietario' || role === 'manager' || role === 'assistant_manager') {
    return DEFAULT_ADMIN;
  }
  return DEFAULT_STAFF;
}

export function getEnabledModules(user: { role: string; enabled_modules?: unknown }): EnabledModule[] {
  // Admin: sempre tutti i moduli hub (come `isFeatureEnabled`); JSONB non restringe la sessione.
  if (user.role === 'admin') {
    return [...DEFAULT_ADMIN];
  }
  const arr = user.enabled_modules;
  // Solo null/undefined = mai salvato → default per ruolo. [] esplicito = nessun modulo (non ripristinare “tutti attivi”).
  if (arr === null || arr === undefined) {
    return getDefaultEnabledModules(user.role);
  }
  if (Array.isArray(arr)) {
    return arr.filter((m): m is EnabledModule => ENABLED_MODULES.includes(m as EnabledModule));
  }
  return getDefaultEnabledModules(user.role);
}

export function isModuleEnabled(user: { role: string; enabled_modules?: unknown }, module: EnabledModule): boolean {
  return getEnabledModules(user).includes(module);
}

/**
 * Tab management: matrice permessi (`getEnabledFeatures`) + flag globali (stessi su web, mobile, PWA).
 * `featureFlags` da `useApp()`; se omesso, i gate globali non si applicano (solo test).
 */
export function getVisibleManagementTabs(
  user: { role: string; enabled_modules?: unknown; enabled_features?: unknown },
  featureFlags?: FeatureFlags | null
): string[] {
  const tabs = new Set<string>();
  const merged = getEnabledFeatures(user);
  if (merged.team_view) tabs.add('turni');
  if (merged.view_stats) tabs.add('reports');
  if (merged.export_pdf) tabs.add('timesheet');
  if (merged.ferie_tab && isStaffRequestsFeatureEnabled(featureFlags)) tabs.add('ferie');
  if (merged.admin_tab) tabs.add('settings');
  tabs.add('home');
  return Array.from(tabs);
}

/** Tab staff: stessa logica ovunque (browser / installato). */
export function getVisibleStaffTabs(
  user: { role: string; enabled_modules?: unknown; enabled_features?: unknown },
  featureFlags?: FeatureFlags | null
): string[] {
  const tabs = new Set<string>();
  const feat = getEnabledFeatures(user);
  tabs.add('home');
  if (feat.team_view) tabs.add('shifts');
  if (feat.view_stats) tabs.add('stats');
  if (feat.ferie_tab && isStaffRequestsFeatureEnabled(featureFlags)) tabs.add('holidays');
  return Array.from(tabs);
}

/** Tab principali app (bottom bar unificata PWA — stessi id per gestione e staff). */
export type AppNavTab = 'home' | 'turni' | 'ferie' | 'reports' | 'timesheet' | 'settings';

/** Titolo principale della schermata (sticky header / h1) in base alla tab. */
export function getAppNavTabTitle(t: Record<string, string>, tab: AppNavTab): string {
  switch (tab) {
    case 'home':
      return t.home_dashboard_title;
    case 'turni':
      return t.sidebar_shifts;
    case 'ferie':
      return t.sidebar_holidays;
    case 'reports':
      return t.sidebar_statistics;
    case 'timesheet':
      return t.timesheet_title;
    case 'settings':
      return t.sidebar_admin;
  }
}

const UNIFIED_NAV_ORDER: AppNavTab[] = ['home', 'turni', 'timesheet', 'reports', 'settings'];

/**
 * Voci bottom bar: stessa struttura per tutti i profili (come PWA).
 * Ferie restano fuori dalla barra (accesso da Home / link dedicati).
 */
export function getUnifiedNavTabs(
  user: { role: string; enabled_modules?: unknown; enabled_features?: unknown },
  isManagement: boolean,
  featureFlags?: FeatureFlags | null
): AppNavTab[] {
  if (isManagement) {
    const v = new Set(getVisibleManagementTabs(user, featureFlags));
    return UNIFIED_NAV_ORDER.filter((id) => id === 'home' || v.has(id));
  }
  const feat = getEnabledFeatures(user);
  const out: AppNavTab[] = ['home'];
  if (feat.team_view) out.push('turni');
  out.push('timesheet');
  if (feat.view_stats) out.push('reports');
  out.push('settings');
  return out;
}

export function isTabEnabledForUser(
  user: { role: string; enabled_modules?: unknown; enabled_features?: unknown },
  tabId: string,
  isManagement: boolean,
  featureFlags?: FeatureFlags | null
): boolean {
  if (tabId === 'profile') return true;
  if (tabId === 'settings') {
    if (isManagement) return getVisibleManagementTabs(user, featureFlags).includes('settings');
    return true;
  }
  const visible = isManagement ? getVisibleManagementTabs(user, featureFlags) : getVisibleStaffTabs(user, featureFlags);
  return visible.includes(tabId);
}
