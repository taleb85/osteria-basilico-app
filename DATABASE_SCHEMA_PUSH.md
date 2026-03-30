# Database Schema - Push Subscriptions

## Opzione 1: Colonne nella tabella `user_preferences` (Consigliato)

Aggiungi queste colonne alla tabella `user_preferences` esistente:

```sql
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS push_subscription_endpoint TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS push_subscription_p256dh TEXT,
ADD COLUMN IF NOT EXISTS push_subscription_auth TEXT,
ADD COLUMN IF NOT EXISTS push_subscription_created_at TIMESTAMP DEFAULT now(),
ADD COLUMN IF NOT EXISTS push_subscription_enabled BOOLEAN DEFAULT true;

-- Crea un indice per velocizzare le query
CREATE INDEX IF NOT EXISTS idx_user_push_enabled 
ON user_preferences(user_id, push_subscription_enabled) 
WHERE push_subscription_enabled = true;
```

**Vantaggi:**
- Una sola tabella per le preferenze utente
- Relazione 1:1 con l'utente
- Più semplice per query e joins

**Svantaggi:**
- Un utente può avere una sola subscription

## Opzione 2: Tabella Dedicata `push_subscriptions` (Scalabile)

Crea una tabella separata se un utente potrebbe avere più dispositivi:

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT, -- Optional: "iPhone 13", "Android Phone", etc.
  endpoint TEXT NOT NULL,
  p256dh BYTEA NOT NULL,
  auth BYTEA NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  last_used_at TIMESTAMP DEFAULT now(),
  enabled BOOLEAN DEFAULT true,
  
  -- Vincolo: ogni subscription è unica per endpoint (non per utente)
  UNIQUE(endpoint)
);

-- Indici per performance
CREATE INDEX idx_user_push_subscriptions ON push_subscriptions(user_id);
CREATE INDEX idx_push_enabled ON push_subscriptions(enabled);
CREATE INDEX idx_push_user_enabled 
ON push_subscriptions(user_id, enabled) 
WHERE enabled = true;
```

**Vantaggi:**
- Un utente può avere più dispositivi iscritti
- Storico di creazione/ultimo utilizzo
- Nome del dispositivo per identificarlo

**Svantaggi:**
- Più complesso
- Necessita di pulizia periodica (subscriptions scadute)

## RLS Policies (Row-Level Security)

Aggiungi politiche di sicurezza per proteggere i dati:

```sql
-- Abilita RLS sulla tabella
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Utenti possono vedere solo le loro proprie subscriptions
CREATE POLICY "Users can view their own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- Utenti possono aggiungere nuove subscriptions
CREATE POLICY "Users can insert their own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

-- Utenti possono aggiornare le loro subscriptions
CREATE POLICY "Users can update their own push subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid()::text = user_id::text);

-- Utenti possono cancellare le loro subscriptions
CREATE POLICY "Users can delete their own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Admin possono vedere tutte le subscriptions
CREATE POLICY "Admins can view all push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::uuid
      AND users.role = 'admin'
    )
  );
```

## Struttura Dati della Subscription

La subscription salvata nel database contiene:

```typescript
interface PushSubscription {
  endpoint: string;        // URL univoco fornito dal browser
  keys: {
    p256dh: string;        // Base64-encoded public key
    auth: string;          // Base64-encoded auth token
  };
  created_at: Date;
  enabled: boolean;
}
```

**Esempio:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/cOUXXXXXXXX...",
  "keys": {
    "p256dh": "BMfXXXXXXXXXXXXXXXXXXXXXXXXXXXXX...",
    "auth": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  },
  "created_at": "2026-03-29T10:30:00Z",
  "enabled": true
}
```

## Query Comuni

### Recupera tutte le subscriptions attive di un utente

```sql
-- Opzione 1: da user_preferences
SELECT push_subscription_endpoint, push_subscription_p256dh, push_subscription_auth
FROM user_preferences
WHERE user_id = $1 AND push_subscription_enabled = true;

-- Opzione 2: da push_subscriptions
SELECT endpoint, p256dh, auth
FROM push_subscriptions
WHERE user_id = $1 AND enabled = true;
```

### Invia notifica a un utente specifico

```sql
SELECT u.email, ps.endpoint, ps.p256dh, ps.auth
FROM users u
LEFT JOIN push_subscriptions ps ON u.id = ps.user_id
WHERE u.id = $1 AND ps.enabled = true;
```

### Rimuovi subscription scaduta (410 Gone)

```sql
DELETE FROM push_subscriptions
WHERE endpoint = $1;
```

### Conta subscriptions attive per statistiche

```sql
SELECT COUNT(*) as total_subscribed
FROM push_subscriptions
WHERE enabled = true;
```

## Manutenzione

### Pulizia periodica (script cron)

```typescript
// Rimuovi subscriptions inattive da più di 30 giorni
async function cleanupInactiveSubscriptions() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await db.pushSubscriptions.deleteWhere({
    last_used_at: { $lt: thirtyDaysAgo },
    enabled: false,
  });
}

// Esegui ogni notte
schedule.scheduleJob('0 2 * * *', cleanupInactiveSubscriptions);
```

### Aggiorna `last_used_at` quando si invia una notifica

```typescript
async function sendPushNotification(userId, notificationData) {
  const sub = await db.pushSubscriptions.findOne({ user_id: userId });
  
  try {
    await webpush.sendNotification(/*...*/);
    
    // Aggiorna il timestamp
    await db.pushSubscriptions.update(
      { user_id: userId },
      { last_used_at: new Date() }
    );
  } catch (err) {
    // Handle errors
  }
}
```

## Migrazione da Nessun Sistema

Se stai aggiungendo push notifications per la prima volta:

```bash
# 1. Crea le colonne/tabella
psql $DATABASE_URL < schema.sql

# 2. Configura le RLS policies
psql $DATABASE_URL < rls-policies.sql

# 3. Aggiungi le variabili di ambiente
export VAPID_PUBLIC_KEY="..."
export VAPID_PRIVATE_KEY="..."

# 4. Deploy della nuova versione dell'app
npm run build && npx vercel --prod
```

## Troubleshooting

### "Error: Subscription is no longer valid"

La subscription è scaduta o il dispositivo è stato cancellato. Il backend deve gestire il codice HTTP 410:

```typescript
try {
  await webpush.sendNotification(subscription, payload);
} catch (err) {
  if (err.statusCode === 410) {
    // Subscription scaduta, rimuovila
    await db.pushSubscriptions.delete({ endpoint: subscription.endpoint });
  }
}
```

### "No subscription found for user"

Controlla che:
1. L'utente abbia effettivamente cliccato "Attiva Notifiche"
2. Il browser sia supportato (Chrome, Edge, Firefox)
3. La subscription sia stata salvata nel database

### "VAPID keys not configured"

Assicurati che le variabili di ambiente siano configurate:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

In Vercel: Settings → Environment Variables
