# Design: risoluzione conflitti e prevenzione perdita dati

Contesto: app multi-dispositivo (Realtime Supabase, refresh silenzioso, config su Storage con revisione). Oggi le `UPDATE` sono **last-write-wins** (nessun `version` / `updated_at` obbligatorio lato client).

Obiettivo: **nessuna sovrascrittura silenziosa** di modifiche più recenti sul server; conflitti **visibili**, **ripetibili** e **auditabili**.

---

## 1. Modello di conflitto

Un conflitto si dichiara quando:

- Il client invia una modifica basata su uno **snapshot** del record che **non coincide** più con lo stato sul DB (stesso `id`, campi diversi).
- Oppure due writer aggiornano entro una finestra temporale campi che la policy considera **incompatibili** (es. uno elimina, l’altro modifica).

Non è conflitto (o si gestisce diversamente):

- **Insert** di nuove righe (id diversi).
- **Delete**: vedi §6.

---

## 2. Livello A — Controllo di concorrenza ottimistico (DB + API)

Per ogni tabella ad alto rischio (`shifts`, `users`, `holiday_requests`, `punch_records` dove applicabile):

1. Aggiungere **`row_version`** `integer NOT NULL DEFAULT 1` (o **`updated_at`** `timestamptz` gestito da trigger).
2. Ogni `SELECT` usato per form di modifica include `row_version` (o `updated_at`).
3. Ogni `UPDATE` invia il valore atteso:
   - `.eq('id', id).eq('row_version', expectedVersion)`  
   - oppure `.eq('id', id).eq('updated_at', expectedUpdatedAt)` con precisione sufficiente.
4. Se `affected rows === 0` (o risposta PostgREST che indica nessun match): **conflitto** — non applicare patch locale come verità.

**Vantaggio:** il DB è fonte di verità; niente merge fantasma lato solo client.

**Estensione:** RPC Postgres `update_shift_if_version(...)` che in un’unica transazione incrementa `row_version` e applica patch; ritorna `ok | conflict | not_found`.

---

## 3. Livello B — Policy per entità (cosa fare al conflitto)

| Entità | Policy suggerita | Motivo |
|--------|------------------|--------|
| **Turno (`shifts`)** | Bloccare save; mostrare diff **server vs client**; azioni: *Ricarica e perdi bozza locale*, *Applica solo i miei campi* (merge per campo se non toccati sul server), *Sovrascrivi* (solo ruolo con permesso + conferma + log). | Orari/note critici; già avete stati `draft` / `approved` / `confirmed`. |
| **Utente (`users`)** | Idem con merge conservativo: campi “sicuri” (lingua, tema) mergeabile; permessi e PIN solo con version match o flusso admin. | Riduce attrito su preferenze UI. |
| **Richieste ferie** | Conflitto su `status`: **mai** LWW silenzioso — mostrare stato server e chi ha approvato. | Evita revoche perse. |
| **Timbrature (`punch_records`)** | Preferire **append-only** per correzioni (già avete audit); update distruttivo solo con version + audit. | Tracciabilità legale/operativa. |
| **Config Storage** | Già orientati a revisione globale; mantenere **bump revision** dopo write e **ack** lato client (come oggi). | Allineato al modello attuale. |

**Turni approvati / congelati:** se `approval_status` è `approved` e policy lo richiede, rifiutare qualsiasi update senza flusso esplicito (PIN / sblocco) **e** stesso `row_version` coerente.

---

## 4. Livello C — UX

1. **Toast + modal “Dati aggiornati altrove”** con tabella diff (campo, valore tuo, valore server).
2. **Pulsanti:** *Usa versione server* (reset form), *Riprova dopo aver copiato le mie modifiche*, *Sovrascrivi* (se permesso).
3. **Realtime:** alla ricezione `UPDATE` sulla riga aperta in editor, **banner non bloccante** “Qualcuno ha modificato questo turno” + opzione ricarica riga.
4. **Offline / sync ritardato:** alla riconnessione, code di write con `(id, baseVersion, payload)`; se conflitto, mettere in **coda utente** invece di scartare.

---

## 5. Livello D — Audit e ripristino

- Ogni **sovrascrittura forzata** logga: `user_id`, `target_table`, `row_id`, `before` (jsonb), `after` (jsonb), `reason` testuale.
- Riutilizzare / estendere pattern tipo `punch_audit_log` e `scheduleHistory` dove già presenti.

---

## 6. Delete vs Update

- **Hard delete** remoto mentre il client modifica: `UPDATE` fallisce (riga assente) → messaggio chiaro “Turno eliminato su un altro dispositivo”.
- Opzionale: **soft delete** (`deleted_at`) per consentire “annulla eliminazione” e ridurre perdite; query default `WHERE deleted_at IS NULL`.

---

## 7. Rollout consigliato

1. Migrazione `row_version` (o `updated_at` + trigger) + esporre in API/types.
2. Path **read-only** prima: mostrare versione in dev / log conflitti simulati.
3. Sostituire `database.shifts.update` (e analoghi) con helper `updateWithVersion` che mappa `409`-equivalente a errore applicativo.
4. UI modal solo per `shifts` e `holiday_requests`; poi estendere.

---

## 8. Fuori scope (per ora)

- CRDT / merge automatico su testo libero (note).
- Sync peer-to-peer senza DB.

Questo documento è intenzionalmente **progettuale**: l’implementazione va allineata a RLS e policy Supabase esistenti.
