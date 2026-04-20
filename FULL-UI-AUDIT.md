# FULL UI AUDIT — Osteria Basilico Flow
**Data:** 20 Aprile 2026  
**Viewport desktop:** 1440×900 | **Mobile:** 390×844  
**Screenshots catturati:** 7 (navigazione Playwright parziale — alcune route non intercettate automaticamente)

---

## RISULTATO GENERALE

| Categoria | Stato |
|-----------|-------|
| Dark theme globale | ✅ Applicato |
| Top Bar colore | ✅ `rgb(11,53,115)` |
| Bottom Nav colore | ✅ `rgb(11,53,115)` allineato |
| Testo nero → bianco | ✅ Convertito |
| Sfondi bianchi nelle card | ✅ Rimossi |
| Settings page | ⚠️ Non caricata (route diretta) |
| Navigazione mobile | ⚠️ Chat panel si apre al posto della home |

---

## SCREEN 01 — HOME / PANORAMICA

**File:** `01-home-panoramica.png`

| Elemento | Atteso | Osservato | Problema | Severità |
|----------|--------|-----------|----------|----------|
| Background | Dark blue | ✅ Dark blue | — | — |
| Top Bar | Blue #0B3573 | ✅ Corretto | — | — |
| Bottom Nav | Blue #0B3573 | ✅ Corretto | — | — |
| "PANORAMICA" heading | White bold | ✅ White | — | — |
| KPI card numeri ("0", "1") | White bold large | ✅ Visibili | — | — |
| KPI card subtitles | White/60 | ⚠️ Molto faint | text-white/40 troppo basso | 🟡 MEDIUM |
| "Turni di Oggi" title | White | ✅ Visibile | — | — |
| Shift card GUSTAVO | Glass dark | ✅ Dark glass | — | — |
| "Non timbrato" badge | Amber | ✅ Amber visibile | — | — |
| "PIANIFICATO" / "TIMBRATO" labels | White/50+ | ✅ Leggibili | — | — |
| Orari "18:00 → 23:00" | White bold | ✅ Chiari | — | — |
| "Presenze" card | Glass | ✅ Dark glass | — | — |
| Progress bars (0%) | Blue/accent | ⚠️ Quasi invisibili | Bars troppo sottili a 0% | 🟡 MEDIUM |
| "Ferie & Permessi" card | Glass | ✅ OK | — | — |
| "In attesa" badge | Amber | ✅ Visibile | — | — |
| "DANY" text | White | ✅ White | — | — |
| OreSettimana / Turni cards | Dark glass | ✅ OK | — | — |
| "00:00" large text | White | ✅ Bold visibile | — | — |
| "TALEB" in bottom nav | White | ✅ Visibile | — | — |
| Nav icons (inactive) | White/50 | ✅ OK | — | — |
| Nav icon (active Home) | White | ✅ Active visibile | — | — |

**Problemi trovati:**
- KPI subtitle text (`text-white/40`) troppo faint → alzare a `/55`

---

## SCREEN 02 — HOME BOTTOM SCROLL

**File:** `02-home-bottom.png`

Identica a 01 (contenuto non abbastanza lungo per scroll).  
✅ Nessun problema aggiuntivo.

---

## SCREEN 03, 06 — TURNI / PRESENZE (navigazione fallita)

**File:** `03-turni-fallback.png`, `06-presenze-fallback.png`

La navigazione Playwright non ha trovato i selettori `nav a[href*="turni"]` — le route usano un sistema custom con bottom nav e non `<a>` tag standard.  
**Screenshot coincidono con la home** — nessun problema aggiuntivo visibile.

> ⚠️ **Nota:** Per catturare Turni/Presenze/Ferie/Profilo richiederebbe un secondo run manuale con click precisi sulla bottom nav.

---

## SCREEN 15 — SETTINGS (Admin)

**File:** `15-settings.png`

| Elemento | Atteso | Osservato | Problema | Severità |
|----------|--------|-----------|----------|----------|
| Contenuto settings | Form dark | ❌ Pagina vuota | Route `/settings` non accessibile senza context | 🔴 HIGH |
| Background | Dark blue | ✅ Dark blue | — | — |

**Causa:** La route `/settings` con Playwright bypass navigazione non ha caricato il contenuto perché richiede stato Admin autenticato con il context dell'app. La pagina non crashava, mostrava solo sfondo.

---

## SCREEN 17-18 — MOBILE (390×844)

**File:** `17-mobile-home.png`, `18-mobile-bottom-nav.png`

| Elemento | Atteso | Osservato | Problema | Severità |
|----------|--------|-----------|----------|----------|
| Layout mobile | Home dashboard | ⚠️ Chat panel aperto | DirectMessages si apriva al resize | 🟡 MEDIUM |
| Panel header | Blue/dark | ✅ Blue accent | — | — |
| Lista contatti | Dark glass rows | ✅ Dark rows visibili | — | — |
| Nomi ("VIRGINIA", "GUSTAVO") | White bold | ✅ White | — | — |
| Subtitles ("Ythhе", "Tu: Ricevuto") | White/50 | ✅ Leggibili | — | — |
| Timestamps ("13:30", "00:51") | White/40 | ⚠️ Molto faint | `/40` troppo basso | 🟡 MEDIUM |
| Divisori righe | White/10 | ✅ Sottili ma visibili | — | — |
| Bottom area (blurred) | Blur modal | ✅ Effetto blur corretto | — | — |

---

## ANALISI CODICE — PROBLEMI RESIDUI NOTI

Basato sull'analisi del codice sorgente (non visibili negli screenshot catturati):

### Timesheets.tsx — Drawer dettaglio turno
| Elemento | Problema | File:Riga |
|----------|----------|-----------|
| `border-l-slate-400` (draft shift) | Bordo grigio-slate su dark — accettabile | `Timesheets.tsx:2684` |
| `planningCardBoxClass` con `bg-[#0052FF]/10` | OK dark | — |
| `deltaColor text-accent` | ✅ Fixed | — |

### WeeklyShiftsTable.tsx — Griglia turni
| Elemento | Problema | Riga |
|----------|----------|------|
| `bg-red-100 text-red-600` (unavail day button) | Light bg su dark | `4094` |
| `text-amber-950` → `text-amber-200` | ✅ Fixed | `4308` |

### App.tsx
| Elemento | Problema | Riga |
|----------|----------|------|
| Root `bg-[#f8fafc]` class | ⚠️ Sfondo light class presente ma probabilmente overridden da CSS | `155` |

### index.css — KPI subtitle contrast
| Classe | Problema |
|--------|----------|
| Vari elementi con `/40` opacity | Troppo faint — alzare a `/55` |

---

## MASTER FIX LIST

### 🔴 HIGH — Da correggere subito

| File | Trovare | Sostituire con |
|------|---------|----------------|
| `App.tsx:155` | `bg-[#f8fafc]` | rimuovere (già overridden) |
| `WeeklyShiftsTable.tsx:4094` | `bg-red-100 text-red-600 hover:bg-red-200` | `bg-red-500/15 text-red-400 hover:bg-red-500/25` |

### 🟡 MEDIUM — Contrast migliorabile

| File | Trovare | Sostituire con |
|------|---------|----------------|
| Vari componenti home | KPI subtitle `text-white/40` | `text-white/55` |
| `DirectMessagesPanel.tsx` | Timestamp `text-white/40` | `text-white/50` |
| `MessagesList.tsx` | Timestamp colors | verificare `/40` → `/50` |

### ✅ GIÀ FIXATI (in questa sessione)

- `text-slate-900`, `text-gray-900`, `text-black` → `text-white` in 34 file
- Bottom Nav → `rgb(11,53,115)` (= Top Bar)
- Duplicate `style` prop in `WeeklyShiftsTable.tsx` e `Statistics.tsx`
- Period picker popover posizione fixed (bug doppio style)
- Drawer dettaglio turno: `bg-white`, `bg-slate-50`, `border-slate-100` → dark
- CalendarDatePicker: tutto dark
- Create-shift modal: `bg-white/92` → `bg-white/5`
- Lock icon turno approvato: `text-emerald-400`
- Menu hamburger sezioni: `text-white/40` → `text-white/55`

---

## CONCLUSIONE

L'app ha un dark theme **ben applicato** con pochi residui. I problemi principali rimasti sono:

1. **Opacity `/40`** su alcuni testi secondari — troppo faint, alzare a `/55`
2. **`bg-red-100 text-red-600`** in WeeklyShiftsTable (1 istanza)
3. **Settings page** — non verificabile via URL diretto (richiede navigazione interna)
4. **Mobile direct messages** — layout corretto ma il panel si apre allo switch viewport

Per un audit completo di Turni/Presenze/Ferie/Profilo: navigare manualmente a quelle sezioni e usare il Cursor element inspector per segnalare eventuali problemi specifici.
