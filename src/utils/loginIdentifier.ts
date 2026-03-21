import type { User } from '../types';

/** Normalizza il nome digitato (minuscole, spazi). */
export function normalizeStaffName(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, ' ');
}

function fullNameNorm(u: User): string {
  return normalizeStaffName(`${u.first_name ?? ''} ${u.last_name ?? ''}`.trim());
}

function firstNameNorm(u: User): string {
  return normalizeStaffName(u.first_name || '');
}

export function pinMatchesStored(u: User, typedPin: string): boolean {
  return String(u.pin ?? '').trim() === typedPin.trim();
}

/**
 * Utenti attivi il cui nome coincide con quanto digitato (nome completo o solo nome).
 * Usato per anteprima lingua / WebAuthn solo se c’è un solo risultato.
 */
export function findUsersMatchingName(users: User[], nameRaw: string): User[] {
  const id = normalizeStaffName(nameRaw);
  if (!id) return [];
  const active = users.filter((u) => u.status === 'active');
  const fullHits = active.filter((u) => fullNameNorm(u) === id);
  if (fullHits.length > 0) return fullHits;
  return active.filter((u) => firstNameNorm(u) === id);
}

/**
 * Login: nome + PIN. Preferisce nome e cognome esatto; se più omonimi con lo stesso solo nome, fallisce (serve cognome).
 */
export function findUserByNameAndPin(users: User[], nameRaw: string, pin: string): User | undefined {
  const id = normalizeStaffName(nameRaw);
  if (!id || !pin.trim()) return undefined;
  const withPin = users.filter((u) => u.status === 'active' && pinMatchesStored(u, pin));

  const fullHits = withPin.filter((u) => fullNameNorm(u) === id);
  if (fullHits.length === 1) return fullHits[0];
  if (fullHits.length > 1) return undefined;

  const firstHits = withPin.filter((u) => firstNameNorm(u) === id);
  if (firstHits.length === 1) return firstHits[0];
  return undefined;
}
