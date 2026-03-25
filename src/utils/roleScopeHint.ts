/** Ruoli con focus operativo sul campo (turni, staff). */
const OPERATIONAL_SCOPE_ROLES = new Set(['manager', 'assistant_manager', 'capo']);

/**
 * Testo che chiarisce il ruolo: admin = gestione struttura; manager/assistente/capo = operatività sul campo.
 */
export function getRoleScopeHint(
  role: string,
  tr: Record<string, string>
): string | null {
  if (role === 'admin') return tr.role_scope_admin || null;
  if (OPERATIONAL_SCOPE_ROLES.has(role)) return tr.role_scope_operational || null;
  return null;
}
