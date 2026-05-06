# Sicurezza di FLOW App

## Autenticazione

FLOW NON usa Supabase Auth. L'autenticazione è completamente custom:
- **Login via PIN** salvato nella tabella `users`
- **Sessione custom** salvata in `localStorage` con chiave `app_session`
- **PIN secondario** per elevazione temporanea di ruolo
- **Biometria** (WebAuthn) per sblocco PIN su dispositivi supportati

## PIN e Hashing

Il PIN viene hashato lato client con SHA-256 (`src/utils/pinHash.ts`) PRIMA di essere inviato al DB.
La tabella `users` contiene il digest SHA-256, non il PIN in chiaro.

**Limitazioni attuali:**
- SHA-256 è veloce: vulnerabile a brute force se il DB viene compromesso
- Non c'è salt per-utente (tutti i PIN usano SHA-256 diretto)
- L'hashing è lato client: un utente malintenzionato con accesso al client può intercettare il PIN prima dell'hashing

**Miglioramenti futuri:**
1. Edge Function `/pin-hash` con salt per-utente e bcrypt/argon2
2. Rate limiting sugli endpoint di login
3. Supabase Auth JWT custom al posto della sessione localStorage

## RLS Policies

Tutta l'autorizzazione è gestita tramite RLS Policies di Supabase.
La chiave anonima ha accesso a tutte le operazioni, ma le RLS filtrano in base a:
- `tenant_id` (multi-tenancy)
- Ruolo dell'utente (`admin`, `manager`, `waiter`, ecc.)
- `user_id` (un utente vede solo i propri dati)

## Raccomandazioni

1. **Service role key**: NON deve mai essere nel bundle client (verificato da `verify-dist-no-service-role.mjs`)
2. **Script Node**: i vari script in `scripts/` usano `VITE_SUPABASE_SERVICE_ROLE_KEY` — assicurarsi che `.env` non sia esposto
3. **HTTPS**: obbligatorio per WebAuthn e notifiche push
4. **XSS**: la sessione in localStorage è vulnerabile a XSS — sanitizzare sempre gli input utente
