# Separazione modifiche: WEB vs MOBILE

Breakpoint: **sm = 640px** (Tailwind). Sotto = mobile, da sm in su = web/desktop.

---

## WEB (schermi ≥ 640px)

- **Tabella turni**: larghezza 100%, **tutti e 7 i giorni** visibili, nessuno scroll orizzontale.
- **Barra date**: larghezza 100%, **7 giorni** visibili, nessuno scroll.
- **Orari in cella**: formato esteso `10:00 – 16:00`.
- **Checkbox selezione turno**: piccola (16px), visibile **solo al passaggio del mouse**.
- **Celle turno**: padding compatto (`px-2 py-1.5`), nessun min-height forzato.
- **Altezza righe tabella**: 96px (48px per slot mattina/sera).
- **Cambio settimana**: solo con pulsanti ‹ › (nessuno swipe).

*(Stili condivisi: colori stati turno draft/grigio/verde/rosso, bordo tratteggiato solo sulle celle, pannello unificato senza bordi colorati, menu contestuale rimosso.)*

---

## MOBILE (schermi < 640px)

- **Tabella turni**: larghezza **233,33%**, **3 giorni** visibili, scroll orizzontale.
- **Barra date**: stessa larghezza 233,33%, 3 giorni visibili, scroll **sincronizzato** con le tabelle.
- **Swipe ai bordi**: inizio tabella + swipe destra → settimana precedente; fine tabella + swipe sinistra → settimana successiva.
- **Orari in cella**: formato compatto `10–16` (senza `:00` quando i minuti sono zero).
- **Checkbox selezione**: **sempre visibile**, più grande (24px), area tocco adeguata.
- **Celle turno**: più padding (`px-2.5 py-2`), **min-height 44px** per il tocco.
- **Altezza righe**: 100px (50px per slot).
- **Barra date**: `pl-12` / `pr-12` sulla prima/ultima cella per non far coprire il testo dai pulsanti ‹ ›.

*(Stessi stili di stato e pannello unificato del web.)*

---

## Componenti condivisi (uguali su web e mobile)

- Colori stati turno: draft (tratteggiato grigio), pubblicato (grigio), confermato (verde), ritardo (rosso).
- Bordo tratteggiato **solo** sulle celle turno in bozza, non su pannello/barra.
- Pannello unificato (1 turno selezionato = modifica + azioni in un solo blocco).
- Menu contestuale (tasto destro) rimosso; azioni solo dal pannello.
- BottomNav: nome e ruolo in header senza cerchio avatar; layout floating con riduzione altezza allo scroll (se usato).

---

## Riferimento nel codice

- **WeeklyShiftsTable.tsx**: in cima al file c’è il blocco di commento `WEB vs MOBILE`; le regole responsive usano `sm:` (valore da 640px in su).
- Cerca `sm:` e `sm:hidden` / `hidden sm:inline` per trovare tutti i punti in cui il comportamento è diverso tra web e mobile.
