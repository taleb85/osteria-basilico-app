# FLOW API v1 — Documentazione

Base URL: `https://{SUPABASE_URL}/functions/v1/api-v1`

## Autenticazione

Tutte le richieste richiedono:
- Header `x-tenant-id`: ID del tenant (sede/ristorante)
- Header `Authorization: Bearer {API_KEY}`

Per ottenere una API key, contatta l'amministratore del tenant o il supporto FLOW.

---

## Endpoints

### GET /api/v1/users
Restituisce l'elenco dei dipendenti.

```json
[
  {
    "id": "uuid",
    "first_name": "MARIO",
    "last_name": "ROSSI",
    "email": "mario@example.com",
    "role": "waiter",
    "status": "active",
    "department": "sala",
    "hourly_rate_eur": 12.50
  }
]
```

### POST /api/v1/users
Crea un nuovo dipendente.

Body:
```json
{
  "first_name": "MARIO",
  "last_name": "ROSSI",
  "email": "mario@example.com",
  "role": "waiter",
  "pin": "1234",
  "department": "sala"
}
```

### GET /api/v1/shifts?start_date=2026-05-01&end_date=2026-05-31
Restituisce i turni in un intervallo di date.

### POST /api/v1/shifts
Crea un nuovo turno.

Body:
```json
{
  "user_id": "uuid",
  "date": "2026-05-10",
  "start_time": "10:00",
  "end_time": "16:00",
  "type": "lunch",
  "department": "sala"
}
```

### GET /api/v1/punch-records?user_id=uuid&start_date=2026-05-01
Restituisce le timbrature, opzionalmente filtrate per utente e data.

### GET /api/v1/holidays
Restituisce tutte le richieste ferie/assenze.

### GET /api/v1/export?type=timesheets&start_date=2026-05-01
Esporta i dati timesheet in formato JSON.

---

## Tipi di dato

### Ruoli (role)
`admin`, `manager`, `assistant_manager`, `waiter`, `server`, `bartender`, `cook`, `chef`, `dishwasher`

### Stati turno (approval_status)
`draft`, `confirmed`, `approved`, `absent`

### Stati ferie (status)
`pending`, `approved`, `rejected`

### Tipi ferie (type)
`ferie`, `permesso`, `indisponibilita`

---

## Webhook eventi (Slack/Teams)

FLOW può inviare notifiche webhook su eventi:
- `shift.created` — Nuovo turno creato
- `shift.updated` — Turno modificato
- `shift.published` — Turni pubblicati
- `punch.created` — Timbratura registrata
- `holiday.created` — Richiesta ferie inviata
- `holiday.approved` — Richiesta ferie approvata/rifiutata

Configura l'URL del webhook nelle impostazioni Admin del tuo tenant.
