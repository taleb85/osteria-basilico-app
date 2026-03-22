# Checklist verifica completa (produzione)

Usala **in ordine**. Non incollare mai in chat **chiavi, token o `.env`**: se serve aiuto, manda solo **esito** (ok / errore), **nomi** delle variabili presenti, o screenshot con valori oscurati.

**URL di riferimento produzione:** `https://osteria-basilico-app.vercel.app`  
**Repo:** [taleb85/osteria-basilico-app](https://github.com/taleb85/osteria-basilico-app)

---

## A — Vercel (progetto collegato a GitHub)

1. **Project → Settings → Git**  
   - [ ] Repository corretto (`osteria-basilico-app`).  
   - [ ] Branch produzione: `main`.

2. **Settings → General → Build & Development**  
   - [ ] Build Command: `npm run build`  
   - [ ] Output Directory: `dist`  
   - [ ] Framework / override coerenti con `vercel.json` (se presente).

3. **Settings → Environment Variables** (almeno **Production**)

   Obbligatorie per il frontend (Vite le legge in **build**):

   | Nome | Presente? (sì/no) | Note |
   |------|-------------------|------|
   | `VITE_SUPABASE_URL` | | URL progetto Supabase |
   | `VITE_SUPABASE_ANON_KEY` **oppure** `VITE_SUPABASE_PUBLISHABLE_KEY` | | Una sola delle due se il codice la risolve (vedi `src/lib/supabase.ts`) |

   Opzionali (solo se le usi):

   | Nome | Presente? |
   |------|-----------|
   | `VITE_GEMINI_API_KEY` | Scan foto turni |
   | `VITE_ALLOW_BROWSER_APP` | Solo se serve bypass PWA in browser su dominio produzione (temporaneo) |
   | `VITE_RESTAURANT_LAT` / `VITE_RESTAURANT_LNG` / `VITE_GEOFENCE_RADIUS_M` | Geofence senza config su Storage |
   | `VITE_APP_CONFIG_STORAGE_ENABLED` | Se disabiliti lettura config da Storage |

   **Non** impostare su Vercel (build client) la **service role** come variabile `VITE_*`: è pericolosa se finisse nel bundle. Per script locali vedi `.env.example`.

4. **Deployments**  
   - [ ] Ultimo deploy **Ready** su `main`.  
   - [ ] Nessun errore di build recente (log deploy).

5. **Domains** (se usi dominio proprio)  
   - [ ] DNS e certificato OK in dashboard Vercel.

---

## B — Supabase (stesso progetto puntato da `VITE_SUPABASE_URL`)

1. **Authentication → URL Configuration**  
   - [ ] **Site URL** = `https://osteria-basilico-app.vercel.app` (o il tuo dominio custom ufficiale).  
   - [ ] **Redirect URLs** includono quell’URL (es. `https://osteria-basilico-app.vercel.app/**` se usi flussi che lo richiedono).

2. **Project Settings → API**  
   - [ ] La **anon public** key in Vercel corrisponde a **questo** progetto (controllo umano: confronto in dashboard, non in chat).

3. **Database → Migrations / SQL**  
   - [ ] Tutte le migrazioni in `supabase/migrations/` applicate su questo DB (o equivalente).  
   - [ ] Edge function `send-holiday-notification` deployata se usi notifiche mail da lì.

4. **RLS e sicurezza (controllo consigliato)**  
   - [ ] In **Table Editor** o **SQL**: verifica che le tabelle usate dall’app abbiano policy coerenti con come l’app chiama PostgREST (anon key + sessione custom).  
   - [ ] Documentazione interna: `RLS_POLICIES_DOCUMENTATION.md`, `SECURITY_NOTES.md`.

5. **Storage** (se usi `app-config` / geofence in Storage)  
   - [ ] Bucket e policy come in `docs/SUPABASE_STORAGE_APP_CONFIG.md`.

6. **Realtime (aggiornamenti tra dispositivi senza refresh)**  
   L’app si iscrive ai cambiamenti su `shifts`, `users`, `holiday_requests`, `punch_records`. In Supabase: **Database → Replication** → le tabelle usate devono essere nella publication Realtime.  
   **Dati su Storage** (`app-config`: template ruoli, feature flags, …): non passano da Realtime; l’app li riallinea al **ritorno in primo piano**, al **pull-to-refresh**, al cambio tab in **gestione**, e in **Area admin** (vedi codice: throttle ~5s + pull forzato a foreground). Se PC e telefono sembrano diversi, verifica bucket/policy in `docs/SUPABASE_STORAGE_APP_CONFIG.md`.  
   **Background Sync** (Chrome/Edge/Android): in **offline** viene registrato un sync one-shot; alla **riconnessione** il service worker può risvegliarsi e far partire un refresh dati (`silentRefreshData` + Storage) sulle finestre ancora aperte — su Safari iOS non è disponibile; restano foreground/online già gestiti dall’app.

---

## C — App live (browser, dati reali o di test)

Apri `https://osteria-basilico-app.vercel.app` (o dominio custom).

1. **Caricamento**  
   - [ ] Pagina principale senza schermata bianca.  
   - [ ] DevTools → **Console**: nessun errore rosso critico all’avvio.  
   - [ ] **Network**: richieste a `*.supabase.co` con stato 2xx (non 401 ripetuti infiniti).

2. **Login (PIN)**  
   - [ ] Login con utente di test.  
   - [ ] Logout / cambio utente se applicabile.

3. **Flussi core** (spunta ciò che usate in produzione)  
   - [ ] Turni (vista staff / gestione).  
   - [ ] Presenze / timesheet (se abilitato).  
   - [ ] Ferie / richieste (se abilitato).  
   - [ ] Impostazioni admin (solo profilo autorizzato).  
   - [ ] PWA: installazione o gate come previsto (senza `VITE_ALLOW_BROWSER_APP` la PWA può essere richiesta su produzione).

4. **Scan foto / Gemini** (solo se abilitato)  
   - [ ] Funziona o fallisce con messaggio chiaro se manca la chiave.

---

## D — Repository e CI (già automatizzabili)

- [ ] Tab **Actions** su GitHub: ultimo workflow **CI** su `main` verde.  
- [ ] In locale: `npm run lint`, `npm run typecheck`, `npm run build` ok.

---

## Cosa puoi incollare all’assistente (senza segreti)

- Elenco: «Su Vercel Production ho: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` → sì/no».  
- «Site URL Supabase è impostato su …» (solo dominio pubblico, ok).  
- Messaggio di errore **testuale** dal browser o da Network (senza header `Authorization`).  
- Screenshot con valori oscurati.

---

## Riferimenti nel repo

- Deploy e checklist generale: [DEPLOY.md](../DEPLOY.md)  
- Git + Vercel: [CONNESSIONE_GIT_VERCEL.md](./CONNESSIONE_GIT_VERCEL.md)  
- Stato sintetico: [STATO_PROGETTO.md](./STATO_PROGETTO.md)  
- Variabili esempio: [`.env.example`](../.env.example)  
- **Sincronizzazione multi-dispositivo (QA manuale):** [SYNC_VERIFICATION_CHECKLIST.md](./SYNC_VERIFICATION_CHECKLIST.md)
