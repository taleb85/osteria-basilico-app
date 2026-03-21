# Stato progetto (riferimento rapido)

| Voce | Stato |
|------|--------|
| Codice sorgente e commit su `main` | OK (repo Git **locale**) |
| `origin` / push su GitHub | OK se `origin` punta al repo remoto e `main` è allineato |
| Deploy produzione Vercel | OK — alias tipico **https://osteria-basilico-app.vercel.app** (`npm run deploy` o deploy da Git se collegato) |
| Vercel ↔ GitHub (deploy automatici) | **Da completare in dashboard** se serve: Account/Team → connessione GitHub, poi Project → Settings → Git → Connect repository (vedi [CONNESSIONE_GIT_VERCEL.md §3](./CONNESSIONE_GIT_VERCEL.md)) |
| CI (typecheck, lint, build) | Workflow `.github/workflows/ci.yml` su ogni push/PR su `main` — controlla il tab **Actions** su GitHub |
| Variabili `VITE_*` su Vercel | Verifica in dashboard progetto → Settings → Environment Variables |
| Supabase URL produzione | Verifica Site URL / Redirect in Authentication → [DEPLOY.md](../DEPLOY.md) |
