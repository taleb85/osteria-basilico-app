# Flusso di sblocco turni congelati

## Cos'è un turno congelato

Un turno è considerato **congelato** (frozen) quando non può più essere modificato.  
Il congelamento serve a proteggere i dati usati per il calcolo stipendi/payroll.

**Un turno è congelato se:**
- `approval_status === 'approved'` (approvato definitivamente), oppure
- `approval_status === 'confirmed'` con `approved_at` valorizzato

```typescript
// timesheetFreezeCriteria.ts
function isShiftPayrollFrozen(shift): boolean {
  return (
    shift.approval_status === 'approved' ||
    (shift.approval_status === 'confirmed' && !!shift.approved_at)
  );
}
```

## Operazioni bloccate su turno congelato

| Operazione | Dove | Comportamento |
|---|---|---|
| `updateShift(id, updates)` | AppContext | Bloccato — mostra errore `shift_delete_blocked_frozen` |
| `deleteShift(id)` | AppContext | Bloccato — mostra errore `shift_delete_blocked_frozen` |
| `deleteShifts(ids)` | AppContext | Bloccato se almeno un turno è congelato |
| `addPunchRecord(...)` manuale | AppContext | Bloccato se `shift_id` punta a turno congelato |
| Modifica orari (drawer) | UnifiedShiftGrid | Sezione edit orari nascosta |
| Bulk edit stato | UnifiedShiftGrid | Turni congelati saltati automaticamente |
| Bulk delete | UnifiedShiftGrid | Turni congelati esclusi dalla cancellazione |

## Flusso di sblocco

```
┌──────────────┐
│  Turno       │
│  CONGELATO   │
│  (approvato) │
└──────┬───────┘
       │
       ▼  Utente clicca "Sblocca"
┌──────────────┐
│  PinPadModal │  ← Inserisci PIN manager/assistant
│  [____]      │
└──────┬───────┘
       │
       ▼  Verifica PIN
┌──────────────────┐
│ findFreezeVerifier│
│ ByPin(users, pin)│
├──────────────────┤
│ Trovato?         │
│  ✓ Sì → sblocca  │
│  ✗ No → errore   │
└──────────────────┘
       │
       ▼  updateShift(id, { approval_status: 'confirmed' })
┌──────────────────┐
│  Turno           │
│  SBLOCCATO       │
│  (confirmed)     │
│  approved_at = - │  ← Il DB resetta approved_at
└──────────────────┘
```

## Permessi richiesti

| Ruolo | Congelare | Sbloccare con PIN |
|---|---|---|
| **Admin** | ✅ (no PIN) | ✅ (PIN) |
| **Manager** | ✅ (PIN richiesto) | ✅ (PIN) |
| **Assistant Manager** | ✅ (PIN richiesto) | ✅ (PIN) |
| **Altri ruoli** | ❌ | ❌ |

Il PIN deve appartenere a un utente con ruolo `admin`, `manager` o `assistant_manager`  
presente nell'anagrafica (`users` array). La verifica usa `findFreezeVerifierByPin()`.

## Guard di backend (AppContext)

Le guardie sono implementate **prima** di qualsiasi operazione sul database:

```typescript
// updateShift — AppContext riga ~910
const isUnfreezeOp = Object.keys(updates).length === 1
  && updates.approval_status === 'confirmed';
if (isShiftPayrollFrozen(existing) && !isUnfreezeOp) {
  showError(t.shift_delete_blocked_frozen);
  return;
}

// deleteShift — AppContext riga ~1067
if (existing && isShiftPayrollFrozen(existing)) {
  showError(t.shift_delete_blocked_frozen);
  return;
}

// addPunchRecord manuale — AppContext riga ~1347
if (options?.shift_id && options?.source === 'manual') {
  const shift = shifts.find(s => s.id === options.shift_id);
  if (shift && isShiftPayrollFrozen(shift)) {
    return { error: t.shift_delete_blocked_frozen };
  }
}
```

## Guard di frontend (UnifiedShiftGrid)

- **Drawer dettagli**: se `isFrozen(selectedShift)`, la sezione modifica orari non viene mostrata, il pulsante Approva sparisce, e compare il pulsante Sblocca
- **Bulk edit**: i turni congelati vengono saltati, e un messaggio informa quanti sono stati saltati
- **Bulk delete**: i turni congelati vengono esclusi dalla cancellazione
- **Icona**: nella griglia i turni congelati mostrano un lucchetto giallo (`text-amber-400`)

## Test unitari

File: `src/__tests__/freezeGuards.test.ts`

### Cosa testano

1. **Modifiche bloccate quando il turno è congelato**
   - `isShiftPayrollFrozen` restituisce `true` per `approved` e `confirmed + approved_at`
   - La guardia `isUnfreezeOp` identifica correttamente operazioni non-di-sblocco

2. **Modifiche consentite dopo lo sblocco**
   - Dopo aver impostato `{ approval_status: 'confirmed' }`, il turno non è più congelato
   - Turni `draft` e `confirmed` senza `approved_at` non sono mai congelati

3. **Persistenza stato**
   - `approved_at === null` → non congelato
   - `approved_at valorizzato` → congelato
   - Transizione `approved → confirmed` rimuove lo stato congelato

### Eseguire i test

```bash
npx vitest run src/__tests__/freezeGuards.test.ts
```
