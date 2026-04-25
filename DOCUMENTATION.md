# FLOW — Documentazione Tecnica Esaustiva

> App di gestione del personale per Osteria Basilico.  
> Stack: **Vite 5 + React 18 + React Router 7 + Supabase + Tailwind CSS + PWA (vite-plugin-pwa)**  
> Deploy: **Cloudflare Pages** (SPA, routing client-side, `public/_redirects` + asset statici)

---

## Indice

1. [Architettura Generale](#1-architettura-generale)
2. [Modulo Autenticazione & Sessione](#2-modulo-autenticazione--sessione)
3. [Modulo Turni (Scheduling)](#3-modulo-turni-scheduling)
4. [Modulo Presenze (Timesheets)](#4-modulo-presenze-timesheets)
5. [Modulo Timbratura (Punch)](#5-modulo-timbratura-punch)
6. [Modulo Ferie & Permessi](#6-modulo-ferie--permessi)
7. [Modulo Statistiche & Report](#7-modulo-statistiche--report)
8. [Modulo Notifiche & Messaggi](#8-modulo-notifiche--messaggi)
9. [Modulo Impostazioni & Feature Flags](#9-modulo-impostazioni--feature-flags)
10. [Modulo Multi-Tenant](#10-modulo-multi-tenant)
11. [Modulo Pannello Admin](#11-modulo-pannello-admin)
12. [Modulo SuperAdmin](#12-modulo-superadmin)
13. [Modulo PWA & Service Worker](#13-modulo-pwa--service-worker)
14. [Supabase Edge Functions](#14-supabase-edge-functions)
15. [Data Flow Globale](#15-data-flow-globale)
16. [Mappa dei Ruoli e Permessi](#16-mappa-dei-ruoli-e-permessi)
17. [Schema Database (Entità Principali)](#17-schema-database-entità-principali)
18. [Relazioni tra Moduli](#18-relazioni-tra-moduli)

---

## 1. Architettura Generale

### Core Features

- SPA React senza SSR; il routing è interamente lato client via `react-router-dom v7`.
- Entry point: `index.html` → `src/main.tsx` → `BrowserRouter` → `App`.
- **Non esiste** una cartella `pages/` o `app/` (stile Next.js): le "pagine" sono rotte dichiarate in `App.tsx` e componenti React sotto `src/components/`.
- Il backend è **Supabase** (PostgreSQL + Auth + Storage + Realtime + Edge Functions Deno).
- La UI è divisa in due grandi rami: **Gestione** (admin/manager/assistant_manager) e **Staff** (tutti gli altri ruoli operativi).

### Mappa delle Rotte (`App.tsx`)

| Path | Componente | Accesso |
|---|---|---|
| `/` | Redirect → `/profilo` | Tutti |
| `/profilo` | `LoginRoute` → `LoginPage` | Non autenticati |
| `/login` | Redirect → `/profilo` | — |
| `/app` | `ProtectedApp` → `MainApp` | Autenticati |
| `/app/*` | `ProtectedApp` → `MainApp` | Autenticati |
| `/admin` | `AdminGate` → `AdminLayout` | Admin/Manager/Ass.Manager |
| `/admin/*` | `AdminGate` → `AdminLayout` | Admin/Manager/Ass.Manager |
| `/kiosk` | Redirect → `/profilo` | — |
| `/timbratura` | Redirect → `/profilo` | — |
| `/i/:slug` | `InviteRedirect` | Link invito |
| `/super-admin` | `SuperAdminPanel` | Dominio super-admin |
| `/anim-preview` | `AnimPreview` | Dev |
| `/loading-preview` | `LoadingPreview` | Dev |
| `/screens-preview` | `ScreensPreview` | Dev |
| `*` | Redirect → `/profilo` | — |

### Provider Stack (wrapping globale)

```
BrowserRouter
  └─ App
       ├─ Route /super-admin → SuperAdminPanel (isolato)
       └─ Route * →
            AppProvider          (stato globale: utenti, turni, presenze, ferie…)
              └─ LayoutPresetProvider  (preset layout UI)
                   └─ AppContent
                        └─ PwaGate → rotte applicazione
```

### File di Configurazione

| File | Scopo |
|---|---|
| `scripts/vite.config.mjs` | Config Vite ufficiale per build/dev |
| `tailwind.config.js` | Estensioni tema Tailwind |
| `tsconfig.app.json` | TypeScript per il codice app |
| `public/_redirects` | SPA fallback (Pages / host statici) |
| `src/config/publicAppUrl.ts` | Origine canoniche produzione (Cloudflare) |
| `public/manifest.json` | Manifest PWA |
| `src/config/appPaths.ts` | Costanti path app (`PATH_PROFILO`, ecc.) |
| `src/constants/appSession.ts` | Chiave sessionStorage sessione utente |

---

## 2. Modulo Autenticazione & Sessione

### Core Features

- Login tramite **PIN a 4 cifre** (non email+password classico): l'utente inserisce il proprio nome e il PIN dal tabellone dei profili.
- Sessione persistita in `localStorage` con chiave `APP_SESSION_STORAGE_KEY`.
- Supporto **sessione elevata** via PIN secondario (`secondary_pin`): concede temporaneamente un ruolo superiore (`elevated_role`) senza logout.
- **Blocco PIN post-refresh**: dopo sincronizzazione pesante, l'app viene bloccata e richiede il PIN per riaprirsi (overlay `RefreshLockOverlay`).
- **WebAuthn / Biometria**: possibilità di registrare il dispositivo per sblocco con Face ID / Touch ID senza reinserire il PIN (`pinUnlockWebAuthn.ts`).
- **PIN sessione globale** (Management): pulsante in header desktop sblocca tutte le operazioni protette da PIN per tutta la sessione.
- **Redirect safe**: `safeInternalRedirectPath()` previene open-redirect validando che il path sia interno.
- **Force logout**: `forceLogoutRequested` da AppContext forza logout anche su tab non attive.
- **Onboarding obbligatorio**: se email o telefono mancano, `OnboardingSetupModal` blocca la UI finché non completati.

### Mappa delle Funzioni

| Funzione | File | Logica |
|---|---|---|
| `LoginPage` | `src/components/LoginPage.tsx` | Mostra lista profili, accetta PIN, chiama `setCurrentUser` |
| `safeInternalRedirectPath(state)` | `App.tsx` | Valida `state.from.pathname` — deve iniziare con `/` e non contenere `://` |
| `handleLogout()` | `App.tsx` (ProtectedApp) | Applica tema guest, rimuove sessione localStorage, reindirizza a `/profilo` |
| `unlockAfterRefresh(pin)` | `AppContext.tsx` | Confronta PIN con utenti → sblocca overlay post-refresh |
| `unlockAfterRefreshWithDevice()` | `AppContext.tsx` | Chiama WebAuthn `authenticatePinUnlockCredential` |
| `registerPinUnlockDevice(pin)` | `AppContext.tsx` | Verifica PIN poi chiama `registerPinUnlockCredential(userId)` |
| `pinMatchesStored(input, stored)` | `src/utils/loginIdentifier.ts` | Confronto costante-time PIN |
| `findActiveUserWithSamePin(users, pin)` | `src/utils/loginIdentifier.ts` | Trova utente attivo con quel PIN |
| `persistStoredUiLanguage(lang)` | `src/utils/uiLanguagePreference.ts` | Salva preferenza lingua in localStorage |
| `authenticatePinUnlockCredential()` | `src/utils/pinUnlockWebAuthn.ts` | `navigator.credentials.get()` WebAuthn |
| `registerPinUnlockCredential(userId)` | `src/utils/pinUnlockWebAuthn.ts` | `navigator.credentials.create()` WebAuthn |

### Data Flow

```
Utente inserisce PIN
  → LoginPage.handleLogin()
  → AppContext.setCurrentUser(user)
  → persistito in localStorage (APP_SESSION_STORAGE_KEY)
  → AppContext.loadInitialData() rileva sessione al boot successivo
  → silentRefreshData() sincronizza dati dal DB
```

### Relazioni

- Dipende da: `AppContext`, `TenantContext`, `src/lib/supabase.ts`
- Alimenta: tutti gli altri moduli (currentUser come prerequisito)

---

## 3. Modulo Turni (Scheduling)

### Core Features

- **Tabellone settimanale** (`WeeklyShiftsTable`): griglia utenti × giorni, con drag-and-drop, copia turni, modifica inline.
- **Vista mobile gestione** (`ManagementMobileShifts`): lista turni per settimana ottimizzata touchscreen.
- **Tipi turno**: `lunch` | `dinner` (pranzo / cena).
- **Stati approvazione**: `draft` → `confirmed` → `approved` (congelato con PIN).
- **Congelamento turno**: `approveShift()` con PIN blocca `start_time`/`end_time` approvati; non modificabili senza sblocco.
- **Approvazione soft**: `approveShiftSoft()` — marca approvato senza congelo immediato.
- **Pubblicazione batch**: `publishWeekShifts(weekStart)` — passa tutti i draft della settimana a `confirmed`.
- **Pubblicazione giornaliera**: `publishDayShifts(dateStr)` — batch per singolo giorno.
- **Pausa automatica**: se `auto_breaks` feature attiva, calcola automaticamente `break_minutes` in base alle regole (`breakRules`).
- **Conflitti**: `hasShiftConflictSameDay()` — verifica sovrapposizioni per stesso utente stessa data.
- **Rilevamento violazioni**: `workRules` — ore massime giornaliere, settimanali, riposo minimo, soglia ritardo.
- **Storico modifiche**: `logShiftEdit()` / `logHistory()` — ogni modifica è tracciata in `scheduleHistory`.
- **Template ruoli**: `RoleFeatureTemplatesPage` — admin configura quali permessi/moduli ha ogni ruolo per default.
- **Copia turno**: `copyShift(shift, newDate)` — duplica un turno su data diversa.
- **Modalità privacy timesheet**: `getTimesheetGridPrivacyMode()` — nasconde dati sensibili per alcuni ruoli.
- **Skill / competenze**: campo `skills` sul turno per annotare competenze richieste (es. "sommelier, cassa").
- **Reparti**: campo `department` — filtra/colora turni per reparto (sala, cucina, bar).

### Mappa delle Funzioni

| Funzione | File | Parametri chiave |
|---|---|---|
| `addShift(shift)` | `AppContext.tsx` | `Omit<Shift, 'id'>` — inserisce e sincronizza DB |
| `updateShift(id, partial)` | `AppContext.tsx` | aggiornamento parziale Shift |
| `deleteShift(id)` | `AppContext.tsx` | elimina singolo turno |
| `deleteShifts(ids[])` | `AppContext.tsx` | eliminazione batch |
| `approveShift(shiftId, opts)` | `AppContext.tsx` | `approvedStart`, `approvedEnd`, `actorOverride`, `promoteFromDraft` |
| `approveShiftSoft(shiftId)` | `AppContext.tsx` | nessun congelo timestamp |
| `copyShift(shift, newDate)` | `AppContext.tsx` | duplica con reset stato a `draft` |
| `publishWeekShifts(weekStart)` | `AppContext.tsx` | `Date` — batch draft→confirmed |
| `publishDayShifts(dateStr)` | `AppContext.tsx` | `yyyy-MM-dd` |
| `hasShiftConflictSameDay(shifts, userId, date, start, end, excludeId?)` | `src/utils/timeCalculations.ts` | verifica overlap ORA su stessa data |
| `calculateShiftMinutesGross(start, end)` | `src/utils/timeCalculations.ts` | minuti totali turno lordi |
| `computeEffectivePunchIn(shift, punchRecords)` | `src/utils/timeCalculations.ts` | orario timbratura effettiva |
| `getBreakMinutesForShift(shift, rules)` | `src/utils/breakRules.ts` | minuti pausa da applicare |
| `logShiftEdit(userId, shiftId, changes)` | `src/utils/scheduleHistory.ts` | salva voce audit |
| `isShiftPayrollFrozen(shift)` | `src/utils/timesheetFreezeCriteria.ts` | true se turno congelato definitivamente |
| `getDefaultApprovalClockHHMM(shift)` | `src/utils/shiftResolvedClockTimes.ts` | orario approvazione default HH:mm |

### Data Flow

```
WeeklyShiftsTable / ManagementMobileShifts
  → addShift / updateShift / deleteShift (AppContext)
  → database.addShift() / updateShift() (src/lib/database.ts)
  → Supabase: INSERT/UPDATE/PATCH tabella `shifts`
  → AppContext aggiorna stato `shifts[]` in memoria
  → Supabase DB Webhook → Edge Function shift-change-webhook
  → send-push-notification → dipendente riceve push
```

### Relazioni

- Dipende da: `AppContext (shifts, users, featureFlags, workRules, breakRules)`, `TenantContext`
- Alimenta: `Timesheets`, `Statistics`, `HolidayRequests` (controllo disponibilità)

---

## 4. Modulo Presenze (Timesheets)

### Core Features

- **Griglia presenze** (`Timesheets`): vista tabellare mensile per tutti gli utenti, con badge ore per cella.
- **Vista mobile gestione** (`ManagementMobileTimesheet`): presenze compatte per data su mobile.
- **Riepilogo mensile** (`MonthlySummaryTable`): ore totali per dipendente con colonne giorni.
- **KPI block** (`TimesheetManagementKpiBlock`): totali ore lavorate, straordinari, assenze.
- **Modifica manuale timbrature**: manager/admin possono correggere `timestamp`, `calculated_time`, `clock_out_time`.
- **Audit log**: ogni modifica manuale genera `PunchAuditEntry` in `punch_audit_log`.
- **Esportazione PDF**: `exportTimesheetPdf.ts` / `timesheetPdfFromRange.ts` generano PDF periodo con `jsPDF`.
- **Esportazione dati**: `exportUtils.ts` — CSV / JSON per range di date.
- **Periodo timesheet**: configurabile da admin (date inizio/fine ciclo paghe) persistito su Supabase Storage.
- **Privacy mode**: `getTimesheetGridPrivacyMode(user)` — ruoli non-admin possono vedere solo `planned_only` (orari pianificati senza timbrature altrui).
- **Presenze confermate mensili**: `monthly_confirmed` campo JSONB su `users` — snapshot ore/turni per mese chiuso.
- **Statistiche** (`Statistics`): sub-tab di Timesheets — grafici ore, distribuzione turni, costi stimati.

### Mappa delle Funzioni

| Funzione | File | Logica |
|---|---|---|
| `updatePunchRecord(id, updates)` | `AppContext.tsx` | aggiorna campi timbratura + scrive audit log |
| `deletePunchRecordsForShift(shiftId)` | `AppContext.tsx` | elimina tutte le timbrature per un turno |
| `exportTimesheetPdf(opts)` | `src/utils/exportTimesheetPdf.ts` | genera PDF mensile con jsPDF |
| `timesheetPdfFromRange(opts)` | `src/utils/timesheetPdfFromRange.ts` | PDF per range date personalizzato |
| `exportPersonalPDF(user, shifts, punchRecords)` | `src/utils/exportPersonalPDF.ts` | PDF personale dipendente |
| `exportSchedulePDF(opts)` | `src/utils/exportSchedulePDF.ts` | PDF tabellone settimanale |
| `getTimesheetGridPrivacyMode(user)` | `src/utils/timesheetGridPrivacy.ts` | `'full'` | `'planned_only'` |
| `loadTimesheetPeriodFromSupabase()` | `src/utils/timesheetPeriodSupabase.ts` | legge config periodo da Storage |
| `applyRemoteTimesheetPeriod(remote)` | `src/utils/timesheetPeriodSupabase.ts` | merge con config locale |
| `computeStats(shifts, punchRecords, users)` | `src/utils/stats.ts` | calcola aggregati ore/turni/costi |

### Data Flow

```
Timesheets component
  → legge AppContext.punchRecords + shifts + users
  → calcola ore effettive tramite timeCalculations
  → updatePunchRecord() → database.updatePunchRecord()
  → INSERT punch_audit_log (tracciabilità)
  → Supabase tabelle `punch_records`, `punch_audit_log`
```

---

## 5. Modulo Timbratura (Punch)

### Core Features

- **Kiosk** (`PunchInKiosk` / `PunchClockTerminal` / `StaffKioskView`): terminale self-service a schermo intero su tablet/iPad per timbrare entrata/uscita via PIN.
- **Timbratura da app** (`can_punch_from_app`): staff con permesso abilitato può timbrare direttamente dalla propria dashboard personale.
- **Timbratura da Manager**: un manager può timbrare entrata/uscita per conto di un dipendente (`source: 'manager'`).
- **Geofence**: se `geofence_punch` feature attiva, `isUserInRestaurantRange()` verifica che il dispositivo sia nel raggio configurato prima di accettare la timbratura.
- **Verifica presenza QR**: `PunchPresenceVerificationModal` — scansione QR dinamico per verificare che il dipendente sia fisicamente presente. Token QR ruotante (`qrPresence.ts`).
- **Reminder uscita**: Edge Function cron `punch-exit-reminder-cron` manda push ai dipendenti che non hanno timbrato l'uscita.
- **Toggle automatico**: se esiste una timbratura `in` aperta, `addPunchRecord(type:'out')` la chiude (`toggledToExit: true`).
- **Fonti timbratura**: `kiosk` (terminale) | `manual` (inserimento da presenze) | `manager` (per conto di).
- **Feedback audio/haptic**: `unlockAudioContext()` + feedback tattile su iOS nel Kiosk.
- **Background sync**: `registerOsteriaBackgroundSync()` — accoda timbrature offline via Service Worker Background Sync API.

### Mappa delle Funzioni

| Funzione | File | Parametri |
|---|---|---|
| `addPunchRecord(userId, type, options)` | `AppContext.tsx` | `timestamp?`, `shift_id?`, `presenceProof?`, `source?` |
| `isUserInRestaurantRange(coords, geofenceConfig)` | `src/utils/geo.ts` | coords GPS + centro/raggio geofence |
| `getCurrentPositionCoords()` | `src/utils/geofencePunch.ts` | wrapper `navigator.geolocation.getCurrentPosition` |
| `resolveEffectiveGeofenceConfig(local, env)` | `src/utils/geofencePunch.ts` | merge config locale + variabili env |
| `resolveEffectiveVerificationToken(config)` | `src/utils/presenceVerificationPayload.ts` | token QR corrente (rotante per periodo) |
| `verifyPresenceProofScanned(proof, config)` | `src/utils/presenceProofVerification.ts` | valida token QR scansionato |
| `saveGeofenceConfig(config)` | `AppContext.tsx` | upload `geofence.json` su Storage |
| `savePresenceVerificationConfig(config)` | `AppContext.tsx` | upload `presence_verification.json` su Storage |
| `registerOsteriaBackgroundSync()` | `src/utils/backgroundSync.ts` | registra sync tag nel Service Worker |

### Data Flow

```
Dipendente → Kiosk PIN / App punch button
  → addPunchRecord(userId, 'in'|'out', { source, presenceProof })
  ├─ [geofence] getCurrentPositionCoords() → isUserInRestaurantRange()
  ├─ [QR] verifyPresenceProofScanned(proof, config)
  → database.addPunchRecord() → Supabase INSERT punch_records
  → AppContext aggiorna punchRecords[]
  → [cron] punch-exit-reminder-cron (ogni ora) → push reminder
```

---

## 6. Modulo Ferie & Permessi

### Core Features

- **Richiesta ferie** (`HolidayRequests` + `RequestHolidayModal`): dipendenti con `can_request_holidays` possono richiedere assenze. Manager/Admin approvano o rifiutano.
- **Tipi richiesta**: `ferie` (ferie annuali) | `permesso` (permesso breve) | `indisponibilita` (segnalazione indisponibilità).
- **Stati**: `pending` → `approved` | `rejected`.
- **Disponibilità toggle** (`toggleAvailability`): segna rapidamente un giorno come indisponibile senza flusso di approvazione.
- **Notifica email**: `send-holiday-notification` Edge Function — invia email multilingua (IT/EN/ES) via **Resend API** al dipendente quando la richiesta viene approvata/rifiutata.
- **Integrazione push**: `addHolidayRequest()` invia push notification al team management.
- **Visibilità turni**: richieste ferie appaiono nel tabellone turni come blocker per quel dipendente.

### Mappa delle Funzioni

| Funzione | File | Parametri |
|---|---|---|
| `addHolidayRequest(request)` | `AppContext.tsx` | `Omit<HolidayRequest, 'id'|'created_at'|'status'>` → `{ ok, emailSent?, error? }` |
| `updateHolidayStatus(id, status)` | `AppContext.tsx` | `'approved'` | `'rejected'` → chiama Edge Function email |
| `deleteHolidayRequest(id)` | `AppContext.tsx` | elimina richiesta → `boolean` |
| `toggleAvailability(userId, date)` | `AppContext.tsx` | crea/elimina voce `indisponibilita` per la data |

### Data Flow

```
Staff → RequestHolidayModal → addHolidayRequest()
  → Supabase INSERT holiday_requests
  → send-push-notification (push al management)
  ← Manager → updateHolidayStatus(id, 'approved'|'rejected')
  → Supabase UPDATE holiday_requests
  → send-holiday-notification Edge Function → Resend API → email al dipendente
```

---

## 7. Modulo Statistiche & Report

### Core Features

- **Statistics** (`src/components/Statistics.tsx`): sub-tab della scheda Presenze per ruoli gestionali.
- Grafici: distribuzione ore per dipendente, turni per periodo, costo stimato (basato su `hourly_rate_eur`).
- **Esportazione PDF tabellone** (`exportSchedulePDF`): genera PDF planning settimanale con tutti i turni.
- **Esportazione PDF presenze** (`exportTimesheetPdf`, `timesheetPdfFromRange`): PDF mensile / per range.
- **Esportazione PDF personale** (`exportPersonalPDF`): PDF individuale per dipendente.
- **Esportazione dati** (`exportData.ts`): JSON / CSV di turni, presenze, ferie.
- **Importazione dati** (`importData.ts`): caricamento bulk da JSON.
- **Paghe** (`payrollSchedule.ts`): calcolo tabella paghe con stima costi per ciclo.

### Mappa delle Funzioni

| Funzione | File | Output |
|---|---|---|
| `computeStats(shifts, records, users)` | `src/utils/stats.ts` | aggregati ore, turni, costi per periodo |
| `exportSchedulePDF(opts)` | `src/utils/exportSchedulePDF.ts` | PDF tabellone settimanale (jsPDF) |
| `exportTimesheetPdf(opts)` | `src/utils/exportTimesheetPdf.ts` | PDF presenze mensile |
| `timesheetPdfFromRange(opts)` | `src/utils/timesheetPdfFromRange.ts` | PDF presenze range date |
| `exportPersonalPDF(user, shifts, records)` | `src/utils/exportPersonalPDF.ts` | PDF scheda individuale |
| `exportData(...)` | `src/utils/exportData.ts` | JSON/CSV dati operativi |
| `importData(file)` | `src/utils/importData.ts` | parsing e inserimento bulk |

---

## 8. Modulo Notifiche & Messaggi

### Core Features

- **NotificationCenter** (`src/components/NotificationCenter.tsx`): hub notifiche in-app (bell icon).
- **NotificationDropdown**: dropdown rapido con conteggio badge non letti.
- **UnifiedBellButton**: bottone bell unificato con badge count non letti.
- **Push Notification Web**: le notifiche push sfruttano le Web Push API (VAPID) tramite l'Edge Function `send-push-notification`.
- **Messaggi diretti** (`DirectMessagesPanel` + `MessageComposer` + `MessagesList` + `MessageWriter`): sistema di messaggistica interna tra staff e management.
- **Tipi messaggio**: `private` (1:1), `targeted` (multi-destinatario specifico), broadcast (tutti tranne mittente).
- **Badge launcher icona**: `setAppLauncherBadgeUnreadCountAsync()` — aggiorna badge icona PWA su sistemi che supportano `navigator.setAppBadge`.
- **Notifiche turno**: DB Webhook → `shift-change-webhook` → push al dipendente per turni aggiunti, modificati, eliminati.
- **Notifica turni prossima settimana**: `notify-team-next-week-shifts` — schedulata, avvisa tutto il team dei turni settimana successiva.
- **Reminder uscita**: `punch-exit-reminder-cron` — cron che individua timbrature aperte e manda push.
- **Gestione subscription push**: `push-subscription` Edge Function — registra/aggiorna/cancella subscription browser in `push_subscriptions`.
- **Conteggio non letti**: `countUnreadNotifications(userId, messages)` — usato per badge.
- **Force reload push**: `sendForceReloadPush()` — admin invia segnale Realtime per forzare ricarica dati su tutti i client.
- **AdminSyncOverlay**: overlay mostrato ai non-admin quando ricevono il segnale `FORCE_DATA_RELOAD` dal Service Worker.

### Mappa delle Funzioni

| Funzione | File | Logica |
|---|---|---|
| `countUnreadNotifications(userId, msgs)` | `src/utils/notifications.ts` | conta messaggi non letti per userId |
| `setAppLauncherBadgeUnreadCountAsync(n)` | `src/utils/appIconBadge.ts` | `navigator.setAppBadge(n)` o clearAppBadge |
| `sendForceReloadPush()` | `src/utils/sendForceReloadPush.ts` | invia segnale Realtime a tutti i client |
| `bumpClientSyncRevisionOnSupabase()` | `src/utils/clientSyncRevision.ts` | incrementa revisione globale su DB |

### Endpoint Edge Functions (Notifiche)

| Funzione Supabase | Trigger | Destinatari |
|---|---|---|
| `send-push-notification` | POST da client o altre Edge Functions | `private` / `targeted` / broadcast |
| `push-subscription` | POST da browser (registrazione/aggiornamento) | Tabella `push_subscriptions` |
| `shift-change-webhook` | DB Webhook su tabella `shifts` | Dipendente interessato dal turno |
| `notify-team-next-week-shifts` | Cron schedulato | Tutto il team |
| `punch-exit-reminder-cron` | Cron orario | Dipendenti con punch-in aperto |
| `send-holiday-notification` | Chiamata da `updateHolidayStatus` | Dipendente richiedente (email Resend) |

---

## 9. Modulo Impostazioni & Feature Flags

### Core Features

- **SettingsPage** (scheda `settings`): hub impostazioni per management; reindirizza a `/admin` per Admin.
- **SettingsHub** (`src/components/SettingsHub.tsx`): menu raggruppato di sezioni impostazioni.
- **ImpostazioniPage** (`src/components/ImpostazioniPage.tsx`): pagina impostazioni generali (lingua, tema, suoni, ecc.).
- **Feature Flags**: toggle on/off funzionalità a livello tenant, persistiti su `localStorage` + Supabase Storage (`app-config/features.json`).
- **Work Rules** (`workRules.ts`): ore massime giornaliere/settimanali, riposo minimo, soglia ritardo.
- **Break Rules** (`breakRules.ts`): regole pause automatiche (es. turni > 6h → 30 min pausa).
- **Lingua UI**: `it` | `en` | `es` | `fr` — rilevata da browser (`languageDetection.ts`) o impostata manualmente.
- **Tema**: `light` | `dark` — salvato in `localStorage` + campo `theme` su `users`.
- **Layout Preset** (`LayoutPresetContext`): preset layout UI selezionabile.
- **SoundSettings** (`src/components/SoundSettings.tsx`): abilitazione suoni feedback in-app.
- **Profile Visibility Hub** (`ProfileVisibilityHub`): controllo granulare visibilità sezioni profilo.
- **UI Section Overrides** (`uiScreenWidgets.ts`): per ogni utente, override visibilità widget specifici (`ui_section_overrides` JSONB).
- **Periodo Timesheet**: data inizio/fine ciclo paghe configurabile.
- **Geofence Admin**: lat/lng/raggio configurabile da UI Admin per vincolo timbratura GPS.
- **QR Presence**: token verifica presenza — segreto/periodo rotazione configurabili.
- **Global Settings Cloud**: `globalSettingsCloud.ts` — bundle unico con tutte le impostazioni, sincronizzato su Supabase Storage e distribuito via Realtime.

### Feature Flags Disponibili

| Slug | Default | Descrizione |
|---|---|---|
| `maintenance_mode` | `false` | Blocca accesso a tutti tranne admin (⚠️ pericoloso) |
| `unlock_with_pin` | `true` | Abilita sblocco operazioni con PIN |
| `auto_breaks` | `true` | Calcolo automatico pause basato su break rules |
| `staff_requests` | `true` | Staff può richiedere ferie/permessi |
| `kiosk_active` | `true` | Terminale kiosk timbratura attivo |
| `geofence_punch` | `false` | Vincolo GPS per timbratura |
| `visibility_management` | `true` | Gestione visibilità profili nel planning |
| `department_creation` | `true` | Creazione reparti personalizzati |
| `violation_rules` | `true` | Rilevamento violazioni regole lavoro |
| `master_control_panel` | `true` | Pannello controllo master Admin |

### Mappa delle Funzioni

| Funzione | File | Logica |
|---|---|---|
| `setFeatureFlag(name, enabled)` | `AppContext.tsx` | salva local + upload Storage + bump sync signal |
| `loadFeatureFlagsFromSupabase()` | `src/utils/featureFlags.ts` | GET `app-config/features.json` da Storage |
| `updateFeatureFlagInSupabase(slug, val)` | `src/utils/featureFlags.ts` | aggiorna solo il flag specifico su Storage |
| `getWorkRules()` / `saveWorkRules()` | `src/utils/workRules.ts` | localStorage + Supabase sync |
| `getBreakRules()` / `saveBreakRulesToSupabase()` | `src/utils/breakRules.ts` | regole pause per fasce orarie |
| `pushSettingsToCloud()` | `AppContext.tsx` | `buildGlobalSettingsBundleFromParts()` → upload Storage → bump Realtime |
| `pullGlobalSettingsBundleOnAppBoot()` | `src/utils/globalSettingsCloud.ts` | boot: scarica bundle da Storage e applica localmente |

---

## 10. Modulo Multi-Tenant

### Core Features

- Ogni **tenant** è un ristorante/sede separata con dati completamente isolati.
- `TenantContext` carica il tenant al boot dell'app basandosi sul `tenant_id` dell'utente autenticato.
- Tutte le query DB passano attraverso `withTenant(query)` che aggiunge il filtro `tenant_id`.
- `setDatabaseTenant(tenantId)` è chiamato da `TenantProvider` appena il tenant è risolto.
- **Impostazioni tenant** (`TenantSettings`): font intestazione, timezone IANA, lingua default, feature flags, work rules, geofence, moduli attivi.
- **Slug** univoco per inviti (`/i/:slug` → `InviteRedirect`).
- **Storage isolato**: ogni tenant ha file su percorsi separati nel bucket `app-config`.
- **Script seed** (`seedTenantFromTemplate.ts`): crea dati iniziali per un nuovo tenant.

### Entità `Tenant`

```typescript
interface Tenant {
  id: string;
  slug: string;
  name: string;
  accent_color: string;
  logo_url?: string | null;
  plan?: string;
  is_active: boolean;
  settings: TenantSettings;  // JSONB: font, timezone, featureFlags, workRules, geofence, modules
  created_at: string;
  updated_at: string;
}
```

### Mappa delle Funzioni

| Funzione | File | Logica |
|---|---|---|
| `setDatabaseTenant(tenantId)` | `src/lib/database.ts` | imposta `_tenantId` globale |
| `withTenant(query)` | `src/lib/database.ts` | aggiunge `.eq('tenant_id', _tenantId)` |
| `withTenantPayload(payload)` | `src/lib/database.ts` | inietta `tenant_id` nei payload insert |
| `seedTenantFromTemplate(tenantId)` | `src/utils/seedTenantFromTemplate.ts` | popola utenti/turni/impostazioni demo |

---

## 11. Modulo Pannello Admin

### Core Features

- **AdminLayout** (`src/components/AdminLayout.tsx`): layout con sidebar per rotte `/admin/*`.
- **AdminGate** (`src/components/AdminGate.tsx`): guard che verifica ruolo admin/manager/assistant_manager.
- **AdminPanel** (`src/components/AdminPanel.tsx`): pannello principale con sezioni configurabili.
- **GestioneProfiliPage** (`src/components/GestioneProfiliPage.tsx`): gestione anagrafica dipendenti.
- **CreateStaffModal** / **EditStaffModal**: modali creazione/modifica dipendente.
- **StaffOperationalPermissionsEditor**: editor granulare permessi operativi per singolo utente.
- **RoleFeatureTemplatesPage**: editor template permessi/moduli per ruolo.
- **ElevatedAccessPanel**: pannello per gestione accesso elevato (secondary_pin + elevated_role).
- **Backup & Restore**: export JSON completo dati / import per ripristino.
- **Ordine dipendenti**: `reorderUsers(userId, 'up'|'down')` / `setUsersSortOrder(ids[])`.
- **Gestione reparti**: creazione reparti custom con colori ed etichette; sincronizzati via `departments.json` su Storage.
- **Moduli globali admin** (`adminModulesGlobal.ts`): abilita/disabilita intere sezioni dell'app per tutti.

### Mappa delle Funzioni

| Funzione | File | Logica |
|---|---|---|
| `createUser(payload)` | `AppContext.tsx` | INSERT utente + defaults permessi ruolo |
| `updateUser(id, updates)` | `AppContext.tsx` | PATCH + sanificazione payload JSONB |
| `deleteUser(id)` | `AppContext.tsx` | soft delete / hard delete con check admin unico |
| `reorderUsers(userId, dir)` | `AppContext.tsx` | swap `sort_order` con vicino |
| `setUsersSortOrder(ids[])` | `AppContext.tsx` | applica ordine personalizzato |
| `wouldLeaveNoActiveAdmin(users, targetId)` | `src/utils/permissions.ts` | previene eliminazione ultimo admin attivo |
| `countActiveAdmins(users)` | `src/utils/permissions.ts` | conta admin attivi nel tenant |
| `saveRoleFeatureTemplates(data)` | `AppContext.tsx` | salva template su Storage + bump sync |
| `saveAdminModulesGlobal(data)` | `AppContext.tsx` | salva moduli globali su Storage + bump sync |
| `notifyDepartmentsChanged()` | `AppContext.tsx` | upload `departments.json` + bump revisione |
| `pushSettingsToCloud()` | `AppContext.tsx` | bundle completo → Storage → Realtime signal |

---

## 12. Modulo SuperAdmin

### Core Features

- **SuperAdminPanel** (`src/components/SuperAdminPanel.tsx`): pannello completamente isolato, accessibile solo da hostname contenente `super-admin`.
- Non usa `AppProvider` né `TenantContext` — ha il proprio accesso diretto Supabase con service role.
- Funzionalità: gestione tenant (lista, creazione, disattivazione), monitoraggio globale, seed dati.
- Protetto da: rilevamento hostname `window.location.hostname.includes('super-admin')`.

---

## 13. Modulo PWA & Service Worker

### Core Features

- **PWA Gate** (`PwaGate`): in produzione, blocca l'accesso da browser non-standalone e mostra `PWAInstallRequired`.
- **Manifest** (`public/manifest.json`): icone, theme_color, display standalone, start_url.
- **Service Worker** generato da `vite-plugin-pwa`: cache first per asset statici, network first per API.
- **Aggiornamento SW**: `SwUpdateOverlay` — quando rilevato nuovo deploy, overlay forza ricarica.
- **Background Sync**: `backgroundSync.ts` — accoda timbrature offline; il SW le ritenta quando torna connessione.
- **Messaggi SW → App**: il SW invia messaggi (`OPEN_PUNCH_EXIT`, `OPEN_TURNI`, `FORCE_DATA_RELOAD`) che l'app ascolta per navigare a tab specifiche.
- **Badge icona**: `navigator.setAppBadge` per notifiche non lette sull'icona launcher.
- **Pull-to-refresh**: `BodyPullToRefresh` (`pulltorefreshjs`) — trascinamento verso il basso aggiorna i dati.
- **Banner Safari iOS**: `IosSafariInstallBanner` — suggerisce "Aggiungi a Home" su Safari non-standalone.
- **Generazione icone**: `scripts/generate-pwa-icons.mjs` / `scripts/generate-tenant-favicon.mjs`.
- **isPWAStandalone()** (`src/utils/pwaStandalone.ts`): rileva se l'app è in modalità standalone.

---

## 14. Supabase Edge Functions

Tutte le Edge Functions sono Deno (TypeScript), deployate su `supabase/functions/`.

### `send-push-notification`

**Trigger**: POST da client o da altre Edge Functions  
**Input**: `{ message_id, sender_id, recipient_id?, recipient_ids?, message_type, subject, body, type, push_title?, url? }`  
**Logica**:
1. Recupera nome e avatar del mittente da `users`.
2. Query `push_subscriptions` in base a `message_type` (`private` / `targeted` / broadcast).
3. Invia notifica via `web-push` (VAPID) a ciascuna subscription.
4. Rimuove subscription con status 410/404 (scadute).
5. Restituisce `{ sent, total }`.

**Variabili env**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

### `push-subscription`

**Trigger**: POST dal browser alla registrazione/aggiornamento PWA  
**Input**: subscription Web Push (endpoint, p256dh, auth)  
**Logica**: UPSERT in `push_subscriptions` per `user_id`.

---

### `shift-change-webhook`

**Trigger**: Database Webhook Supabase su tabella `shifts` (INSERT / UPDATE / DELETE)  
**Input**: payload webhook `{ type, record, old_record }`  
**Logica**:
- `DELETE` → push "Il tuo turno del GG/MM/YYYY è stato annullato"
- `INSERT` → push "Nuovo turno il GG/MM: HH:mm-HH:mm" (skip se `draft`)
- `UPDATE` → push "Turno modificato" se cambiano data/orari/stato da draft a confirmed

**Variabili env**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

### `punch-exit-reminder-cron`

**Trigger**: Cron schedulato (ogni ora)  
**Autorizzazione**: `Bearer CRON_SECRET` o `Bearer SUPABASE_SERVICE_ROLE_KEY`  
**Logica**:
1. `supabase.rpc('get_stale_open_punch_for_reminder')` — trova punch-in senza punch-out da > X ore.
2. Per ogni risultato: chiama `send-push-notification` con `type: 'punch_exit_reminder'`.
3. Log in `punch_exit_reminder_log` per evitare spam.

---

### `notify-team-next-week-shifts`

**Trigger**: Cron schedulato (es. venerdì o domenica)  
**Logica**: aggrega turni della settimana successiva e manda push broadcast al team.

---

### `send-holiday-notification`

**Trigger**: chiamata da client (`updateHolidayStatus`)  
**Input**: `{ email, nome, start_date, end_date, status, language? }`  
**Logica**: costruisce email HTML multilingua (IT/EN/ES) e la invia via **Resend API** (`FROM: info@osteriabasilico.co.uk`).

**Variabili env**: `RESEND_API_KEY`

---

## 15. Data Flow Globale

### Boot dell'applicazione

```
1. main.tsx → BrowserRouter → App
2. AppProvider.loadInitialData()
   a. Legge sessione da localStorage (APP_SESSION_STORAGE_KEY)
   b. Carica utente corrente
   c. pullGlobalSettingsBundleOnAppBoot() → Storage app-config/bundle.json
   d. loadFeatureFlagsFromSupabase() → Storage app-config/features.json
   e. database.getUsers() / getShifts() / getHolidayRequests() / getPunchRecords()
   f. loadWorkRulesFromSupabase(), loadBreakRulesFromSupabase()
   g. loadGeofenceConfigFromSupabase(), loadPresenceVerificationFromSupabase()
   h. loadDepartmentsFromSupabase()
   i. TenantContext: carica tenant dal DB
3. AppContext.isLoading = false → UI si sblocca
4. ProtectedApp: verifica currentUser → MainApp o redirect login
```

### Sincronizzazione dati

```
silentRefreshData({ pullRemoteConfig? })
  → database.getUsers() / getShifts() / getPunchRecords() / getHolidayRequests()
  → [se pullRemoteConfig] fetchClientSyncRevisionFromSupabase()
  → [se revisione avanzata] forceGlobalRefresh() con overlay
  → writeAckClientSyncRevision() dopo sync completato
```

### Push Settings (Admin → tutti i client)

```
Admin modifica impostazione
  → saveXxx() locale + Supabase Storage
  → bumpAppSettingsSyncSignal() → Realtime signal
  → tutti i client online: silentRefreshData({ pullRemoteConfig: true })
  → AdminSyncOverlay sui client non-admin
```

---

## 16. Mappa dei Ruoli e Permessi

### Ruoli disponibili

| Ruolo | Tipo | Descrizione |
|---|---|---|
| `admin` | Gestionale | Accesso totale; non compare nel planning operativo |
| `manager` | Gestionale | Gestione turni, presenze, ferie; no impostazioni critiche |
| `assistant_manager` | Gestionale | Come manager con permessi ridotti |
| `waiter` | Operativo | Cameriere sala |
| `server` | Operativo | Servizio |
| `bartender` | Operativo | Bar |
| `cook` | Operativo | Cucina |
| `chef` | Operativo | Chef |
| `dishwasher` | Operativo | Lavanderia |

### Matrice Permessi Principali

| Capacità | Admin | Manager | Ass.Manager | Staff |
|---|---|---|---|---|
| Modifica turni team | ✅ | ✅ | ✅ | `can_create_shifts` |
| Approva/congela turni | ✅ | `can_approve_shifts` | `can_approve_shifts` | ❌ |
| Pubblica settimana draft | ✅ | ✅ | ✅ | ❌ |
| Modifica impostazioni app | ✅ | ❌ | ❌ | ❌ |
| Elimina dipendenti | ✅ | ❌ | ❌ | ❌ |
| Vede utenti sospesi | ✅ | ❌ | ❌ | ❌ |
| Template permessi ruolo | ✅ | ❌ | ❌ | ❌ |
| Timbratura per altri | ✅ | ✅ | ✅ | ❌ |
| Richiesta ferie | ✅ | ✅ | ✅ | `can_request_holidays` |
| Timbratura da app | ✅ | ✅ | ✅ | `can_punch_from_app` |
| Vede ore totali team | ✅ | ✅ | ✅ | `can_view_total_hours` |
| Modifica PIN staff | ✅ | `can_edit_staff_pins` | `can_edit_staff_pins` | ❌ |
| Gestione bozze | ✅ | `can_manage_drafts` | `can_manage_drafts` | ❌ |

### Funzioni di controllo accesso (`src/utils/permissions.ts`)

| Funzione | Logica |
|---|---|
| `isManagementRole(role)` | `admin` \| `manager` \| `assistant_manager` |
| `isAdminOnly(user)` | solo `admin` |
| `canOperateTeamSchedule(user)` | management o `can_create_shifts` |
| `canEditTeamShifts(user)` | management o `can_create_shifts` |
| `canApproveShiftActions(user)` | admin o `can_approve_shifts` |
| `canPublishScheduleDrafts(user)` | management |
| `canViewSuspended(user)` | solo admin |
| `canEditRoleFeatureTemplates(user)` | solo admin |
| `wouldLeaveNoActiveAdmin(users, id)` | previene rimozione ultimo admin |
| `isUserVisibleOnTeamSchedule(user)` | rispetta `hide_from_team_schedule` e `team_schedule_visible` |

---

## 17. Schema Database (Entità Principali)

### Tabelle principali (Supabase/PostgreSQL)

#### `tenants`
| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text unique | per link inviti `/i/:slug` |
| `name` | text | nome sede |
| `accent_color` | text | colore brand |
| `logo_url` | text nullable | |
| `plan` | text | piano abbonamento |
| `is_active` | boolean | |
| `settings` | jsonb | `TenantSettings` (font, timezone, featureFlags, workRules, geofence, modules) |

#### `users`
| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK → tenants | |
| `first_name`, `last_name` | text | |
| `email` | text | |
| `phone` | text nullable | |
| `role` | text | `UserRole` enum |
| `pin` | text | PIN 4 cifre |
| `status` | text | `active` \| `suspended` \| `inactive` |
| `sort_order` | integer | ordine visualizzazione |
| `language` | text | `it\|en\|es\|fr` |
| `theme` | text | `light\|dark` |
| `can_create_shifts` | boolean | |
| `can_approve_shifts` | boolean | |
| `can_view_total_hours` | boolean | |
| `can_edit_staff_pins` | boolean | |
| `can_manage_drafts` | boolean | |
| `can_request_holidays` | boolean | |
| `can_punch_from_app` | boolean | |
| `monthly_confirmed` | jsonb | `{ "YYYY-MM": { minutes, shiftsCount } }` |
| `hourly_rate_eur` | numeric nullable | tariffa oraria per stime costo |
| `department` | text nullable | reparto |
| `enabled_modules` | text[] | moduli abilitati profilo |
| `enabled_features` | jsonb | feature flags individuali |
| `ui_section_overrides` | jsonb | override visibilità widget UI |
| `hide_from_team_schedule` | boolean | nasconde da planning collettivo |
| `team_schedule_visible` | boolean | visibilità planning |
| `avatar_url` | text nullable | foto profilo |
| `employment_start_date` | date nullable | |
| `employment_end_date` | date nullable | |
| `secondary_pin` | text nullable | PIN elevazione sessione |
| `elevated_role` | text nullable | ruolo concesso da secondary_pin |

#### `shifts`
| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | |
| `user_id` | uuid FK → users | |
| `date` | date | |
| `start_time` | time | pianificato |
| `end_time` | time | pianificato |
| `type` | text | `lunch\|dinner` |
| `approval_status` | text | `draft\|confirmed\|approved\|absent` |
| `notes` | text nullable | note pubbliche |
| `admin_note` | text nullable | note interne |
| `deduct_break` | boolean | |
| `break_minutes` | integer nullable | minuti pausa |
| `is_auto_break` | boolean | pausa calcolata automaticamente |
| `department` | text nullable | |
| `skills` | text nullable | competenze richieste |
| `approved_at` | timestamptz nullable | timestamp congelo |
| `approved_by` | text nullable | nome manager che ha approvato |
| `approved_start_time` | time nullable | orario congelato |
| `approved_end_time` | time nullable | orario congelato |

#### `punch_records`
| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | |
| `user_id` | uuid FK → users | |
| `shift_id` | uuid FK nullable → shifts | |
| `timestamp` | timestamptz | momento timbratura |
| `calculated_time` | time nullable | orario effettivo calcolato |
| `clock_out_time` | time nullable | uscita manuale |
| `type` | text | `in\|out` |
| `source` | text | `kiosk\|manual\|manager` |

#### `holiday_requests`
| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | |
| `user_id` | uuid FK → users | |
| `start_date`, `end_date` | date | |
| `type` | text | `ferie\|permesso\|indisponibilita` |
| `status` | text | `pending\|approved\|rejected` |
| `created_at` | timestamptz | |
| `reason` | text nullable | motivazione |
| `requester_email` | text nullable | per notifica email |

#### `punch_audit_log`
| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | |
| `punch_record_id` | uuid FK | |
| `actor_id` | uuid nullable | chi ha modificato |
| `actor_name` | text | |
| `field` | text | `timestamp\|calculated_time\|clock_out_time` |
| `old_value`, `new_value` | text nullable | |
| `changed_at` | timestamptz | |

#### `push_subscriptions`
| Colonna | Tipo | Note |
|---|---|---|
| `user_id` | uuid FK | |
| `endpoint` | text | URL subscription Web Push |
| `p256dh` | text | chiave crittografica |
| `auth_key` | text | auth secret |

#### Tabelle aggiuntive
- `punch_exit_reminder_log` — log reminder uscita per evitare duplicati
- `messages` — messaggi interni (diretti e broadcast)
- Tabelle migrazioni (`supabase/migrations/*.sql`): 85 file, include schema completo + RLS policies

### Supabase Storage Buckets

| Bucket | Contenuto |
|---|---|
| `app-config` | `features.json`, `work-rules.json`, `break-rules.json`, `geofence.json`, `presence_verification.json`, `departments.json`, `role-feature-templates.json`, `admin-modules-global.json`, `timesheet-period.json`, `bundle.json` |
| `avatars` (o simile) | Foto profilo utenti |

---

## 18. Relazioni tra Moduli

```
┌─────────────────────────────────────────────────────────────────┐
│                        AppContext                                │
│  (users, shifts, punchRecords, holidays, featureFlags,           │
│   workRules, breakRules, geofenceConfig, presenceConfig,         │
│   departments, currentUser, effectiveLanguage)                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ fornisce stato a tutti i moduli
         ┌──────────────────┼──────────────────────────┐
         │                  │                          │
    ┌────▼─────┐     ┌──────▼──────┐          ┌───────▼──────┐
    │  Turni   │     │  Presenze   │          │  Timbratura  │
    │(Shifts)  │────▶│(Timesheets) │◀─────────│  (Punch)     │
    └────┬─────┘     └──────┬──────┘          └───────┬──────┘
         │                  │                          │
    ┌────▼─────┐     ┌──────▼──────┐          ┌───────▼──────┐
    │  Ferie   │     │Statistiche  │          │  Notifiche   │
    │(Holidays)│     │ & Report    │          │  & Messaggi  │
    └──────────┘     └─────────────┘          └──────────────┘
         │                                              │
    ┌────▼─────────────────────────────────────────┐   │
    │            Impostazioni & Feature Flags       │   │
    │   (workRules, breakRules, featureFlags,       │   │
    │    geofence, presenceVerif, departments)      │   │
    └───────────────────────────────────────────────┘   │
                                                         │
    ┌────────────────────────────────────────────────────▼──┐
    │              Supabase Edge Functions                    │
    │  send-push-notification / push-subscription /          │
    │  shift-change-webhook / punch-exit-reminder-cron /     │
    │  notify-team-next-week-shifts / send-holiday-notif     │
    └────────────────────────────────────────────────────────┘
                            │
    ┌───────────────────────▼────────────────────────────────┐
    │                   Supabase Backend                      │
    │  PostgreSQL (users, shifts, punch_records,              │
    │   holiday_requests, punch_audit_log, push_subscriptions)│
    │  Storage (app-config/*, avatars/*)                      │
    │  Auth (JWT sessions)                                    │
    │  Realtime (sync signal su clientSyncRevision)           │
    └────────────────────────────────────────────────────────┘
```

### Dipendenze chiave per modulo

| Modulo | Dipende da | Alimenta |
|---|---|---|
| **Autenticazione** | `supabase`, `localStorage`, WebAuthn | Tutti (currentUser) |
| **Turni** | `AppContext.shifts/users/featureFlags/workRules/breakRules` | Presenze, Statistiche, Notifiche |
| **Presenze** | `AppContext.punchRecords/shifts/users` | Statistiche, PDF Export |
| **Timbratura** | `AppContext.punchRecords`, Geofence, QR, GPS | Presenze |
| **Ferie** | `AppContext.holidays/users`, Resend API | Turni (blocker), Notifiche |
| **Statistiche** | Turni, Presenze, `hourly_rate_eur` | PDF Export |
| **Notifiche** | `push_subscriptions`, Edge Functions, Realtime | App Badge, SW |
| **Impostazioni** | Supabase Storage, `localStorage` | Tutti i moduli (feature flags) |
| **Multi-Tenant** | `tenants` table, `tenant_id` su ogni entità | Database layer |
| **Admin** | `AppContext` (tutti i dati), permessi admin | Tutti i moduli |
| **PWA/SW** | `vite-plugin-pwa`, manifest, Background Sync | Timbratura offline, Push |

---

*Documentazione generata il 17 Aprile 2026 — versione app 1.0.0*
