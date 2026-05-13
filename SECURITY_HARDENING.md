# Security & Stability Hardening — FLOW v1.1.0+

## Cambiamenti Implementati

### 1. SICUREZZA SUPABASE (CRITICAL) ✅

**Problema**: Service role key esposta nel bundle client tramite `VITE_SUPABASE_SERVICE_ROLE_KEY`

**Fix**:
- Rimossa `supabaseAdmin` da `src/lib/supabase.ts`
- Tutti gli usi in `src/` ora usano solo anon key + RLS
- SuperAdminPanel disabilitato (migrato a Cloudflare Pages)
- `.env.example` aggiornato: `SUPABASE_SERVICE_ROLE_KEY` (senza `VITE_`)
- `src/vite-env.d.ts`: rimosso type per `VITE_SUPABASE_SERVICE_ROLE_KEY`

**File modificati**:
- `src/lib/supabase.ts`
- `src/utils/profilePhotoStorage.ts`
- `src/App.tsx` (SuperAdminPanel commentato)
- `.env.example`
- `src/vite-env.d.ts`

**Verifica**: Build + grep bundle per `service_role` / `supabaseAdmin`

---

### 2. PWA GATE NON-BLOCCANTE ✅

**Problema**: Gate PWA blocca app in prod senza bypass configurabile

**Fix**:
- `PwaGate` ora controlla `VITE_ALLOW_BROWSER_APP=true` per bypass
- Dev mode: sempre bypass
- Prod + PWA standalone: pass
- Prod + browser senza bypass: install screen
- Estratto in modulo separato `src/components/PwaGate.tsx`

**File modificati**:
- `src/App.tsx`
- `src/components/PWAInstallRequired.tsx`
- `src/components/PwaGate.tsx` (nuovo)

**Verifica**: 
```bash
VITE_ALLOW_BROWSER_APP=true npm run build
npm run preview  # dovrebbe caricare senza install screen
```

---

### 3. CONFIG VITE UNIFICATA ✅

**Problema**: Dual config (`vite.config.ts` root + `scripts/vite.config.mjs`) con manifest divergenti

**Fix**:
- Eliminato `vite.config.ts` root
- `scripts/vite.config.mjs` è UNICA fonte di verità
- Warning in commenti per prevenire `npx vite` senza flag
- `package.json` già usa `--config scripts/vite.config.mjs`

**File modificati**:
- `vite.config.ts` (eliminato)
- `scripts/vite.config.mjs` (commenti aggiornati)

**Verifica**: `npm run dev`, `npm run build`, `npm run preview`

---

### 4. METADATA & CACHE ROBUSTEZZA ✅

**Problema**: 
- `CURRENT_VERSION` hardcoded in `index.html`
- OG URL verso dominio sbagliato
- `location.reload(true)` deprecato

**Fix**:
- `window.__APP_CACHE_VERSION__` iniettato da Vite `define`
- `index.html`: versione generata build-time con plugin custom
- OG URL corretto: `flow-workinmotion.vercel.app`
- `location.reload()` senza parametro deprecato
- Meta tag `app-version` sostituito dinamicamente

**File modificati**:
- `scripts/vite.config.mjs` (plugin `inject-version-meta`)
- `index.html`

**Verifica**: Build + inspect HTML + DevTools > Application > Service Workers

---

### 5. SUPABASE ROBUSTEZZA ✅

**Problema**: `supabase` return `null` silenzioso causa crash runtime

**Fix**:
- Nuovo `src/lib/supabaseClient.ts` con `getSupabaseClient()`
- Dev: throw error se client `null`
- Prod: return `null` + console.warn per graceful degradation
- Commenti aggiornati in `src/lib/supabase.ts`

**File creati**:
- `src/lib/supabaseClient.ts`

**Uso consigliato**:
```ts
import { getSupabaseClient } from '@/lib/supabaseClient';

const client = getSupabaseClient();
if (!client) {
  // Prod: disable feature con UI fallback
  return <div>Feature non disponibile</div>;
}
```

---

### 6. TEST MINIMI ✅

**Setup**:
- **Vitest** per unit test
- **Playwright** per e2e smoke test
- CI aggiornato per eseguire test prima di build

**Test creati**:
- `src/test/security.test.ts`: PwaGate logic + supabaseAdmin assente
- `e2e/smoke.spec.ts`: homepage load + no service role in bundle

**Comandi**:
```bash
npm test                 # vitest watch
npm run test -- --run    # vitest singola run
npm run test:ui          # vitest UI
npm run test:e2e         # playwright
npm run test:e2e:ui      # playwright UI
```

**File modificati/creati**:
- `package.json` (script + devDeps)
- `vitest.config.ts`
- `playwright.config.ts`
- `src/test/setup.ts`
- `src/test/security.test.ts`
- `e2e/smoke.spec.ts`
- `.github/workflows/ci.yml`

**Verifica**: `npm ci && npm run test -- --run && npm run build && npm run test:e2e`

---

### 7. REFACTOR APP.TSX (PARZIALE) ✅

**Obiettivo**: Ridurre complessità ~1170 righe

**Fix**:
- Estratto `PwaGate` → `src/components/PwaGate.tsx`
- Estratto provider wrapper → `src/components/AppProviders.tsx`
- Stub routing → `src/routing/AppRoutes.tsx` (future: estrarre LoginRoute/ProtectedApp)
- Export `LoginRoute` e `ProtectedApp` da `App.tsx` per uso esterno

**File creati**:
- `src/components/PwaGate.tsx`
- `src/components/AppProviders.tsx`
- `src/routing/AppRoutes.tsx`

**Note**: Refactor completo richiede estrazione ulteriore di `MainApp`, `KioskRoute`, ecc. (future PR)

---

## Checklist Verifica Post-Deploy

### Build & Bundle

```bash
# 1. Install deps
npm ci

# 2. Typecheck
npm run typecheck

# 3. Lint
npm run lint

# 4. Test unit
npm run test -- --run

# 5. Build
npm run build

# 6. Inspect bundle per service role key
grep -r "service_role" dist/ && echo "FAIL: service_role found in bundle" || echo "OK"
grep -r "supabaseAdmin" dist/ && echo "FAIL: supabaseAdmin found in bundle" || echo "OK"

# 7. Test e2e
npm run test:e2e

# 8. Preview
npm run preview
```

### Cloudflare Env Variables (Produzione)

**Frontend (Build)**:
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
VITE_GEMINI_API_KEY=AIzaSy...
# VITE_ALLOW_BROWSER_APP=true  # solo temporaneo debug
```

**Functions/Edge (se migrate SuperAdmin)**:
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...  # NO VITE_ prefix
```

### DevTools Check

1. **Service Worker**: Application > Service Workers > `sw.js` attivo
2. **Cache**: Storage > Cache Storage > precache + runtime caches
3. **Version**: Elements > `<meta name="app-version">` → `1.1.0-light` (o current)
4. **Console**: Zero error `supabase client null` in prod
5. **Network**: Tab Network > filter JS > inspect chunks → no `service_role` string

### Supabase RLS

Se `profilePhotoStorage.ts` fallisce in prod:

1. Verifica policies su `storage.objects` bucket `profile-photos`
2. Policy `SELECT`: authenticated users per owner
3. Policy `INSERT`: authenticated users per owner
4. Policy `UPDATE`: authenticated users per owner
5. Policy `DELETE`: authenticated users per owner

---

## Roadmap Future

### High Priority

1. **SuperAdminPanel Migration**: Vercel Serverless Function con service role key server-side
2. **Error Boundary UI**: Cattura errori Supabase gracefully con fallback UI
3. **Complete App.tsx Refactor**: Estrai `MainApp`, `KioskRoute`, `LoginRoute`, `ProtectedApp` in file separati

### Medium Priority

4. **Test Coverage**: Aumenta unit test per guard logic, routing, context
5. **E2E Coverage**: Test login flow, admin gate, PWA install flow
6. **Performance**: Lazy load più componenti pesanti (MainApp split)

### Low Priority

7. **TypeScript Strict Mode**: `noUnusedLocals`, `noUnusedParameters` anche per `tsconfig.app.json`
8. **Bundle Analysis**: Visualizer webpack per ridurre chunk size
9. **Lighthouse**: Target 90+ su tutti i metric in prod

---

## Breaking Changes

- **SuperAdminPanel**: Disabilitato. Route `/super-admin` mostra messaggio di migrazione necessaria.
- **Service Role Key**: Non più disponibile nel client. Script Node devono usare `SUPABASE_SERVICE_ROLE_KEY` da `.env`.

---

## Rollback Plan

Se deploy causa regressioni:

1. Revert commit: `git revert <commit-sha>`
2. Riabilita SuperAdminPanel: decommentare import in `src/App.tsx` + route
3. Re-esporre `supabaseAdmin` (CRITICAL: solo se assolutamente necessario, poi rimuovere ASAP)

---

## Supporto

- **Issues**: Apri issue su GitHub con label `security` o `stability`
- **Docs**: `docs/` per guide dettagliate
- **CI Logs**: `.github/workflows/ci.yml` per debug failures

---

**Data**: 2026-04-19  
**Autore**: AI Security Hardening  
**Versione**: 1.1.0+security-patch
