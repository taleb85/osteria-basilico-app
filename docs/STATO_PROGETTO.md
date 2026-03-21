# Stato progetto (riferimento rapido)

| Voce | Stato |
|------|--------|
| Codice sorgente e commit su `main` | OK (repo Git **locale**) |
| `origin` / push su GitHub | **Da fare** sul tuo Mac: vedi [CONNESSIONE_GIT_VERCEL.md](./CONNESSIONE_GIT_VERCEL.md) o `bash scripts/git-remote-push.sh <URL>` |
| Deploy produzione Vercel | OK — alias tipico **https://osteria-basilico-app.vercel.app** (aggiorna con `npm run deploy` quando serve) |
| CI (typecheck, lint, build) | Attiva dopo il push su GitHub (workflow `.github/workflows/ci.yml`) |
| Variabili `VITE_*` su Vercel | Verifica in dashboard progetto → Settings → Environment Variables |
| Supabase URL produzione | Verifica Site URL / Redirect in Authentication → [DEPLOY.md](../DEPLOY.md) |
