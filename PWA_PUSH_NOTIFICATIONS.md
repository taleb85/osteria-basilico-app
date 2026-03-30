# PWA Push Notifications - Guida Backend Integration

## Panoramica

Osteria Basilico ora supporta le **Push Notifications native** su dispositivi mobile e desktop. Le notifiche vengono inviate direttamente al dispositivo dell'utente anche quando l'app è chiusa.

## Componenti Frontend

### 1. **Service Worker** (`public/pwa-push-notifications.js`)
- Ascolta l'evento `push` dal server
- Mostra la notifica nel centro notifiche del sistema operativo
- Gestisce i click sulla notifica per aprire l'app e navigare all'URL

### 2. **Hook React** (`src/hooks/usePushNotifications.ts`)
- Verifica il supporto del browser
- Richiede il permesso all'utente
- Gestisce la sottoscrizione alle notifiche
- Comunica con il backend

### 3. **Componente UI** (`src/components/NotificationPermissionButton.tsx`)
- Pulsante compatto nel header per attivare notifiche
- Pulsante expanded per settings
- Mostra lo stato dell'iscrizione

## Implementazione Backend

### Step 1: Configurare VAPID Keys

Genera una coppia di chiavi VAPID (necessarie per l'autenticazione Web Push):

```bash
# Usa questo strumento online: https://web-push-codelab.glitch.me/
# Oppure usa il pacchetto npm:
npm install -g web-push
web-push generate-vapid-keys
```

**Output di esempio:**
```
Public Key: BMfXXXXXXXXXXXXXXXXXXXXXXXXXXXXX...
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
```

Salva le chiavi come variabili di ambiente:
```env
VAPID_PUBLIC_KEY=BMfXXXXXXXXXXXXXXXXXXXXXXXXXXXXX...
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...
VAPID_SUBJECT=mailto:admin@example.com  # Email tua
```

### Step 2: Aggiungere la Tabella nel Database

Estendi la tabella `user_preferences` (o crea una nuova tabella `push_subscriptions`) per salvare le sottoscrizioni:

```sql
-- Estendi user_preferences (se non esiste ancora una colonna)
ALTER TABLE user_preferences
ADD COLUMN push_subscription_endpoint TEXT UNIQUE,
ADD COLUMN push_subscription_p256dh TEXT,
ADD COLUMN push_subscription_auth TEXT,
ADD COLUMN push_subscription_created_at TIMESTAMP DEFAULT now(),
ADD COLUMN push_subscription_enabled BOOLEAN DEFAULT true;

-- Oppure: crea una tabella separata
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  enabled BOOLEAN DEFAULT true,
  UNIQUE(user_id, endpoint)
);
```

### Step 3: Implementare API Endpoints

#### POST `/api/push-subscription`
Salva la sottoscrizione push dell'utente:

```typescript
// Express/Node.js example
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

app.post('/api/push-subscription', authenticate(), async (req, res) => {
  const { endpoint, keys } = req.body;
  const userId = req.user.id;

  // Valida il payload
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription data' });
  }

  try {
    // Salva nel database (oppure aggiorna se esiste)
    await db.pushSubscriptions.upsert({
      user_id: userId,
      endpoint,
      p256dh: bufferToBase64(keys.p256dh),
      auth: bufferToBase64(keys.auth),
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving push subscription:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});
```

#### DELETE `/api/push-subscription`
Rimuove la sottoscrizione:

```typescript
app.delete('/api/push-subscription', authenticate(), async (req, res) => {
  const { endpoint } = req.body;
  const userId = req.user.id;

  try {
    await db.pushSubscriptions.delete({
      user_id: userId,
      endpoint,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting push subscription:', err);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});
```

### Step 4: Inviare Notifiche Push

Quando un evento importante accade (es. turno approvato), invia una notifica:

```typescript
import webpush from 'web-push';

async function sendPushNotification(userId, notificationData) {
  try {
    // Recupera la sottoscrizione dell'utente dal database
    const subscription = await db.pushSubscriptions.findOne({
      user_id: userId,
      enabled: true,
    });

    if (!subscription) {
      console.log('No push subscription for user:', userId);
      return;
    }

    // Prepara il payload della notifica
    const payload = JSON.stringify({
      title: notificationData.title || 'Osteria Basilico',
      body: notificationData.body || 'Nuova notifica',
      type: notificationData.type || 'notification',
      url: notificationData.url || '/',
      requireInteraction: notificationData.requireInteraction || false,
    });

    // Invia la notifica push
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      payload
    );

    console.log('Push notification sent to user:', userId);
  } catch (err) {
    if (err.statusCode === 410) {
      // Subscription scaduta, rimuovila dal database
      await db.pushSubscriptions.delete({
        user_id: userId,
        endpoint: subscription.endpoint,
      });
    } else {
      console.error('Error sending push notification:', err);
    }
  }
}
```

### Step 5: Trigger Notifiche per Eventi

Aggiungi trigger quando accadono eventi importanti:

```typescript
// Quando un turno viene approvato
async function approveShift(shiftId) {
  const shift = await db.shifts.findById(shiftId);
  const user = await db.users.findById(shift.user_id);

  // Approva il turno
  await db.shifts.update(shiftId, { approval_status: 'approved' });

  // Invia notifica push
  await sendPushNotification(user.id, {
    title: 'Turno Approvato',
    body: `Il tuo turno del ${formatDate(shift.date)} è stato approvato`,
    type: 'shift_approved',
    url: `/timesheets?shift=${shiftId}`,
    requireInteraction: false,
  });
}

// Quando i dati vengono modificati
async function updateShift(shiftId, updates) {
  const shift = await db.shifts.findById(shiftId);
  await db.shifts.update(shiftId, updates);

  // Notifica il dipendente di una modifica
  await sendPushNotification(shift.user_id, {
    title: 'Turno Modificato',
    body: `Il tuo turno del ${formatDate(shift.date)} è stato modificato`,
    type: 'shift_modified',
    url: `/timesheets?shift=${shiftId}`,
    requireInteraction: true,
  });
}
```

## Frontend: Configurazione Aggiuntiva (Opzionale)

Se vuoi che il frontend faccia qualcosa quando una notifica viene ricevuta, puoi aggiungere un listener nei tuoi componenti:

```typescript
import { useEffect } from 'react';

export function useNotificationListener() {
  useEffect(() => {
    // Ascolta i messaggi dal service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'NOTIFICATION_RECEIVED') {
          console.log('Notifica ricevuta:', event.data.payload);
          // Aggiorna lo stato dell'app se necessario
        }
      });
    }
  }, []);
}
```

## Testing

### Test Locale

1. Usa Chrome DevTools → Application → Service Workers
2. Simula una notifica push:
   ```javascript
   // Nella console del DevTools
   registration.pushManager.getSubscription().then(sub => {
     console.log(JSON.stringify(sub));
   });
   ```
3. Usa il tool online: https://web-push-codelab.glitch.me/

### Test con curl

```bash
curl -X POST https://example.com/api/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "title": "Test Notification",
    "body": "This is a test"
  }'
```

## Limitazioni e Considerazioni

1. **Safari/iOS**: Supporto limitato per Web Push; usa alternative come Firebase Cloud Messaging
2. **Android**: Funziona bene con Chrome e Firefox
3. **Throttling**: I browser possono limitare la frequenza delle notifiche
4. **HTTPS Obbligatorio**: Web Push richiede HTTPS in produzione

## Sicurezza

- Valida sempre i payload sul backend
- Usa rate limiting per evitare spam
- Non includere dati sensibili nelle notifiche (visibili nel centro notifiche)
- Verifica che l'utente sia autenticato prima di salvare la subscription

## Références

- [MDN Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Web Push Protocol (RFC 8030)](https://tools.ietf.org/html/rfc8030)
- [web-push npm package](https://www.npmjs.com/package/web-push)
