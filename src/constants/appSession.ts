/**
 * Chiave localStorage per “resta collegato”: JSON `{ userId: string; email?: string }`.
 * `email` opzionale: dopo merge utenti sul DB il vecchio userId può sparire; il ripristino può usare l’email.
 */
export const APP_SESSION_STORAGE_KEY = 'app_session';
