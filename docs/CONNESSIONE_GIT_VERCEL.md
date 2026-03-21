# Connessione Git + Vercel (checklist)

Passi da fare **una volta** sul tuo computer o dopo aver creato il repository remoto.

## 1. Identità Git (commit con nome e email corretti)

Se Git avvisa che nome/email non sono configurati:

```bash
cd /percorso/Osteria_Basilico_Final

# Solo questo repo (consigliato)
git config user.name "Il Tuo Nome"
git config user.email "tua-email@esempio.com"

# Oppure globalmente su tutta la macchina
git config --global user.name "Il Tuo Nome"
git config --global user.email "tua-email@esempio.com"
```

Su GitHub puoi usare l’email **noreply** (Impostazioni → Email): così non esponi l’email reale nei commit.

## 2. Repository remoto (GitHub o altro)

1. Crea un repository **vuoto** sul provider (senza README/licenza se hai già commit locali).
2. Collega `origin` e invia `main` — **in un comando** (dalla root del progetto):

```bash
bash scripts/git-remote-push.sh https://github.com/TUO_UTENTE/TUO_REPO.git
```

Equivalente manuale:

```bash
git remote add origin https://github.com/TUO_UTENTE/TUO_REPO.git
git push -u origin main
```

Se `origin` esiste già con URL sbagliato:

```bash
git remote set-url origin https://github.com/TUO_UTENTE/TUO_REPO.git
git push -u origin main
```

## 3. Vercel collegato al repo

### 3.0 Collegare GitHub all’account Vercel (obbligatorio una volta)

Se `vercel git connect` risponde con *«You need to add a Login Connection to your GitHub account first»*:

1. Vai su [Vercel Dashboard](https://vercel.com/dashboard) → **Account Settings** (o impostazioni del team) → sezione **Login Connections** / integrazioni GitHub.
2. Collega **GitHub** e autorizza Vercel ad accedere ai repository (come da [documentazione Vercel sulle connessioni](https://vercel.com/docs/accounts/create-an-account#login-methods-and-connections)).

Senza questo passo, Vercel non può importare né collegare il repo.

### 3.1 Collegare il progetto al repository

**Da dashboard (consigliato se il progetto esiste già):**

1. Apri il progetto (es. **osteria-basilico-app**) → **Settings** → **Git**.
2. **Connect Git Repository** → scegli il repo (es. `TUO_UTENTE/osteria-basilico-app`).
3. Conferma branch di produzione (**main**) e deploy.

**Da terminale** (dopo il passo 3.0, dalla root del progetto collegata con `vercel link`):

```bash
npx vercel git connect https://github.com/TUO_UTENTE/TUO_REPO.git
```

### 3.2 Build e variabili

1. **Build Command:** `npm run build`  
   **Output Directory:** `dist`  
   (di solito coincide con `vercel.json`.)
2. **Environment Variables** (Production, e Preview se serve):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (o `VITE_SUPABASE_PUBLISHABLE_KEY` se usi quella nel progetto)
   - opzionale: `VITE_GEMINI_API_KEY`

Se importi come **nuovo** progetto da **Add New → Project**, Vercel crea il collegamento Git in un solo flusso (dopo aver autorizzato GitHub).

## 4. Supabase URL di produzione

In Supabase → **Authentication** → **URL Configuration**, imposta **Site URL** e **Redirect URLs** con l’URL Vercel (o dominio custom). Dettagli in [DEPLOY.md](../DEPLOY.md).

## 5. CI su GitHub

Con push su `main` o pull request, il workflow **CI** (`.github/workflows/ci.yml`) esegue `typecheck`, `lint` e `build`. Non servono secret per la build se le variabili Vite non sono obbligatorie a compile-time nel tuo setup attuale.
