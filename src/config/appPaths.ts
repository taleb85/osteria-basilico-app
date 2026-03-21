/**
 * Percorsi pubblici distinti: timbratura (kiosk) vs accesso profili staff/manager.
 * I vecchi `/kiosk` e `/login` reindirizzano qui per retrocompatibilità.
 */
export const PATH_TIMBRATURA = '/timbratura';
export const PATH_PROFILO = '/profilo';

/** @deprecated Usa PATH_TIMBRATURA — mantenuto per link già condivisi */
export const PATH_KIOSK_LEGACY = '/kiosk';
/** @deprecated Usa PATH_PROFILO */
export const PATH_LOGIN_LEGACY = '/login';
