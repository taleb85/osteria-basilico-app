# Osteria Basilico — Documentazione Tecnica delle Funzionalità

Documento tecnico dettagliato delle funzionalità attive nel sito Osteria Basilico, basato sulla logica attuale del codice.

---

## 1. ARCHITETTURA DEI RUOLI E SICUREZZA

### 1.1 Pannello `/admin` e tab Impostazioni nell'app

- **Protezione**: `AdminGate` (`src/components/AdminGate.tsx`) — accesso a `/admin` per tutti i ruoli gestionali (`admin`, `proprietario`, `manager`, `assistant_manager`).
- **Tab "Impostazioni" globale** (feature flags in DB): visibile **solo ad Admin** (`ImpostazioniPage` in `AdminLayout`).
- **Redirect da tab Settings**: solo **Admin** viene portato su `/admin` al tap su Impostazioni; Proprietario e Manager usano la scheda Impostazioni in-app come gli altri manager (`App.tsx` — `isAdminOnly`).

### 1.2 Esclusione solo Admin da reparti, tabellone e PDF

Solo **Admin** è considerato profilo puramente gestionale (senza riga operativa):

- **Ruoli esclusi**: `PURELY_MANAGEMENT_ROLES = ['admin']` (`src/utils/permissions.ts`)
- **Proprietario** è allineato al **Manager**: compare nel tabellone, presenze, PDF e kiosk come gli altri ruoli gestionali operativi.

**Effetti dell'esclusione** (solo per `admin`):

| Contesto | Implementazione | Effetto |
|----------|------------------|---------|
| **Tabellone turni** | `WeeklyShiftsTable` — esclude `isPurelyManagementRole` | Solo Admin non compare nelle righe |
| **Presenze (Timesheets)** | filtro `!isPurelyManagementRole` | Idem |
| **PDF / Kiosk** | stesso criterio | Idem |

### 1.3 Ruoli operativi e dipendenza dagli switch

**Ruoli operativi** (con funzioni dipendenti da `enabled_features`):

| Ruolo | Tipo | Descrizione |
|-------|------|-------------|
| `proprietario` | Gestionale | Stessi default permessi e moduli del Manager (`enabledFeatures`); non è più trattato come Admin |
| `manager` | Manager | Gestione turni, approvazioni, Ore — permessi configurabili |
| `assistant_manager` | Manager | Stessi permessi del Manager — configurabili |
| `waiter`, `server`, `bartender`, `cook`, `chef`, `dishwasher` | Staff | Ruoli operativi — permessi solo tramite `enabled_features` |

**Routing per ruolo** (`src/App.tsx`):

- `MANAGEMENT_ROLES = ['admin', 'proprietario', 'manager', 'assistant_manager']` → Dashboard completa (`AdminApp`)
- Ruoli Staff → `StaffPersonalDashboard` (vista personale senza sidebar management)

---

## 2. MATRICE DEI PERMESSI (enabled_features)

### 2.1 Chiavi permessi (enabled_features JSONB)

| Chiave | Label | Descrizione |
|--------|-------|-------------|
| `team_view` | Visualizza Tabellone Team | Accesso alla scheda Turni |
| `edit_shifts` | Modifica Operativa Turni | Creazione/modifica turni in bozza |
| `approve_shifts` | Approvazione Finale (Verde) | Pubblicazione e approvazione definitiva turni |
| `view_stats` | Visualizzazione Ore | Accesso alla scheda Ore |
| `export_pdf` | Esportazione Report PDF | Pulsante download PDF presenze (es. presenze_2026-03-16.pdf) |
| `desktop_access` | Accesso Browser Desktop (Bypass PWA) | Accesso da PC/browser senza PWA installata |

### 2.2 Default per ruolo

| Ruolo | team_view | edit_shifts | approve_shifts | export_pdf | view_stats | desktop_access |
|-------|-------|-------|-------|-------|-------|-------|
| admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| proprietario, manager, assistant_manager | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| staff | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

### 2.3 Fallback su colonne legacy

Se `enabled_features` non è presente o è vuoto, usa le colonne legacy:

- `edit_shifts` → `can_manage_drafts`
- `approve_shifts` → `can_approve_shifts`
- `view_stats` → `can_view_total_hours`
- `desktop_access` — chiave template deprecata per visibilità hub; **non** controlla più il gate PWA.

### 2.4 Impatto sulla visibilità

| Permesso | Componenti influenzati |
|----------|------------------------|
| `team_view` | Tab "Turni" in sidebar (`getVisibleManagementTabs`) |
| `edit_shifts` | `canManageDrafts` in `WeeklyShiftsTable` — modifica operativa turni |
| `approve_shifts` | `canApproveShifts` — approvazione finale (verde) |
| `view_stats` | Tab "Ore" |
| `export_pdf` | Pulsanti CSV/PDF in `Timesheets` (es. presenze_2026-03-16.pdf) |
| `desktop_access` | Deprecato in UI; il gate PWA non usa questa chiave (vedi §3). |

---

## 3. SISTEMA PWA E ACCESSO

### 3.1 Schermata di Installazione Forzata (PWA Guard)

**Componente**: `PwaGate` (`src/components/PwaGate.tsx`)

**Regole di accesso** (unica fonte: `PwaGate.tsx`):

1. **Standalone (PWA installata):** sempre permesso
2. **Dev / localhost / `VITE_ALLOW_BROWSER_APP=true`:** browser permesso (anteprima o deploy con eccezione)
3. **Non loggato:** permesso (login, kiosk timbratura)
4. **Loggato nel browser senza le condizioni sopra:** **schermata installazione PWA** (nessun bypass per utente)

### 3.2 Rilevamento Standalone

**File**: `src/utils/pwaStandalone.ts`

- **iOS**: `navigator.standalone === true`
- **Android/Chrome**: `window.matchMedia('(display-mode: standalone)').matches`
- **Desktop**: `!isIOS() && !isAndroid()` — non touch, non mobile

### 3.3 Schermata PWAInstallRequired

**Componente**: `PWAInstallRequired` (`src/components/PWAInstallRequired.tsx`)

- **Colore sfondo**: `#2D5A27` (verde Basilico)
- **Istruzioni dinamiche**:
  - **iOS**: `Share` → "Aggiungi a Home" (condividi)
  - **Android**: `MoreHorizontal` → "Installa App" (tre puntini)
- **Rilevamento**: `isIOS()`, `isAndroid()` da `pwaStandalone.ts`

### 3.4 Eccezioni globali (non per utente)

- **`VITE_ALLOW_BROWSER_APP`**: in build produzione, se `true`, il browser è ammesso per tutti gli utenti loggati (es. staging).
- **Sviluppo / preview locale**: sempre ammessi senza PWA.

---

## 4. GESTIONE TURNI E CALENDARIO

### 4.1 Stati turno e visualizzazione

| approval_status | Variante visiva | Stile | Descrizione |
|-----------------|-----------------|-------|-------------|
| `draft` | `planned` | `bg-white`, `border-2 border-dashed border-slate-300` | Bozza — bianco, bordo tratteggiato |
| `confirmed` | `inprogress` | `bg-white`, `border border-slate-200`, `border-b-2 border-slate-500` | Pubblicato — bianco, bordo grigio |
| `approved` | `approved` | `bg-accent` (#2D5A27), `text-white` | Approvato — verde pieno |

**Colore accent**: `#2D5A27` (verde Basilico) — usato per turni approvati e elementi UI principali.

### 4.2 Anomalie

**Tipi di anomalia**:

| Tipo | Condizione | Label | Colore |
|------|------------|-------|--------|
| **OUT mancante** | `punchIn && !actualEnd` | `ts_status_missing_out` | Rosso (`border-l-red-500`) |
| **Ritardo** | `actualStart > plannedStart + 5 min` e `|deltaMins| > 15` | `ts_status_late` | Rosso |
| **Cross-day** | `actualEnd` registrato in data diversa dal turno | "Orario uscita da correggere" | Amber |

**Rilevamento**: `hasMissingOut = !!(punchIn && !actualEnd)` in `Timesheets.tsx` e `HomePage.tsx`.

### 4.3 Calcolo ore nette

**Formula**: `Ore Nette = Lordo - Pause`

**Priorità pause** (`getBreakMinutesForShift`):

1. `shift.break_minutes` se valorizzato sul turno
2. Regole da `breakRules` (reparto, ruolo, giorno, finestra pausa)
3. Pausa automatica 30 min se turno > 6 ore e `deduct_break !== false`

**BreakRules**: regole configurabili per reparto, ruolo, giorni, finestra oraria (es. 12:00–14:00). Pause `paid: false` → detraggono; `paid: true` → non detraggono.

### 4.4 Violazioni turno (workRules)

**Tipi**: `long_shift`, `max_daily`, `max_weekly`, `min_rest`, `late`, `overlap`

- **Sovrapposizione**: due turni sovrapposti stesso dipendente stesso giorno
- **Riposo minore**: fine turno → inizio successivo < 11 ore
- **Ore giornaliere/settimanali oltre limite**: configurabili

---

## 5. KIOSK E PRESENZE

### 5.1 Funzionalità tablet

**Componente**: `PunchInKiosk` (`src/components/PunchInKiosk.tsx`)

- **Route**: `/kiosk` — accessibile senza login (redirect a `/app` se già loggato)
- **Feature flag**: `kiosk_active === false` → mostra `KioskOffPage` (terminale disattivato)

### 5.2 Timbratura IN/OUT

- **Timbratura IN**: arrotondamento a 5 minuti (`roundToNext5Minutes`) tramite `timeCalculations.ts`
- **Timbratura OUT**: solo turni pranzo — turni cena richiedono chiusura manuale dal Manager
- **Turni ammessi**: `approval_status === 'approved'` o `'confirmed'`

### 5.3 Sincronizzazione realtime

**Supabase Realtime** (`src/lib/database.ts`):

- `subscribeToPunchRecords` — canale `punch-records-changes` su tabella `punch_records`
- `subscribeToShifts` — canale `shifts-changes` su tabella `shifts`
- `subscribeToUsers` — canale `users-changes` su tabella `users`
- `subscribeToHolidaysAndAvailability` — canale `holidays-availability-changes`

**AppContext**: sottoscrive tutti i canali al mount; ogni modifica su Supabase aggiorna lo stato in tempo reale e si propaga a Dashboard, Kiosk e Staff.

---

## 6. INTERNAZIONALIZZAZIONE (i18n)

### 6.1 Rilevamento lingua

**File**: `src/utils/i18n.ts`

- **Ordine**: `localStorage` → `navigator` → `htmlTag`
- **Chiave localStorage**: `appLanguage`
- **Lingue supportate**: `it`, `en`, `es`, `fr`
- **Fallback**: `it`
- **Mappatura**: `convertDetectedLanguage` — `en`→`en`, `es`→`es`, `fr`→`fr`, `it`→`it`, altro→`it`

### 6.2 Persistenza nel profilo

**AppContext** (`setLanguage`):

```ts
localStorage.setItem(LANG_STORAGE_KEY, lang);
if (currentUser) {
  updateUser(currentUser.id, { language: lang });
  setCurrentUser({ ...currentUser, language: lang });
}
i18n.changeLanguage(lang);
```

- **Persistenza**: `language` salvato nel profilo utente su Supabase
- **Sincronizzazione**: cambio lingua aggiorna DB e stato locale

---

## 7. EXPORT E REPORTISTICA

### 7.1 Generatore PDF presenze

**File**: `src/components/Timesheets.tsx` — `handleExportPDF`

- **Libreria**: `jsPDF`
- **Formato**: A4 landscape, unità mm
- **Contenuto**: tabella settimanale con righe per dipendente, colonne per giorno, pausa, totale ore

### 7.2 Regole di inclusione/esclusione

- **Utenti inclusi**: `visibleUsers` — esclude `isPurelyManagementRole` (admin, proprietario) e `status !== 'active'`
- **Dati**: `timesheetData` e `userTotals` calcolati solo per `visibleUsers`

### 7.3 Formattazione totali

- **Ore**: `fmtHM(mins)` — es. `8h30`, `−15m`
- **Delta**: `+${fmtHM(deltaMins)}` o `−${fmtHM(deltaMins)}`
- **Colore stato**: verde (approvato), rosso (OUT mancante), blu (completato), amber (IN senza OUT), grigio (non timbrato)

### 7.4 Permesso export

- **Visibilità pulsanti**: `isFeatureEnabled(currentUser, 'export_pdf')`
- **Nome file**: `presenze_${weekStr}.pdf`

### 7.5 Nota validazione

Se esistono turni approvati con `approved_by` e `approved_at`, il PDF include una riga verde con:
- "Report validato da: ${uniqueBy}"
- "in data ${latestAt}"
- Conteggio turni approvati

---

## Riferimenti file principali

| Funzionalità | File |
|--------------|------|
| Ruoli e permessi | `src/utils/permissions.ts`, `src/utils/enabledFeatures.ts` |
| Admin Gate | `src/components/AdminGate.tsx` |
| PWA | `src/components/PwaGate.tsx`, `src/components/PWAInstallRequired.tsx`, `src/utils/pwaStandalone.ts` |
| Turni | `src/components/WeeklyShiftsTable.tsx` |
| Presenze | `src/components/Timesheets.tsx` |
| Kiosk | `src/components/PunchInKiosk.tsx` |
| i18n | `src/utils/i18n.ts`, `src/utils/translations.ts` |
| Realtime | `src/lib/database.ts` (realtime), `src/context/AppContext.tsx` |
