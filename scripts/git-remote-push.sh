#!/usr/bin/env bash
# Collega origin (se manca) e fa push di main. Uso:
#   bash scripts/git-remote-push.sh https://github.com/TUO_UTENTE/TUO_REPO.git
# Prerequisiti: repo GitHub vuoto creato; git user.name / user.email configurati; auth HTTPS o SSH ok.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

URL="${1:-}"
if [[ -z "$URL" ]]; then
  echo "Uso: $0 <URL-del-repo>"
  echo "Esempio: $0 https://github.com/mio-utente/osteria-basilico.git"
  exit 1
fi

if git remote get-url origin >/dev/null 2>&1; then
  CURRENT="$(git remote get-url origin)"
  if [[ "$CURRENT" != "$URL" ]]; then
    echo "origin è già impostato su: $CURRENT"
    echo "Per sostituirlo: git remote set-url origin $URL"
    exit 1
  fi
  echo "origin già corretto: $URL"
else
  git remote add origin "$URL"
  echo "Aggiunto origin: $URL"
fi

git push -u origin main
echo "Fatto: main su origin."
