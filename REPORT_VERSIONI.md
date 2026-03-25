# Report analisi versioni: App, Mobile, Web

## Riepilogo modalità

| Modalità | Rilevamento | Breakpoint / Condizione |
|----------|-------------|-------------------------|
| **APP (PWA)** | `navigator.standalone` (iOS) o `display-mode: standalone` | Installata come PWA |
| **MOBILE** | `matchMedia('(max-width: 639px)')` | Viewport < 640px |
| **WEB** | Default | Viewport ≥ 640px |

---

## 1. APP (PWA Standalone)

### Cose da sistemare

1. **Scheda Turni – selezione turni impossibile**
   - In modalità app la selezione è disattivata (`canEditInApp` = false)
   - Nessun pulsante per selezionare/deselezionare turni
   - La spunta mobile è solo visiva (opacity-0 quando non selezionato) e non cliccabile
   - **Suggerimento:** se serve la selezione in app, valutare un pulsante “Seleziona” sempre visibile

2. **Manifest – orientamento fisso**
   - `orientation: 'portrait'` nel manifest limita l’uso su tablet in landscape
   - **Suggerimento:** usare `"any"` o `"natural"` per maggiore flessibilità

3. **Pull-to-refresh**
   - In standalone usa `pulltorefreshjs`, nel browser implementazione custom
   - Comportamento diverso tra PWA e browser

4. **Bottom bar e scroll**
   - L’animazione hide/show della bottom bar usa `window.scrollY`
   - Se lo scroll avviene in un contenitore interno (es. lista), la barra non si nasconde
   - **Suggerimento:** verificare che lo scroll principale sia sul `body` o usare un listener sull’elemento che effettivamente scorre

---

## 2. MOBILE (viewport < 640px)

### Cose da sistemare

1. **Selezione turni – nessun modo di selezionare**
   - Il pulsante checkbox è `hidden sm:flex` → nascosto su mobile
   - Il long-press è stato rimosso
   - Su mobile i manager non possono selezionare turni per azioni multiple
   - **Suggerimento:** rendere la spunta mobile cliccabile o aggiungere un pulsante “Seleziona” visibile

2. **BottomNav – layout mobile vs desktop**
   - Su mobile: solo icone, logout in header
   - Su desktop: layout floating con icone + logout
   - La barra mobile si nasconde allo scroll; su desktop la barra floating fa lo stesso

3. **Header – cambio lingua nascosto**
   - Il selettore lingua è `hidden sm:flex` → non visibile su mobile
   - **Suggerimento:** spostare il cambio lingua nel menu utente o in Impostazioni

4. **Ore – date picker**
   - I selettori data inizio/fine potrebbero essere stretti su schermi piccoli
   - **Suggerimento:** usare input `type="date"` nativi o modal full-screen su mobile

5. **Ferie – calendario**
   - Le celle del calendario potrebbero avere touch target < 44px
   - **Suggerimento:** verificare `min-h` e `min-w` per accessibilità touch

6. **Tabella turni – scroll orizzontale**
   - Su mobile: `w-[233.33%]` con scroll orizzontale per ~3 giorni
   - Swipe ai bordi per cambiare settimana
   - **Verificare:** che lo swipe non entri in conflitto con lo scroll orizzontale

---

## 3. WEB (desktop, viewport ≥ 640px)

### Cose da sistemare

1. **Layout BottomNav – opzioni non usate**
   - `getStoredLayout()` restituisce sempre `'floating'`
   - I layout `minimal`, `pill`, `classic` non sono mai mostrati (la sezione impostazioni è stata rimossa)
   - **Suggerimento:** rimuovere il codice morto o ripristinare la scelta layout

2. **Pulsanti cambio settimana**
   - Le frecce prev/next sono `hidden sm:flex` → visibili solo su desktop
   - Su mobile si usa lo swipe; su desktop le frecce sono l’unico modo

3. **Checkbox selezione turni**
   - Su desktop: visibili al hover (`opacity-0 sm:group-hover:opacity-100`)
   - Su mobile: nascosti; la spunta è solo indicatore visivo

4. **Modale “Modifica vista”**
   - Visibile solo se `!isStandaloneApp` e `isManagement`
   - Su desktop i manager possono riordinare i nomi; in app no

---

## 4. Problemi trasversali

1. **Scroll e BottomNav**
   - La barra si nasconde con `window.scrollY > 40` e scroll verso il basso
   - Se una pagina ha `overflow-y` su un div interno, `window.scrollY` non cambia
   - **Verificare:** che tutte le pagine scrollino tramite `body`

2. **Safe area**
   - `safe-area-pad`, `safe-area-bottom` usati correttamente
   - `pb-content` e `pb-[calc(7rem+env(safe-area-inset-bottom))]` gestiscono il padding inferiore

3. **Touch target**
   - Classe `touch-target` (min 44px) usata in molti punti
   - Alcuni elementi (es. celle calendario, icone piccole) potrebbero essere sotto la soglia

4. **Zoom bloccato**
   - Viewport con `maximum-scale=1, user-scalable=no`
   - `touch-action: manipulation` su html/body
   - Può ridurre l’accessibilità per chi ha bisogno di zoom

5. **Animazioni rimosse**
   - Le animazioni sulle celle turni sono state rimosse
   - Restano `transition-all duration-150` su BottomNav e altri componenti

6. **Doppia logica standalone**
   - `isStandalone()` in BodyPullToRefresh
   - `isStandaloneApp` in WeeklyShiftsTable
   - **Suggerimento:** centralizzare in un hook `useIsStandalone()` condiviso

---

## 5. Priorità interventi

| Priorità | Problema | Modalità |
|----------|----------|----------|
| Alta | Selezione turni impossibile su mobile | Mobile |
| Alta | Selezione turni disattivata in app | App |
| Media | Cambio lingua nascosto su mobile | Mobile |
| Media | Layout BottomNav – codice morto | Web |
| Bassa | Orientamento manifest PWA | App |
| Bassa | Touch target calendario ferie | Mobile |
| Bassa | Hook centralizzato `useIsStandalone` | Tutte |
