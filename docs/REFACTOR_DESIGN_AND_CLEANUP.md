# Refactor design, i18n e cleanup (2026)

## Design system
- **Primario**: `#2D5A27` (Tailwind `accent`, CSS `--accent` / `--basilico-primary`).
- **Font**: solo **Inter** (+ stack di sistema). Rimosso Playfair da `index.html`; `tailwind` `serif` allineato al sans; `.font-brand-serif` usa Inter semibold.
- **Turni (WeeklyShiftsTable)**:
  - **Bozza**: sfondo bianco, bordo solido `border-accent` (#2D5A27), testo scuro.
  - **Approvato**: sfondo `accent`, testo bianco, bordo basilico.
  - Celle turno: altezza minima **44px** (touch).

## PDF
- `exportSchedulePDF.ts`, `exportPersonalPDF.ts`, `Timesheets.tsx` (PDF): intestazioni e accenti principali portati al verde basilico **RGB(45, 90, 39)**.

## Mobile / PWA
- **Sidebar**: voci nav e logout `min-h-[44px]`; selettore lingua `44×44`.
- **BottomNav** (tablet): tab `min-h-[44px]`.
- **AdminLayout**: pulsanti header/tab `min-h-[44px]`; nav a capo su schermi stretti.

## i18n
- Aggiunte chiavi `admin_back_to_app`, `admin_nav_*` in **IT / EN / ES / FR** (`translations.ts`).
- **AdminLayout** usa `getTranslations(effectiveLanguage)`.

## Cleanup
- Rimossi script di seed/test: `scripts/seed-test-ux.js`, `seed-march11.js`, `import-week-2026-03-09.js`.
- Da `package.json` rimossi gli script `seed:today`, `seed:test-ux`, `import:week-09-15-mar`.
- `reset-production.js`: messaggio aggiornato (niente riferimento a seed rimossi).
- Eliminato `console.log` successo email in `AppContext`.

## Admin invisibile (operativo)
- Già garantito da `isPurelyManagementRole` → solo **`admin`** escluso da `activeUsers` in **WeeklyShiftsTable** (PDF settimanale usa gli stessi utenti passati dall’export).

## i18n Timesheets + WeeklyShiftsTable
- **`formatTrans(template, { ... })`** in `translations.ts` per stringhe con segnaposto `{chiave}`.
- **Timesheets**: export CSV/PDF (intestazioni, brand, footer, validazione, `IN→?`, totali), toast congelo, `save_error`, header periodo/vista, tooltip tabella/card, etichette incrocio giorni / OUT mancante.
- **WeeklyShiftsTable**: template (salva/applica/elimina + messaggi con `{created}`/`{skipped}`), turni aperti (richiesta/approva/rifiuta), salvataggi, sblocco PIN, spostamento, copia/eliminazione bulk, conflitti orari, modale orario, `ShiftEditPanel`, `CreateShiftModal`, filtri stato, leggenda colori/violazioni, selettore stato nel drawer.

## Aggiornamento i18n (kiosk / terminale / contesto)
- **PunchInKiosk**, **PunchClockTerminal**: PIN non valido, utente sospeso, messaggi errore DB RLS/400, uscita cena → chiavi `pin_invalid`, `user_suspended_punch`, `punch_db_error_*`, `punch_dinner_exit_contact_manager`, `punch_entry_success` in IT/EN/ES/FR.
- **AppContext** `addPunchRecord`: messaggio “già in corso” → `punch_in_progress`.

## Da fare in seguito (non completato in questo passaggio)
- Migrare tutte le stringhe di **RoleFeatureTemplatesPage**, **ImpostazioniPage**, messaggi CSV/PDF hardcoded in **Timesheets** verso i18n.
- Audit completo `grep` su virgolette italiane nei componenti (es. etichette turno nel Kiosk: «Timbra Uscita», ecc.).
- Ottimizzazione asset logo (`/public`) con export WebP/PNG multi-size se necessario.
