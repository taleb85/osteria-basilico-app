# Proposta implementazione funzionalità (senza stravolgere il layout)

## Stato attuale dell'app

- **Vista**: solo settimana (7 giorni)
- **Navigazione**: frecce prev/next, `weekOffset`
- **Dati**: `User` ha `role` e `department`, `Shift` ha `type` (lunch/dinner)
- **Today**: solo il numero del giorno è evidenziato (badge verde sul giorno)
- **Filtri**: rimosso filtro reparto, c'è leggenda colori
- **Pubblica**: pulsante "Pubblica settimana" già presente

---

## Funzionalità implementabili SENZA stravolgere il layout

### 1. Pulsante "Oggi" — FACILE
**Cosa**: pulsante che imposta `weekOffset = 0` per tornare alla settimana corrente.
**Dove**: accanto alle frecce prev/next nella barra date.
**Esempio**: vedi sotto.

### 2. Indicatore "Today" sulla colonna — FACILE
**Cosa**: evidenziare l'intera colonna del giorno corrente (non solo il numero).
**Dove**: aggiungere `bg-accent/5` o bordo laterale alla colonna quando `isToday(day)`.
**Esempio**: vedi sotto.

### 3. Badge "APPROVATO" sui turni — FACILE
**Cosa**: mostrare "APPROVATO" sui turni con `approval_status === 'approved'`.
**Dove**: dentro il blocco turno, sotto o accanto all'orario.
**Esempio**: vedi sotto.

### 4. Ruolo/reparto sul blocco turno — FACILE
**Cosa**: mostrare "Sala", "Cucina", "Bar" (da `user.department`) sul blocco.
**Dove**: sotto l'orario nel badge del turno. User ha già `department`.
**Esempio**: vedi sotto.

### 5. Menu "Mostra" (filtri rapidi) — MEDIO
**Cosa**: dropdown con filtri: solo approvati, solo bozze, per reparto.
**Dove**: accanto alla leggenda, stile "Mostra ▼".
**Layout**: stesso spazio, solo un pulsante in più che apre un menu.

### 6. Menu "Strumenti" — MEDIO
**Cosa**: dropdown con: Copia settimana, Pubblica, Esporta CSV.
**Dove**: accanto a "Modifica vista", stile "Strumenti ▼".
**Layout**: stesso spazio, pulsante che apre menu.

### 7. Vista 2 settimane — MEDIO
**Cosa**: `viewMode: 'week' | '2weeks'` → `allWeekDays` diventa 14 giorni.
**Dove**: stessa griglia, solo più colonne. Scroll orizzontale già presente su mobile.
**Layout**: invariato, solo più larghezza.

### 8. Vista giorno — MEDIO
**Cosa**: `viewMode: 'day'` → una sola colonna, tutti i turni del giorno impilati.
**Dove**: stessa struttura, ma una colonna invece di 7.
**Layout**: compatto, nessun stravolgimento.

### 9. Vista mese — MEDIO-ALTO
**Cosa**: calendario mensile con turni per giorno.
**Dove**: componente alternativo o stessa griglia con 4–5 righe (settimane) × 7 colonne.
**Layout**: più complesso ma riutilizzabile.

### 10. Selettore location — MEDIO (se multi-sede)
**Cosa**: dropdown "West Elm Cafe" se hai più sedi.
**Requisito**: modello dati `Location` e `Shift.location_id` (o `User.location_id`).
**Se hai una sola sede**: puoi preparare la struttura e mostrare solo una voce.

### 11. Gruppi dipendenti — MEDIO
**Cosa**: raggruppare per "Camerieri", "Cucina" (derivabile da `role`/`department`).
**Dove**: filtri nella sidebar o nel menu "Mostra". User ha già `role` e `department`.
**Layout**: nessun cambiamento strutturale.

### 12. Template settimanali — ALTO
**Cosa**: salvare/caricare settimane tipo.
**Requisito**: storage (Supabase o localStorage) per template, UI per salvare/caricare.
**Layout**: menu "Template ▼" che apre modale o lista.

---

## Esempio concreto: prime 4 funzionalità (FACILI)

Di seguito il codice per implementare:
1. Pulsante "Oggi"
2. Colonna "Today" evidenziata
3. Badge "APPROVATO" sui turni approvati
4. Reparto sul blocco turno (es. "Sala")

### 1. Pulsante "Oggi"

```tsx
// Nella barra date, tra le frecce e le date:
<button
  type="button"
  onClick={() => setWeekOffset(0)}
  className="px-2 py-1 rounded-lg text-xs font-semibold text-accent hover:bg-accent/10 border border-accent/30"
>
  {t.today}
</button>
```

### 2. Colonna Today evidenziata

```tsx
// Nella cella td della tabella, aggiungere alla className:
className={`... ${isTodayDate ? 'bg-accent/5 border-l-2 border-r-2 border-accent' : ''}`}

// E nella barra date, sulla colonna del giorno:
className={`... ${isTodayDate ? 'bg-accent/10 ring-1 ring-accent/30' : ''}`}
```

### 3. Badge APPROVATO

```tsx
// Dentro il blocco turno, dopo l'orario:
{dayShift.approval_status === 'approved' && (
  <span className="block text-[10px] font-bold uppercase tracking-wider text-current opacity-90 mt-0.5">
    {t.approved}
  </span>
)}
```

### 4. Reparto sul blocco

```tsx
// User ha department. Nel blocco turno:
{user.department && (
  <span className={`text-[10px] font-semibold uppercase ${DEPARTMENT_STYLE[user.department].text}`}>
    {user.department === 'sala' ? t.department_sala : user.department === 'kitchen' ? t.department_kitchen : t.department_bar}
  </span>
)}
```

---

## Ordine consigliato di implementazione

1. **Oggi** + **Colonna Today** + **Badge APPROVATO** + **Reparto sul blocco** (tutte facili, ~30 min)
2. **Menu "Mostra"** (filtri)
3. **Menu "Strumenti"** (copia, pubblica, esporta)
4. **Vista 2 settimane** e **Vista giorno**
5. **Vista mese**
6. **Template** e **Location** (se servono)

---

## Conclusione

Sì, si può fare senza stravolgere il layout. Le prime 4 sono modifiche puntuali. I menu "Mostra" e "Strumenti" sono dropdown che occupano lo stesso spazio dei pulsanti attuali. Le viste aggiuntive riusano la stessa griglia cambiando solo il numero di giorni. Template e location richiedono più lavoro ma non cambiano il layout esistente.
