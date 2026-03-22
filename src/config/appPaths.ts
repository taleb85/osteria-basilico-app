/**
 * Percorsi pubblici distinti: timbratura (kiosk) vs accesso profili staff/manager.
 * I vecchi `/kiosk` e `/login` reindirizzano qui per retrocompatibilità.
 */
export const PATH_TIMBRATURA = '/timbratura';
export const PATH_PROFILO = '/profilo';

export type ProfiloInviteLinkOptions = {
  /** Nome per il login (dal modulo admin; può differire dal DB finché non salvi). */
  displayName?: string;
  /** PIN a 4 cifre — incluso nel link solo se completo. */
  pin?: string;
};

/**
 * Link invito: `?u=id` obbligatorio; opzionali `n` (nome) e `p` (PIN) presi dal modulo admin.
 * Il PIN nell’URL è sensibile: condividi solo canali privati.
 */
export function buildProfiloAccessLink(
  userId: string,
  origin?: string,
  options?: ProfiloInviteLinkOptions
): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const params = new URLSearchParams();
  params.set('u', userId);
  const name = options?.displayName?.trim();
  if (name) params.set('n', name);
  const pinDigits = (options?.pin ?? '').replace(/\D/g, '').slice(0, 4);
  if (pinDigits.length === 4) params.set('p', pinDigits);
  return `${base}${PATH_PROFILO}?${params.toString()}`;
}

/** @deprecated Usa PATH_TIMBRATURA — mantenuto per link già condivisi */
export const PATH_KIOSK_LEGACY = '/kiosk';
/** @deprecated Usa PATH_PROFILO */
export const PATH_LOGIN_LEGACY = '/login';
