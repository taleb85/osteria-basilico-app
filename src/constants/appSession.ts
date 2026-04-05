/**
 * Chiave localStorage per “resta collegato”:
 * `{ userId: string; email?: string; tenantSlug?: string }`.
 * `email` opzionale: dopo merge utenti sul DB il vecchio userId può sparire; il ripristino può usare l’email.
 * `tenantSlug` (Option B single-URL): serve a caricare il tenant prima del ripristino sessione su `/app`.
 */
export const APP_SESSION_STORAGE_KEY = 'app_session';
