# Osteria Basilico — App

Applicazione web (React, Vite, Supabase) per turni, ferie, presenze e gestione staff.

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

## Repository Git (primo push)

Se il remoto non è ancora collegato:

```bash
git remote add origin <URL-del-tuo-repo>
git push -u origin main
```

Su Vercel, collega lo stesso repository: **Build Command** `npm run build`, **Output Directory** `dist`.

## Altri comandi

| Comando | Uso |
|--------|-----|
| `npm run typecheck` | Controllo TypeScript |
| `npm run lint` | ESLint |
| `npm run deploy` | Build + deploy produzione Vercel (richiede CLI / progetto collegato) |

Documentazione aggiuntiva: cartella `docs/` e file markdown in root (sicurezza, RLS, mail, ecc.).
