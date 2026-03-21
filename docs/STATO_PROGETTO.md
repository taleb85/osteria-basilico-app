# Stato progetto (riferimento rapido)

Repository pubblico: **[github.com/taleb85/osteria-basilico-app](https://github.com/taleb85/osteria-basilico-app)** · Produzione: **https://osteria-basilico-app.vercel.app**

| Voce | Stato |
|------|--------|
| Codice su `main` + `origin` | OK — `main` allineato con GitHub |
| Lint / TypeScript / build locale | OK (`npm run lint`, `typecheck`, `build`) |
| CI GitHub Actions | OK su ogni push/PR — workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| Deploy Vercel | OK — deploy da CLI (`npm run deploy`) o da Git se il progetto è collegato al repo |
| Vercel ↔ GitHub | Collegamento configurato (repo connesso al progetto); dettagli in [CONNESSIONE_GIT_VERCEL.md §3](./CONNESSIONE_GIT_VERCEL.md) |
| Variabili `VITE_*` su Vercel | Da verificare in dashboard → Settings → Environment Variables (non controllabile da qui) |
| Supabase (URL produzione, RLS) | Checklist in [DEPLOY.md](../DEPLOY.md) — verifica manuale in dashboard Supabase |
| Verifica “tutto” passo-passo | [CHECKLIST_VERIFICA_COMPLETA.md](./CHECKLIST_VERIFICA_COMPLETA.md) |
