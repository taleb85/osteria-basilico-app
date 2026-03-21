# Osteria Basilico — App

Applicazione web (React, Vite, Supabase) per turni, ferie, presenze e gestione staff.

**Repository:** [github.com/taleb85/osteria-basilico-app](https://github.com/taleb85/osteria-basilico-app) · **Produzione:** [osteria-basilico-app.vercel.app](https://osteria-basilico-app.vercel.app)

## Prerequisiti

- Node.js 18+
- Progetto Supabase: copia `.env.example` in `.env` e inserisci URL e chiave anon (il file `.env` non va mai committato).

## Sviluppo

```bash
npm install
npm run dev
```

**Vite:** la configurazione ufficiale è `scripts/vite.config.mjs`. Usa sempre gli script `npm` (`dev`, `build`, `preview`); non avviare `vite` o `npx vite` senza `--config scripts/vite.config.mjs`, per evitare problemi di build su alcuni ambienti.

## Build e deploy

- Build: `npm run build` → output in `dist`
- Anteprima locale: `npm run preview`
- Pubblicazione su Vercel e checklist: **[DEPLOY.md](./DEPLOY.md)**

## Repository Git e Vercel

Istruzioni passo-passo (identità Git, `remote`, push, variabili Vercel, Supabase): **[docs/CONNESSIONE_GIT_VERCEL.md](./docs/CONNESSIONE_GIT_VERCEL.md)**.

Sintesi se il remoto non è ancora collegato (dopo aver creato il repo vuoto su GitHub):

```bash
bash scripts/git-remote-push.sh https://github.com/TUO_UTENTE/TUO_REPO.git
```

Su Vercel: importa lo stesso repository; **Build Command** `npm run build`, **Output Directory** `dist`. Su ogni push su `main`, la **CI** su GitHub esegue typecheck, lint e build (vedi `.github/workflows/ci.yml`).

## Altri comandi

| Comando | Uso |
|--------|-----|
| `npm run typecheck` | Controllo TypeScript |
| `npm run lint` | ESLint |
| `npm run deploy` | Build + deploy produzione Vercel (richiede CLI / progetto collegato) |

Documentazione aggiuntiva: cartella `docs/` e file markdown in root (sicurezza, RLS, mail, ecc.). Riepilogo cosa è fatto / cosa resta: **[docs/STATO_PROGETTO.md](./docs/STATO_PROGETTO.md)**.
