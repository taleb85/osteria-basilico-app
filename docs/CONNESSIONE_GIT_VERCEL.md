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
2. Collega e invia `main`:

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

1. [Vercel](https://vercel.com) → **Add New** → **Project** → importa il repository.
2. **Build Command:** `npm run build`  
   **Output Directory:** `dist`  
   (di solito coincide con `vercel.json`.)
3. **Environment Variables** (Production, e Preview se serve):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (o `VITE_SUPABASE_PUBLISHABLE_KEY` se usi quella nel progetto)
   - opzionale: `VITE_GEMINI_API_KEY`
4. Deploy. Il progetto già esistente **`osteria-basilico-app`** può essere **ricollegato** al nuovo Git da Project → Settings → Git (in alternativa a creare un progetto nuovo).

## 4. Supabase URL di produzione

In Supabase → **Authentication** → **URL Configuration**, imposta **Site URL** e **Redirect URLs** con l’URL Vercel (o dominio custom). Dettagli in [DEPLOY.md](../DEPLOY.md).

## 5. CI su GitHub

Con push su `main` o pull request, il workflow **CI** (`.github/workflows/ci.yml`) esegue `typecheck`, `lint` e `build`. Non servono secret per la build se le variabili Vite non sono obbligatorie a compile-time nel tuo setup attuale.
