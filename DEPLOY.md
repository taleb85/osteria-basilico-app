# Pubblicare l’app Osteria Basilico

Guida per rendere ufficiale e pubblicare l’app (build + hosting).

---

## 1. Verifiche prima della pubblicazione

### 1.1 Variabili d’ambiente (Supabase)

L’app usa **Supabase** per dati e auth. In produzione servono:

| Variabile | Dove prenderla | Obbligatoria |
|-----------|-----------------|--------------|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Sì |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public | Sì* |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Stesso valore se la dashboard mostra “publishable” al posto di anon | Sì* |
| `VITE_GEMINI_API_KEY` | Google AI Studio (per Scan Foto turni) | No (opzionale) |

\* Serve **una** tra `VITE_SUPABASE_ANON_KEY` e `VITE_SUPABASE_PUBLISHABLE_KEY` (in `src/lib/supabase.ts` la publishable ha priorità se entrambe fossero impostate).

- **Non** mettere mai la **service role** nel bundle frontend: non aggiungerla come `VITE_*` su Vercel. Per script in `scripts/` vedi `.env.example` (ideale: variabile **senza** prefisso `VITE_` solo in locale).
- Il file `.env` **non** va committato: usalo solo in locale. In hosting imposti le variabili dalla dashboard.

### 1.2 Supabase in produzione

- Crea un **progetto Supabase** (o usa quello già usato in sviluppo).
- **Migrazioni:** dalla root del repo, con CLI collegata al progetto: `npx supabase db push` (se richiesto: `npx supabase db push --include-all`). Senza CLI: incolla in SQL Editor gli script in `supabase/migrations/` in ordine, oppure lo script riepilogativo `supabase/manual_paste_sql_editor_rls.sql` dove applicabile. Dettagli e repair cronologia: [docs/CHECKLIST_VERIFICA_COMPLETA.md](docs/CHECKLIST_VERIFICA_COMPLETA.md) sezione **B**.
- **RLS / Advisor:** allinea policy alle migrazioni recenti (es. `20260324160000_*`, `20260324170000_*`) così PostgREST con chiave anon non riceve 401/403 inattesi.
- **Realtime:** l’app (`src/lib/database.ts`) si iscrive a `postgres_changes` su queste tabelle — devono essere nella publication **`supabase_realtime`**:  
  `shifts`, `users`, `punch_records`, `holiday_requests`, **`app_settings_sync_signal`**.  
  Se manca una tabella, i client non si aggiornano in tempo reale (restano pull manuali / ritorno in app).
- **Storage** bucket `app-config` (e policy): [docs/SUPABASE_STORAGE_APP_CONFIG.md](docs/SUPABASE_STORAGE_APP_CONFIG.md).
- Se usi **Supabase Auth**, configura email/dominio; l’app al momento usa solo PIN su tabella `users`.
- Edge function **`send-holiday-notification`** se usi notifiche mail da lì.

### 1.3 Build locale

```bash
npm install
npm run build
```

- **Config Vite:** ufficiale in `scripts/vite.config.mjs`. Gli script `npm run dev` / `build` / `preview` la passano già; **non** usare `npx vite` senza `--config scripts/vite.config.mjs` (evita errori su timestamp/cache in root in alcuni ambienti).
- Se il build va a buon fine, l’app è pronta per il deploy.
- Controlla che non ci siano errori in console (TypeScript, ESLint).

### 1.4 Anteprima build

```bash
npm run preview
```

Apri l’URL indicato (es. `http://localhost:4173`) e prova login, turni, ferie, report. Verifica che tutto funzioni con l’URL e le variabili che userai in produzione.

---

## 2. Pubblicare online (hosting)

L’app è una **SPA** (Vite + React). Output: cartella **`dist`**. Config ufficiale: **`vercel.json`** (rewrite SPA, cache su `/assets/*`, no-cache su `index.html`).

### Opzione A – Vercel (hosting attuale)

1. Account su [vercel.com](https://vercel.com) → **Add New** → **Project** → importa il repo Git.
2. Vercel rileva **Vite**; conferma:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. **Environment Variables** (Settings → Environment Variables), per **Production** (e Preview se serve):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (o `VITE_SUPABASE_PUBLISHABLE_KEY` se usi quella chiave nel progetto)
   - (opzionale) `VITE_GEMINI_API_KEY`
4. **Deploy**. URL tipo `https://xxx.vercel.app`. Dominio personalizzato: Project → **Domains**.

**Deploy da CLI** (dopo `npm i -g vercel` o `npx vercel` e login):

```bash
npm run deploy
```

Equivalente a: `npm run build && npx vercel --prod --yes`  
La prima volta: `npx vercel link` per collegare la cartella al progetto.

#### Netlify (deprecato)

Il progetto **osteria-basilico** su Netlify è stato **eliminato** (hosting solo Vercel). Se in futuro avessi un altro sito Netlify da rimuovere: [app.netlify.com](https://app.netlify.com) → sito → **Site configuration** → **Delete site**.

#### Supabase — URL di produzione (da fare una volta in dashboard)

L’app in produzione è su **`https://osteria-basilico-app.vercel.app`** (alias Vercel). In **Supabase Dashboard** → **Authentication** → **URL Configuration**:

- **Site URL**: `https://osteria-basilico-app.vercel.app` (o il tuo dominio custom)
- **Redirect URLs**: includi la stessa URL e eventuali path wildcard se usi flussi OAuth/email (es. `https://osteria-basilico-app.vercel.app/**`)

*(La CLI `supabase` non è collegata qui; senza `supabase login` va aggiornato a mano.)*

---

### Opzione B – Cloudflare Pages (alternativa statica)

Stessi comandi di build; in `dist` è incluso `public/_redirects` per le route SPA. Vedi [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages.

---

### Opzione C – Server proprio (Nginx, ecc.)

- `npm run build` → servi **`dist`** con rewrite SPA (tutte le route → `index.html`).
- Stesse variabili d’ambiente in fase di build (Vite le inietta al compile time).

---

## 3. Dopo il deploy

1. **Test completo** sull’URL di produzione: login con PIN, turni, modifica orari, pubblicazione, ferie, report, sync.
2. **Link condiviso**: invia il link (es. `https://tuoprogetto.vercel.app` o dominio personalizzato) ai dipendenti.
3. **HTTPS**: Vercel lo fornisce di default; con dominio proprio configura il certificato in Project → Domains.
4. **Backup**: Supabase fa backup; verifica in Supabase Dashboard le impostazioni di backup del progetto.

---

## 4. Riepilogo comandi utili

| Azione | Comando |
|--------|--------|
| Avvio in sviluppo | `npm run dev` |
| Build produzione | `npm run build` |
| Anteprima build | `npm run preview` |
| Controllo tipi | `npm run typecheck` |
| Lint | `npm run lint` |
| Deploy produzione (Vercel) | `npm run deploy` |
| Deploy Cloudflare Pages (alternativa) | `npm run build` → `npx wrangler pages deploy dist --project-name=...` |

---

## 5. Checklist finale

- [ ] Repository Git con `main` e remoto (GitHub/GitLab) collegato a Vercel se usi deploy da push
- [ ] Progetto Supabase creato e migrazioni eseguite
- [ ] **Realtime:** le cinque tabelle in §1.2 presenti in `supabase_realtime`
- [ ] Variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` **oppure** `VITE_SUPABASE_PUBLISHABLE_KEY` in produzione (Vercel → Environment Variables)
- [ ] `npm run build` eseguito senza errori
- [ ] `npm run preview` testato con le stesse variabili
- [ ] Deploy su Vercel (o altro host) con variabili d’ambiente
- [ ] Test su URL di produzione (login, turni, ferie, report)
- [ ] Checklist estesa operativa: [docs/CHECKLIST_VERIFICA_COMPLETA.md](docs/CHECKLIST_VERIFICA_COMPLETA.md)
- [ ] (Opzionale) Dominio personalizzato e HTTPS
- [ ] (Opzionale) `VITE_GEMINI_API_KEY` se usi Scan Foto turni

Una volta completati questi passi, l’app può essere considerata ufficiale e pubblicata per l’uso quotidiano.
