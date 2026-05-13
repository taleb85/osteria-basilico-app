# 🔧 Testing & Diagnostica Push Notifications

## 1️⃣ Verifica Supporto Browser

Apri la console del browser (F12) e esegui:

```javascript
// Controlla se il browser supporta Web Push
console.log("Service Worker Support:", 'serviceWorker' in navigator);
console.log("Push Manager Support:", 'PushManager' in window);
console.log("Notification Support:", 'Notification' in window);

// Risultato atteso: tutte true
```

## 2️⃣ Verifica Service Worker Registrato

```javascript
navigator.serviceWorker.ready
  .then(reg => {
    console.log("Service Worker Active:", reg.active);
    console.log("Push Manager:", reg.pushManager);
  })
  .catch(err => console.error("Service Worker Error:", err));
```

**Output atteso:**
```
Service Worker Active: ServiceWorkerContainer
Push Manager: PushManager
```

## 3️⃣ Verifica Permesso Notifiche

```javascript
console.log("Notification Permission:", Notification.permission);
```

**Valori possibili:**
- `"granted"` → ✅ Permesso concesso (icona 🔔 verde)
- `"denied"` → ❌ Permesso negato (icona 🔔 grigia)
- `"default"` → ⚠️ Non ancora concesso (icona 🔔 grigia)

## 4️⃣ Testa Notifica Locale

Se il permesso è stato concesso (`"granted"`), esegui:

```javascript
// Mostra una notifica di test
new Notification("Test Notifica", {
  body: "Se vedi questo messaggio, le notifiche funzionano!",
  icon: "/icon-192.png",
  badge: "/icon-192.png"
});
```

**Output atteso:**
- Dovresti vedere una notifica nel centro notifiche del sistema
- Su mobile: banner nella top bar

## 5️⃣ Verifica Push Subscription

Una volta che hai cliccato "Attiva Notifiche":

```javascript
navigator.serviceWorker.ready
  .then(reg => {
    return reg.pushManager.getSubscription();
  })
  .then(subscription => {
    if (subscription) {
      console.log("✅ Subscription ATTIVA");
      console.log("Endpoint:", subscription.endpoint);
      console.log("Keys:", {
        p256dh: subscription.getKey('p256dh'),
        auth: subscription.getKey('auth')
      });
    } else {
      console.log("❌ Nessuna subscription attiva");
    }
  })
  .catch(err => console.error("Error:", err));
```

## 6️⃣ Invia Notifica Push di Test (Backend)

Se il tuo backend è configurato, esegui una richiesta POST:

```bash
# Invia una notifica push di test
curl -X POST https://flow-workinmotion.vercel.app/api/test-push \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "tuo-user-id",
    "title": "Notifica di Test",
    "body": "Se ricevi questo, le push notifications funzionano!"
  }'
```

## 🐛 Troubleshooting

### Problema: "Service Worker non trovato"

```
Errore: Service Worker Error: NotFound
```

**Soluzione:**
- Svuota la cache: Ctrl+Shift+Delete
- Ricaricare la pagina: Ctrl+Shift+R
- Verifica che il build abbia incluso il SW: `/sw.js` deve esistere

### Problema: "Permesso negato"

```
Notification Permission: denied
```

**Soluzione:**
1. Vai alle impostazioni del browser
2. Trova "Osteria Basilico"
3. Cambia le notifiche da "Nega" a "Consenti"

### Problema: "Notifica non appare"

**Checklist:**
- ✓ Permesso concesso (`"granted"`)
- ✓ Service Worker attivo
- ✓ Subscription registrata
- ✓ Browser/scheda non chiusa
- ✓ Batteria sufficientemente carica
- ✓ Wi-Fi o dati mobili attivi
- ✓ Volume non silenzioso

### Problema: "Network Error"

```
Error: Failed to save subscription
```

**Soluzione:**
- Verifica che l'API `/api/push-subscription` sia disponibile
- Controlla la connessione internet
- Verifica che il backend sia in esecuzione

### Problema: "410 Gone" dal backend

La subscription è scaduta (dispositivo non connesso da 30+ giorni).

**Soluzione:**
- Clicca "Attiva Notifiche" di nuovo per ottenere una nuova subscription

## 📊 Log di Debug

Abilita log dettagliati nel browser:

```javascript
// In AppContext.tsx, aggiungi questo log temporaneo
localStorage.setItem('debug:push', 'true');

// Poi ricarica e guarda la console per messaggi dettagliati
```

## 📋 Checklist Pre-Deploy

Prima di mettere in produzione le push notifications:

- [ ] Service Worker registrato (`/sw.js`)
- [ ] `pwa-push-notifications.js` caricato dal SW
- [ ] Manifest.json valido
- [ ] Icone disponibili (192x192, 512x512)
- [ ] VAPID keys configurate nel backend
- [ ] API endpoints implementati (`POST/DELETE /api/push-subscription`)
- [ ] Database tabella creata
- [ ] Logica di invio notifiche implementata
- [ ] Test locale con curl
- [ ] Test su dispositivo reale (Android/iOS)
- [ ] Test offline → online
- [ ] Test su batteria scarica/risparmio batteria attivo

## 🔍 Verifica Endpoint API

```javascript
// Verifica che l'API sia raggiungibile
fetch('/api/push-subscription')
  .then(res => console.log("API Status:", res.status))
  .catch(err => console.error("API Error:", err));
```

**Valori attesi:**
- 405 (Method Not Allowed) → Normale per GET
- 200 (OK) → API disponibile
- 404 (Not Found) → API non implementata
- 500 (Server Error) → Problema nel backend

## 📱 Test su Dispositivo Reale

### Android
1. Apri Chrome
2. Vai a https://flow-workinmotion.vercel.app
3. Clicca "Attiva Notifiche"
4. Concedi permesso
5. Verifica che le notifiche appaiano nel centro notifiche

### iPhone
1. Apri Safari
2. Nota: Safari ha supporto limitato per Web Push
3. Usa invece l'app nativa (se disponibile)

## 📞 Script di Test Automatico

```javascript
// Copia e incolla nella console per fare un test completo
(async function testPushNotifications() {
  console.group("🔔 Test Completo Push Notifications");
  
  try {
    // 1. Supporto
    console.log("✓ Supporto browser:", {
      serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window,
      notification: 'Notification' in window
    });
    
    // 2. Service Worker
    const reg = await navigator.serviceWorker.ready;
    console.log("✓ Service Worker:", reg.active ? "Attivo" : "Inattivo");
    
    // 3. Permesso
    console.log("✓ Permesso:", Notification.permission);
    
    // 4. Subscription
    const sub = await reg.pushManager.getSubscription();
    console.log("✓ Subscription:", sub ? "Attiva" : "Non attiva");
    
    if (sub) {
      console.log("  - Endpoint:", sub.endpoint.substring(0, 50) + "...");
      console.log("  - Keys:", sub.getKey('p256dh') ? "Present" : "Missing");
    }
    
    console.log("✅ Test completato!");
  } catch (err) {
    console.error("❌ Errore:", err.message);
  }
  
  console.groupEnd();
})();
```

## 🎯 Output Atteso di Successo

```
✓ Supporto browser: {serviceWorker: true, pushManager: true, notification: true}
✓ Service Worker: Attivo
✓ Permesso: granted
✓ Subscription: Attiva
  - Endpoint: https://fcm.googleapis.com/fcm/send/...
  - Keys: Present
✅ Test completato!
```
