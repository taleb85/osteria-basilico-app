# Full Visual Audit Report

Generated: 23/04/2026 — MOBILE (393×852) + DESKTOP (1440×900)

---

## MOBILE Screenshots

| Screen | BG Uniforme | Testo Visibile | Card OK | Layout OK | Note |
|--------|-------------|----------------|---------|-----------|------|
| 01-splash | ✅ | ✅ | ✅ | ✅ | Wave coprente, nessuna banda |
| 02-panoramica | ✅ | ✅ | ✅ | ✅ | Home pulita, wave visibile in basso |
| 03-turni | ✅ | ✅ | ✅ | 🟡 | Lista turni molto lunga, card compatte ma leggibili |
| 04-presenze | ✅ | ✅ | ✅ | ✅ | Griglia settimanale visibile |
| 04b-statistiche | ✅ | 🟡 | ✅ | ✅ | Testo statistiche molto piccolo (10px) |
| 05-ferie | ✅ | ✅ | ✅ | ✅ | Calendario e card "in attesa" leggibili |
| 06-profilo | ✅ | ✅ | ✅ | ✅ | Avatar, badge, menu tutti visibili |

## DESKTOP Screenshots

| Screen | BG Uniforme | Testo Visibile | Card OK | Layout OK | Note |
|--------|-------------|----------------|---------|-----------|------|
| 01-splash | ✅ | ✅ | ✅ | ✅ | |
| 02-panoramica | ✅ | ✅ | ✅ | ✅ | KPI card, turni oggi, presenze/ferie widget tutti ok |
| 03-turni | ✅ | ✅ | ✅ | ✅ | Griglia settimanale completa |
| 03-turni-scroll | 🔴 | ✅ | ✅ | 🟠 | Banda grigia/chiara visibile al TOP quando si scrolla |
| 04-presenze | ✅ | ✅ | ✅ | ✅ | Griglia settimanale + KPI visibili |
| 04b-statistiche | ✅ | 🟡 | ✅ | ✅ | Tabella densa, testo molto piccolo |
| 05-ferie | ✅ | ✅ | ✅ | 🟠 | Grande spazio vuoto sotto calendario e card |
| 06-profilo | ✅ | ✅ | ✅ | 🟠 | Contenuto non si espande a piena altezza schermo |

---

## Issues Found

| # | Screen | Device | File | Issue | Severity |
|---|--------|--------|------|-------|----------|
| 1 | 03-turni-scroll | Desktop | `subtle-theme.css` | Quando si scrolla, il background-wave scorre con il contenuto lasciando una banda grigia/chiara visibile al top. Il `background-attachment: scroll` non copre la pagina intera su desktop | 🔴 |
| 2 | 05-ferie | Desktop | `Holidays.tsx` / layout CSS | Grande area vuota sotto i due pannelli (calendario + in attesa). Il layout non si espande a piena altezza viewport su desktop | 🟠 |
| 3 | 06-profilo | Desktop | `ProfileNavTabPanel.tsx` | La pagina profilo non usa la piena altezza, si vede molto sfondo vuoto sotto i menu item | 🟠 |
| 4 | 04b-statistiche | Mobile + Desktop | `Timesheets.tsx` | I testi nella tabella statistiche sono molto piccoli (~9-10px). Difficile leggere timbrature e dati settimanali | 🟡 |
| 5 | 03-turni | Mobile | `MobileShifts.tsx` | La lista turni mobile è molto lunga e densa. I nomi dipendenti appaiono come intestazioni ma le shift card sono molto compatte | 🟡 |

---

## Fix Priority

### 🔴 Critical

**Issue 1 — Background scroll su desktop**

Il problema: `background-attachment: scroll` + `background-size: cover` significa che il background scorre con il contenuto. Quando si scrolla verso il basso, la parte alta della pagina mostra solo `background-color: #0a2a6e` (senza l'immagine wave) e può apparire più scura o con artefatti.

**Fix in `subtle-theme.css`:**
```css
/* Desktop: fixed funziona bene */
@media (min-width: 768px) {
  html {
    background-attachment: fixed !important;
  }
}
/* Mobile iOS: scroll evita il bug fixed */
@media (max-width: 767px) {
  html {
    background-attachment: scroll !important;
  }
}
```

---

### 🟠 High

**Issue 2 — Ferie desktop spazio vuoto**

Il layout Ferie su desktop usa `min-h-[60vh]` o simile. Dovrebbe usare `min-h-[calc(100vh-80px)]` o `flex-1` per occupare lo schermo intero.

**Issue 3 — Profilo desktop spazio vuoto**

Il container profilo su desktop non si espande. Aggiungere `min-h-screen` o altezza minima al wrapper.

---

### 🟡 Medium

**Issue 4 — Testo statistiche troppo piccolo**

La tabella statistiche (`TimesheetManagementKpiBlock` + tabelle per settimana) usa font-size 9-10px. Su mobile diventa quasi illeggibile.

**Issue 5 — Lista turni mobile densa**

La lista turni mobile mostra molti dipendenti con shift compatti. Non critico ma potrebbe beneficiare di più padding tra gli elementi.

---

## Positivi (nessuna modifica necessaria)

- ✅ Sfondo uniforme navy blue + wave su TUTTE le schermate mobile
- ✅ Colori carta/vetro consistenti (glassmorphism applicato correttamente)
- ✅ Testo bianco/chiaro leggibile su quasi tutti gli elementi
- ✅ Top bar header visibile e con icone corrette
- ✅ Tab navigation funzionale su mobile e desktop
- ✅ Presenze griglia desktop: shift card colorate e leggibili
- ✅ Turni desktop: griglia settimanale con colori stato (arancio=bozza, blu=confermato, verde=approvato)
- ✅ Ferie mobile: calendario + card in attesa corretti
- ✅ Profilo mobile: avatar, badge, menu item tutti visibili e contrastanti

---

## Master Fix Prompt

```
Fix the following 3 issues found in the visual audit:

## FIX 1 — src/styles/subtle-theme.css
Background scrolls on desktop showing gray band.
Fix by using background-attachment: fixed on non-mobile:

Change the html rule to:
html {
  min-height: 100%;
  background-color: #0a2a6e !important;
  background-image: 
    linear-gradient(160deg, rgba(5,14,60,0.18) 0%, rgba(5,14,60,0.40) 100%),
    url('/background-wave.png') !important;
  background-repeat: no-repeat !important;
  background-position: center center !important;
  background-size: cover !important;
  background-attachment: scroll !important;
}

Then add after it:
@media (min-width: 768px) {
  html {
    background-attachment: fixed !important;
  }
}

## FIX 2 — src/components/Holidays.tsx (or HolidaysPage)
The ferie page has large empty space on desktop.
Find the main container div and add: min-h-[calc(100dvh-80px)]
Or add flex-1 to the content wrapper so it fills the screen.

## FIX 3 — src/components/profile/ProfileNavTabPanel.tsx or ProfilePage
The profile page content doesn't fill the screen on desktop.
Add min-h-[calc(100dvh-80px)] to the outer wrapper.
```
