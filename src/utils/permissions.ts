import { User } from '../types';
import { getTemplateDefaultTeamScheduleVisible } from './enabledFeatures';

/** Ruoli puramente gestionali: non compaiono nelle liste operative (turni, presenze, PDF). Solo Admin. */
export const PURELY_MANAGEMENT_ROLES = ['admin'] as const;

/** Ruoli con accesso gestionale: admin, proprietario, manager, assistant_manager. */
export const MANAGEMENT_ROLES = ['admin', 'proprietario', 'manager', 'assistant_manager'] as const;

/** Restituisce true se il ruolo ha accesso gestionale (dashboard completa, modifica turni, ecc.). */
export function isManagementRole(role: string): boolean {
  return MANAGEMENT_ROLES.includes(role as (typeof MANAGEMENT_ROLES)[number]);
}

/**
 * Restituisce true se il ruolo è puramente gestionale (solo Admin).
 * Questi utenti non compaiono nel tabellone turni, presenze, PDF, ecc.
 * Proprietario è allineato al Manager e compare nelle liste operative.
 */
export function isPurelyManagementRole(role: string): boolean {
  return PURELY_MANAGEMENT_ROLES.includes(role as (typeof PURELY_MANAGEMENT_ROLES)[number]);
}

/**
 * Restituisce true se l'utente può modificare turni, ferie e dati anagrafici dei dipendenti.
 * Include: admin, proprietario, manager, assistant_manager.
 */
export function canUserEdit(user: User | null): boolean {
  if (!user) return false;
  return isManagementRole(user.role);
}

/**
 * Restituisce true solo per l'Admin.
 * Funzioni riservate: Backup JSON, Ripristino Database, cancellazione dipendenti, Gestione Visibilità.
 */
export function isAdminOnly(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'admin';
}

/** Template Permessi ruoli + salvataggio moduli scheda Admin (file globali). */
export function canEditRoleFeatureTemplates(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'proprietario';
}

/**
 * Restituisce true se l'utente può vedere i dipendenti sospesi (Admin, Manager, Assistente).
 */
export function canViewSuspended(user: User | null): boolean {
  if (!user) return false;
  return isManagementRole(user.role);
}

/**
 * Dipendente attivo da mostrare nel tabellone turni, presenze collettive e riepiloghi ore di gruppo.
 * Esclude admin puro, profili non attivi e chi ha scelto di restare fuori dalla griglia (back-office).
 */
export function isUserVisibleOnTeamSchedule(user: User): boolean {
  if (user.status !== 'active' || isPurelyManagementRole(user.role)) return false;
  const explicitHide = user.hide_from_team_schedule;
  if (explicitHide === true) return false;
  if (explicitHide === false) return true;
  return getTemplateDefaultTeamScheduleVisible(user.role);
}
