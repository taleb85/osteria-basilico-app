# Setup Produzione - Osteria Basilico

## Reset Totale e Primo Giorno

### 1. Reset produzione (cancella tutto)

Elimina tutti i turni, timbrature e richieste ferie. Disattiva utenti Test/Guest.

```bash
npm run reset:production
```

### 2. Creare turni di oggi (17:00-00:00)

Crea turni per la data odierna per tutti i dipendenti attivi (escluso admin).

```bash
npm run seed:today
```

### Requisiti

- File `.env` con `VITE_SUPABASE_URL` e `VITE_SUPABASE_SERVICE_ROLE_KEY`
- Dipendenti già presenti nel database (attivi, con PIN)

### Ordine consigliato

1. `npm run reset:production`
2. `npm run seed:today`
3. Avvia l'app e verifica il Kiosk
