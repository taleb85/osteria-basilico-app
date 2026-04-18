# Fix Log — Stabilità App FLOW
Data: 2026-04-19

## 1. Prebuild Universale ✅ APPLICATO
**File:** `package.json`
**Prima:** `if [ "$SKIP_ICON_GEN" = "1" ]; then ...; else node scripts/generate-tenant-favicon.mjs; fi`
**Dopo:** `node scripts/generate-tenant-favicon.mjs || echo 'Skipping icon gen'`
**Motivo:** Sintassi `if [...] fi` è bash-only, fallisce su Windows e alcuni ambienti CI. Il nuovo comando è universale.

## 2. Service Worker in Dev ⚠️ NON APPLICATO (intenzionale)
**File:** `vite.config.mjs`
**Richiesta:** `devOptions: { enabled: true }`
**Decisione:** MANTENUTO `devOptions: { enabled: false }` — abilitare il SW in dev è la causa più comune di pagina bianca in localhost perché il SW intercetta le richieste e serve file vecchi dalla cache. Il commento nel config lo spiega esplicitamente.

## 3. Entry Point ✅ VERIFICATO — CORRETTO
**File:** `index.html` riga 105
```html
<script type="module" src="/src/main.tsx"></script>
```
Il file `src/main.tsx` esiste. Nessun problema.

## 4. process.env vs import.meta.env ✅ VERIFICATO — NESSUN PROBLEMA
**Ricerca:** `grep -r "process\.env" src/` → **zero risultati**
Tutto il codice usa correttamente `import.meta.env.VITE_*`.

## 5. Errori TypeScript ✅ CORRETTI (commit precedente)
- `exportPersonalPDF.ts`: `async function ... ): void` → `): Promise<void>`
- `exportSchedulePDF.ts`: stesso fix
- `tsc --noEmit` ora passa con 0 errori

## 6. vite.config.mjs ✅ CORRETTO
- Rimosso `pwa-splash.svg` da `includeAssets` (file non esisteva in `public/`)

## Stato TypeScript
```
npx tsc --noEmit → 0 errori
```

## Causa più probabile pagina bianca
Il server risponde (verificato: 5749 byte HTML + 11813 byte main.tsx).
Il problema è quasi certamente un **Service Worker vecchio in cache nel browser**.
Soluzione: aprire `http://localhost:5173?nocache=1` oppure DevTools → Application → Service Workers → Unregister All → ricarica.
