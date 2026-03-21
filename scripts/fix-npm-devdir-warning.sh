#!/bin/sh
# Rimuove il warning "Unknown env config devdir" da npm.
# Esegui: ./scripts/fix-npm-devdir-warning.sh
set -e
npm config delete devdir 2>/dev/null || true
# Se il warning persiste, NPM_CONFIG_DEVDIR è impostata dall'ambiente (es. Cursor).
# Soluzione: aggiungi al tuo ~/.zshrc la riga:
#   unset NPM_CONFIG_DEVDIR 2>/dev/null
# Oppure esegui prima di ogni sessione: unset NPM_CONFIG_DEVDIR
echo "Config npm aggiornata."
echo "Se il warning persiste, aggiungi a ~/.zshrc: unset NPM_CONFIG_DEVDIR 2>/dev/null"
