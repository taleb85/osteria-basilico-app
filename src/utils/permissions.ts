import { User } from '../types';
import { getTemplateDefaultTeamScheduleVisible, getRolePermissionGroup } from './enabledFeatures';

/** Ruoli puramente gestionali: non compaiono nelle liste operative (turni, presenze, PDF). Solo Admin. */
export const PURELY_MANAGEMENT_ROLES = ['admin'] as const;

/** Ruoli con accesso gestionale: admin, manager, assistant_manager. */
export const MANAGEMENT_ROLES = ['admin', 'manager', 'assistant_manager'] as const;

/** Restituisce true se il ruolo ha accesso gestionale (dashboard completa, modifica turni, ecc.). */
export function isManagementRole(role: string): boolean {
  return MANAGEMENT_ROLES.includes(role as (typeof MANAGEMENT_ROLES)[number]);
}

/**
 * Restituisce true se il ruolo è puramente gestionale (solo Admin).
 * L’Admin non compare nel tabellone turni / liste operative come dipendente; gli altri ruoli sì, se visibili.
 */
export function isPurelyManagementRole(role: string): boolean {
  return PURELY_MANAGEMENT_ROLES.includes(role as (typeof PURELY_MANAGEMENT_ROLES)[number]);
}

/**
 * Modifica Impostazioni / anagrafica team / strumenti admin nella scheda collegata.
 * Solo **Admin**: manager e altri ruoli gestionali non hanno accesso finché non promossi ad admin.
 */
export function canUserEdit(user: User | null): boolean {
  if (!user) return false;
  return isAdminOnly(user);
}

/**
 * Restituisce true solo per l'Admin.
 * Funzioni riservate: Backup JSON, Ripristino Database, cancellazione dipendenti, Gestione Visibilità.
 */
export function isAdminOnly(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'admin';
}

/** Template permessi ruoli + moduli scheda Admin (file Storage): solo Admin. */
export function canEditRoleFeatureTemplates(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'admin';
}

/** Elenco sospesi/inattivi in Impostazioni: solo Admin. */
export function canViewSuspended(user: User | null): boolean {
  if (!user) return false;
  return isAdminOnly(user);
}

/**
 * Tabellone turni / griglia Presenze di squadra: operazioni sul team.
 * Ruoli gestionali (admin, manager, assistant_manager) sempre; staff operativo solo con `can_create_shifts`.
 */
export function canOperateTeamSchedule(user: User | null): boolean {
  if (!user) return false;
  if (isManagementRole(user.role)) return true;
  return user.can_create_shifts === true;
}

/**
 * Creazione, modifica orari/spostamento, eliminazione e copia turni sul planning.
 */
export function canEditTeamShifts(user: User | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'manager' || user.role === 'assistant_manager') return true;
  return user.can_create_shifts === true;
}

/** Approvazione turni (freeze) e ferie: Admin o `can_approve_shifts`. */
export function canApproveShiftActions(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.can_approve_shifts === true;
}

const FREEZE_PIN_ROLES = new Set(['admin', 'manager', 'assistant_manager']);

/**
 * PIN inserito per congelare il turno: deve corrispondere a un utente attivo con permesso di approvazione
 * e ruolo manager / assistant manager / admin.
 */
export function findFreezeVerifierByPin(users: User[], pin: string): User | null {
  const p = (pin || '').trim();
  if (!p) return null;
  const u = users.find((x) => x.pin === p && x.status === 'active');
  if (!u || !canApproveShiftActions(u)) return null;
  if (!FREEZE_PIN_ROLES.has(u.role)) return null;
  return u;
}

/**
 * Verifica tramite biometrica: restituisce l'utente se è attivo e ha ruolo sufficiente.
 * Usato quando l'impronta digitale sostituisce il PIN.
 */
export function findFreezeVerifierById(users: User[], userId: string): User | null {
  if (!userId) return null;
  const u = users.find((x) => x.id === userId && x.status === 'active');
  if (!u || !canApproveShiftActions(u)) return null;
  if (!FREEZE_PIN_ROLES.has(u.role)) return null;
  return u;
}

/** Pubblicazione settimana / bozze → confermati: Admin o `can_manage_drafts`. */
export function canPublishScheduleDrafts(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.can_manage_drafts === true;
}

/**
 * Ore totali / viste payroll di gruppo (scheda Ore, riepiloghi).
 * Regola di base: Solo i profili gestionali vedono gli orari altrui. Gli altri vedono solo i propri.
 */
export function canViewAllTeamHours(user: User | null): boolean {
  if (!user) return false;
  // Solo i ruoli definiti in MANAGEMENT_ROLES hanno accesso alla vista completa del team
  return isManagementRole(user.role);
}

/** Modifica PIN altrui: Admin o `can_edit_staff_pins`. */
export function canEditOtherStaffPins(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.can_edit_staff_pins === true;
}

/**
 * Manager / Assistant manager: scheda Impostazioni limitata (solo dipendenti operativi:
 * elenco profilo in lettura, creazione, sospensione). L’admin resta su vista completa.
 */
export function canManageDelegatedStaff(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'manager' || user.role === 'assistant_manager';
}

/** Dipendente “di sala/cucina/bar” (esclusi admin, manager, assistant, capo) per elenco delegato. */
export function isOperationalStaffRole(role: string): boolean {
  return getRolePermissionGroup(role) === 'staff';
}

/**
 * Dipendente attivo da mostrare nel tabellone turni, presenze collettive e riepiloghi ore di gruppo.
 * L'admin è un profilo di controllo puro: non compare MAI nelle viste operative, indipendentemente
 * da turni assegnati o override di visibilità.
 */
export function isUserVisibleOnTeamSchedule(user: User, shifts?: { user_id: string }[]): boolean {
  if (user.status !== 'active') return false;

  // Admin = profilo impostazioni puro: sempre escluso dalle viste operative.
  if (isPurelyManagementRole(user.role)) return false;

  const explicitVisible = user.team_schedule_visible;
  if (explicitVisible === true) return true;
  if (explicitVisible === false) return false;

  const explicitHide = user.hide_from_team_schedule;
  if (explicitHide === true) return false;
  if (explicitHide === false) return true;

  // Soppresso il parametro `shifts` — non più necessario, mantenuto per compatibilità firma.
  void shifts;
  return getTemplateDefaultTeamScheduleVisible(user.role);
}

/** Numero di profili con ruolo admin e stato attivo. */
export function countActiveAdmins(users: User[]): number {
  return users.filter((u) => u.role === 'admin' && u.status === 'active').length;
}

/**
 * True se, applicando role/status al profilo `targetUserId`, non resterebbe nessun admin attivo.
 * Usato per evitare di chiudere fuori dall’app l’ultimo accesso a Impostazioni complete.
 */
export function wouldLeaveNoActiveAdmin(
  users: User[],
  targetUserId: string,
  patch: Partial<Pick<User, 'role' | 'status'>>
): boolean {
  if (patch.role === undefined && patch.status === undefined) return false;
  const target = users.find((u) => u.id === targetUserId);
  if (!target) return false;

  const nextRole = patch.role !== undefined ? patch.role : target.role;
  const nextStatus = patch.status !== undefined ? patch.status : target.status;

  const activeAdminsAfter = users.filter((u) => {
    if (u.id === targetUserId) {
      return nextRole === 'admin' && nextStatus === 'active';
    }
    return u.role === 'admin' && u.status === 'active';
  }).length;

  return activeAdminsAfter < 1;
}
