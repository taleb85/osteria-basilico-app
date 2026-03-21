---
name: Pause Automatiche
overview: Implementare un sistema di regole pause automatiche configurabili (localStorage) con UI in SettingsPage, che ricalcola le ore visualizzate per tutti i turni in base alle regole attive senza modificare i dati.
todos:
  - id: break-utils
    content: Creare src/utils/breakRules.ts con modello BreakRule, getBreakRules, saveBreakRules, calculateBreakDeductions
    status: completed
  - id: settings-ui
    content: Aggiungere sezione 'Pause automatiche' + BreakRuleModal in SettingsPage.tsx
    status: completed
  - id: weekly-table
    content: Integrare calculateBreakDeductions in WeeklyShiftsTable.tsx per badge e totali
    status: completed
  - id: timesheets
    content: Integrare calculateBreakDeductions in Timesheets.tsx per ore pianificate
    status: completed
  - id: build-deploy
    content: npm run build e npm run deploy (Vercel)
    status: completed
isProject: false
---

# Pause Automatiche — Piano di Implementazione

## Architettura

```mermaid
flowchart TD
    Settings["SettingsPage\n(UI crea/modifica/elimina regole)"]
    localStorage["localStorage\n'osteria_break_rules'"]
    breakRulesTs["breakRules.ts\n(modello dati + calcolo)"]
    WeeklyTable["WeeklyShiftsTable.tsx\n(totali riga/giorno)"]
    Timesheets["Timesheets.tsx\n(ore pianificate)"]

    Settings -->|"saveBreakRules()"| localStorage
    localStorage -->|"getBreakRules()"| breakRulesTs
    breakRulesTs -->|"calculateBreakDeductions(shift, user, rules)"| WeeklyTable
    breakRulesTs -->|"calculateBreakDeductions(shift, user, rules)"| Timesheets
```



## 1 · Nuovo file `src/utils/breakRules.ts`

Modello dati e logica di calcolo:

```typescript
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface BreakRule {
  id: string;
  title: string;
  breakStart: string;       // HH:mm — inizio finestra pausa
  breakEnd: string;         // HH:mm — fine finestra pausa
  minShiftMinutes: number;  // durata minima turno per scattare la pausa
  paid: boolean;            // true = non detrae ore; false = detrae
  departments: string[];    // [] = tutti i reparti
  roles: string[];          // [] = tutti i ruoli
  validFrom?: string;       // YYYY-MM-DD (opzionale)
  validTo?: string;         // YYYY-MM-DD (opzionale)
  daysOfWeek: DayOfWeek[];  // [] = tutti i giorni
}
```

Funzioni esportate:

- `getBreakRules(): BreakRule[]` — legge da `localStorage['osteria_break_rules']`
- `saveBreakRules(rules): void` — salva in localStorage
- `calculateBreakDeductions(shift, user, rules): number` — restituisce i minuti da detrarre per un turno specifico, filtrando per reparto, ruolo, data, giorno

## 2 · `src/components/SettingsPage.tsx`

Aggiungere una nuova sezione collassabile "Pause automatiche" (stesso pattern toggle + `AnimatePresence` delle sezioni esistenti):

- Lista delle regole salvate con nome, finestra oraria, badge "Retribuita/Non retribuita", pulsanti modifica/elimina
- Pulsante "Nuova regola" → apre un modal inline (`BreakRuleModal`) con:
  - **Generale**: Titolo · Inizio pausa + Fine pausa · Durata minima turno (stepper) · Toggle Retribuita/Non retribuita
  - **Assegna a**: chip multi-select per Reparti (Sala, Cucina, Bar) e Ruoli
  - **Applica a**: date-picker Valida dal/al (opzionale) + chip giorni settimana (Lun–Dom)
  - Bottoni: Crea / Salva · Annulla

## 3 · Integrazione nei componenti di visualizzazione

### `WeeklyShiftsTable.tsx`

- All'inizio del componente: `const breakRules = useMemo(() => getBreakRules(), [])` 
- Dove si calcola la durata mostrata nel badge e nei totali colonna/riga: sottrarre `calculateBreakDeductions(shift, user, breakRules)` dal risultato di `calculateShiftMinutesSafe`
- Il campo `deduct_break` per-turno rimane invariato (retrocompatibilità)

### `Timesheets.tsx`

- Stesso pattern: caricare le regole e applicare `calculateBreakDeductions` alle ore pianificate per i confronti pianificato/effettivo

## File modificati

- `src/utils/breakRules.ts` — **nuovo file**
- `src/components/SettingsPage.tsx` — nuova sezione + modal
- `src/components/WeeklyShiftsTable.tsx` — applicazione regole ai totali e badge
- `src/components/Timesheets.tsx` — applicazione regole alle ore pianificate

## Cosa NON cambia

- La struttura Supabase — nessuna migrazione DB
- Il campo `deduct_break` sui turni esistenti
- Tutte le funzioni in `timeCalculations.ts` — restano invariate
- I file di esportazione PDF (fuori scope, le pause automatiche non impattano l'export in questa fase)

