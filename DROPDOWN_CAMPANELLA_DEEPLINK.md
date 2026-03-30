# 🔔 Dropdown Campanella con Deep-Link - Implementazione

## ✅ STATUS: COMPLETATO E PRONTO PER INTEGRAZIONE

---

## 📋 Overview

Il **Dropdown Campanella** offre un'anteprima veloce delle ultime notifiche direttamente dall'header dell'app.

Con un singolo click su una notifica, l'utente viene navigato direttamente al profilo e al messaggio specifico con smooth scrolling e animazione di evidenziazione.

---

## 📦 Componenti Implementati

### 1. NotificationDropdown (`src/components/NotificationDropdown.tsx`)

**Visualizza:**
- Header con titolo "Ultime Notifiche"
- Badge rosso con numero non letti
- Lista ultime 5 notifiche ordinate per data recente
- Anteprima testo (40 caratteri + '...')
- Orario in formato relativo ("2 min fa")
- Icona tipo messaggio (📢 broadcast, ✉️ private)
- Footer "Visualizza Tutti →"

**Comportamento:**
- Click fuori chiude automaticamente
- Click su notifica → navigaToMessage()
- Z-index 50 per overlay corretto
- Dark mode supportato

```typescript
<NotificationDropdown
  messages={messages}
  unreadCount={unreadCount}
  onMessageClick={handleMessageClick}
  isOpen={isDropdownOpen}
  onClose={() => setIsDropdownOpen(false)}
/>
```

### 2. Deep-Link Hook (`src/hooks/useMessageDeepLink.ts`)

**Funzioni:**
```typescript
navigateToMessage(messageId, onMarkRead?) => {
  1. Marca come letto (await onMarkRead())
  2. setActiveTab('profilo')
  3. setTimeout(() => {
    3a. getElementById('messages-section').scrollIntoView()
    3b. getElementById(`message-${messageId}`).animate
  }, 100)
}

handleMessageUrlParam(messageId, onMarkRead?) => {
  // Supporta deep-linking via URL params
}
```

---

## 🔗 Integration Points

### Nel Header (MobileProfileHeader.tsx)

```typescript
import { NotificationDropdown } from './NotificationDropdown';
import { useMessageDeepLink } from '../hooks/useMessageDeepLink';
import { useMessages } from '../hooks/useMessages';

export function MobileProfileHeader() {
  const { messages, unreadCount, markAsRead } = useMessages(userId);
  const { navigateToMessage } = useMessageDeepLink();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleMessageClick = async (message: Message) => {
    await navigateToMessage(message.id, () => markAsRead(message.id));
  };

  return (
    <>
      {/* Bell button with badge */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <NotificationDropdown
        messages={messages}
        unreadCount={unreadCount}
        onMessageClick={handleMessageClick}
        isOpen={isDropdownOpen}
        onClose={() => setIsDropdownOpen(false)}
      />
    </>
  );
}
```

### Nel Profilo (Messaggi)

```typescript
// ID per scorrimento e identificazione
<div id="messages-section">
  {/* MessagesList component */}
</div>

// Per ogni messaggio: ID per evidenziazione
<div id={`message-${message.id}`} className={isHighlighted ? 'animate-pulse' : ''}>
  {/* Messaggio */}
</div>
```

### Con Push Notifications

Quando arriva una push notification dal server:

```javascript
// Nel service worker (pwa-push-notifications.js)
event.waitUntil(
  self.registration.showNotification(title, {
    ...options,
    data: {
      url: `/profilo?message=${messageId}`,  // Deep-link
      type: 'message'
    }
  })
);

// Nel notificationclick handler
const url = event.notification.data?.url || '/';
self.clients.openWindow(baseUrl + url);
```

---

## 🎯 Workflow Completo

### Da Dropdown

```
1. Campanella nell'header
   ↓
2. Click campanella → Dropdown appare
   ↓
3. Clicca su messaggio
   ↓
4. markAsRead(messageId) ← Supabase update
   ↓
5. navigateToMessage(messageId) ← Deep-link
   ├─ setActiveTab('profilo')
   ├─ getElementById('messages-section').scrollIntoView()
   └─ getElementById(`message-${messageId}`).animate (pulse)
   ↓
6. Visualizza messaggio completo con evidenziazione
```

### Da Push Notification

```
1. Notifica arriva dal server
   ↓
2. Push Service invia a device
   ↓
3. Utente clicca sulla notifica nel centro notifiche
   ↓
4. Service Worker apre: /profilo?message=msg-id
   ↓
5. App.tsx intercetta URL param
   ↓
6. handleMessageUrlParam(messageId)
   ├─ markAsRead(messageId)
   └─ navigateToMessage(messageId)
   ↓
7. Profilo aperto con messaggio evidenziato
```

---

## 🎨 UI/UX

### Dropdown (Mobile)
```
┌─────────────────────────────────┐
│ 🔔 Ultime Notifiche        [🔴5] │
│                             [×] │
├─────────────────────────────────┤
│ 📢 Cambio Turno Domani    🔵     │
│ "Da domani i turni sono..."     │
│ "3 min fa"                      │
├─────────────────────────────────┤
│ ✉️ Manager Generale       🔵     │
│ "Il tuo turno è stato..."       │
│ "15 min fa"                     │
├─────────────────────────────────┤
│ 📢 Comunicazione Staff          │
│ "Nuove regole di timbratura..." │
│ "1 ora fa"                      │
├─────────────────────────────────┤
│   Visualizza Tutti →            │
└─────────────────────────────────┘
```

### Badge sulla Campanella
```
┌───┐
│🔔5│  ← Badge rosso con numero non letti
└───┘
```

### Messaggio Evidenziato
```
┌────────────────────────────┐
│ ✉️ Manager Generale  ✓     │ ← Pulse animation 3s
│ "Cambio orari domani..."   │
│ "30 Mar 14:30"             │
│ [Marca come letto] [❌]    │
└────────────────────────────┘
```

---

## 🔐 Sicurezza

- ✅ Z-index 50 per non finire sotto tabella turni
- ✅ Click fuori chiude dropdown
- ✅ Deep-link naviga solo se autorizzato (RLS)
- ✅ markAsRead convalida ownership messaggio
- ✅ URL param validato prima di navigare

---

## 📊 Commit

```
b37d7fc - Dropdown campanella con deep-link a messaggi
```

**File:**
- src/components/NotificationDropdown.tsx (175 linee)
- src/hooks/useMessageDeepLink.ts (77 linee)

**Total: 252 linee**

---

## 🛠️ Backend Integration

### Niente da implementare nel backend

Il dropdown utilizza:
- ✅ Messaggi già caricati da `useMessages()`
- ✅ Supabase real-time già configurato
- ✅ markAsRead() già implementato

### Solo per Push Notifications

Nell'endpoint che invia le notifiche push:

```typescript
// Aggiungi data con deep-link
await sendPushNotification(userId, {
  title: "Messaggio da Manager",
  body: subject,
  data: {
    url: `/profilo?message=${messageId}`,  // ← Aggiungere
    type: 'message'
  }
});
```

---

## 🧪 Testing Checklist

- [ ] Campanella in header appare
- [ ] Click campanella apre dropdown
- [ ] Click fuori chiude dropdown
- [ ] Messaggi ordinati per data (più recente prima)
- [ ] Anteprima testo troncata a 40 caratteri
- [ ] Tempo in formato "X min fa"
- [ ] Badge blu per non letti
- [ ] Badge rosso unreadCount
- [ ] Click su messaggio chiude dropdown
- [ ] Click su messaggio marca come letto
- [ ] Click su messaggio naviga a profilo
- [ ] Scrolla a sezione messaggi
- [ ] Evidenzia messaggio con animazione
- [ ] Animazione rimuove dopo 3 secondi
- [ ] Deep-link via URL param funziona
- [ ] Push notification deep-link funziona

---

## 🚀 Production Checklist

- [x] NotificationDropdown component implementato
- [x] useMessageDeepLink hook implementato
- [x] Build green
- [x] Linting clean
- [ ] Integrazione nel header
- [ ] Integrazione nel profilo messaggi
- [ ] ID elements nel markup
- [ ] Deep-link push notifications configurato
- [ ] Testing completo

---

## 📝 Prossimi Step

1. **Nel MobileProfileHeader.tsx**
   ```typescript
   import { NotificationDropdown } from './NotificationDropdown';
   import { useMessageDeepLink } from '../hooks/useMessageDeepLink';
   // ... implementazione vista sopra
   ```

2. **Nel Profilo (Messaggi)**
   ```tsx
   <div id="messages-section">
     {/* Messaggi */}
   </div>
   
   <div id={`message-${msg.id}`}>
     {/* Ogni messaggio */}
   </div>
   ```

3. **Nel Service Worker**
   ```javascript
   // Aggiungi data.url al showNotification
   ```

4. **Nel Backend Push**
   ```typescript
   // Aggiungi data: { url: `/profilo?message=${id}` }
   ```

---

## 📞 Reference

File correlati:
- `src/hooks/useMessages.ts` - Per messaggi
- `src/components/MobileProfileHeader.tsx` - Integrare qui
- `src/components/MessagesList.tsx` - Nel profilo
- `public/pwa-push-notifications.js` - Service worker

---

**Commit**: b37d7fc  
**Build**: ✓ GREEN  
**Linting**: ✓ CLEAN  
**Status**: ✅ PRONTO PER INTEGRAZIONE

---

*Ultimo aggiornamento: 30 Marzo 2026*
