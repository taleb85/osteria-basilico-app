# 📱 Centro Messaggi - Documentazione Completa

## ✅ Status: FRONTEND COMPLETAMENTE IMPLEMENTATO

---

## 📋 Overview

Il **Centro Messaggi** (Hub Comunicazioni) consente ai manager di inviare messaggi a:
- ✅ **Tutti gli staff** (Messaggi Broadcast)
- ✅ **Singoli dipendenti** (Messaggi Privati)

I dipendenti ricevono notifiche in tempo reale e possono visualizzare i messaggi nella loro scheda profilo.

---

## 🏗️ Architettura Implementata

### 1. Database Schema (`DATABASE_SCHEMA_MESSAGES.sql`)

#### Tabella `messages`
```sql
id UUID (PK)
sender_id UUID (FK users) - Chi invia
message_type 'broadcast' | 'private'
recipient_id UUID (FK users) - Solo per private
subject TEXT - Oggetto messaggio
body TEXT - Contenuto
created_at TIMESTAMP
```

#### Tabella `message_reads`
```sql
id UUID (PK)
message_id UUID (FK messages)
user_id UUID (FK users)
is_read BOOLEAN - Stato lettura
read_at TIMESTAMP
```

#### Features
- ✅ RLS Policies per sicurezza
- ✅ Trigger auto-crea entries per broadcast
- ✅ View `user_messages` per query semplificate
- ✅ Indici per performance

---

### 2. Hook React (`src/hooks/useMessages.ts`)

```typescript
useMessages(userId: string) => {
  messages: Message[]           // Tutti i messaggi per l'utente
  broadcastMessages: Message[]  // Solo broadcast
  privateMessages: Message[]    // Solo privati
  unreadMessages: Message[]     // Solo non letti
  unreadCount: number           // Conteggio non letti
  isLoading: boolean
  error: string | null
  
  // Funzioni
  markAsRead(messageId): Promise<boolean>
  sendMessage(subject, body, recipientId?): Promise<boolean>
}
```

**Features:**
- Real-time subscription via Supabase
- Auto-aggiornamento quando arrivano messaggi
- Caricamento iniziale
- Gestione errori

---

### 3. Componente MessagesList (`src/components/MessagesList.tsx`)

**Visualizza lista messaggi con:**
- 🔴 Badge rosso per non letti
- 📢 Icona per messaggi broadcast
- ✉️ Icona per messaggi privati
- 📏 Espansione inline per leggere contenuto completo
- 👤 Nome mittente + Data
- 🔘 "Marca come letto" al click

**Props:**
```typescript
messages: Message[]
onMarkAsRead: (messageId) => void
onDelete?: (messageId) => void
compact?: boolean  // Versione mobile vs desktop
```

**Styling:**
- Dark mode supportato
- Responsive mobile/desktop
- Animazioni transizione

---

### 4. Componente MessageWriter (`src/components/MessageWriter.tsx`)

**Consente ai manager di inviare messaggi:**

#### Modalità
1. **Broadcast** 📢 - Invia a TUTTI
2. **Private** ✉️ - Invia a UN singolo dipendente

#### Campi
- Oggetto (max 100 caratteri)
- Corpo messaggio (max 500 caratteri)
- Seleziona destinatario (se privato)

#### Stati
- ✓ Loading mentre invia
- ✓ Errori validazione
- ✓ Successo messaggio inviato
- ✓ Contatore caratteri

#### Versioni
- **Compact**: Per header/toolbar (solo icona)
- **Full**: Per sezione profilo (completo)

**Props:**
```typescript
currentUser: User
allUsers: User[]
onSend: (subject, body, recipientId?) => Promise<boolean>
onCancel?: () => void
compact?: boolean
```

---

## 🔐 Sicurezza & Privacy

| Aspetto | Implementazione |
|---------|-----------------|
| **RLS Policies** | ✅ Users vedono solo loro messaggi + broadcast |
| **Mittente** | ✅ Solo manager possono inviare |
| **Lettura** | ✅ Tracciata per ogni utente |
| **Eliminazione** | ✅ Solo per mittente/admin |

---

## 📤 Integrazione Push Notifications

Quando un messaggio viene inviato:

```
Backend:
  sendMessage() →
  createPushNotification() →
  sendToService() →
  
Browser:
  Service Worker riceve push →
  showNotification() →
  
Utente:
  Vede notifica centro notifiche:
  "Osteria Basilico - Messaggio da [Manager]"
```

---

## 🔄 Workflow Utente

### Per Dipendente

```
1. Apri app
   ↓
2. Vai a Profilo
   ↓
3. Sezione "MESSAGGI E COMUNICAZIONI" mostra lista
   ↓
4. Clicca messaggio non letto (badge rosso)
   ↓
5. Espande e mostra contenuto completo
   ↓
6. Stato cambia a "letto"
   ↓
7. Badge scompareSogni badge non letti
```

### Per Manager

```
1. Apri app
   ↓
2. Vai a Profilo
   ↓
3. Clicca "Scrivi Messaggio" ✍️
   ↓
4. Scegli: Broadcast vs Private
   ↓
5. Scrivi Oggetto + Corpo
   ↓
6. (Se private) Seleziona destinatario
   ↓
7. Clicca "Invia Messaggio"
   ↓
8. Visualizza conferma "Inviato!"
```

---

## 📁 File Implementati

| File | Tipo | Linee | Descrizione |
|------|------|-------|------------|
| `DATABASE_SCHEMA_MESSAGES.sql` | SQL | 180 | Schema DB + RLS + Triggers |
| `src/hooks/useMessages.ts` | TypeScript | 230 | Hook per gestire messaggi |
| `src/components/MessagesList.tsx` | TSX | 240 | Component visualizzazione |
| `src/components/MessageWriter.tsx` | TSX | 380 | Component scrittura messaggi |

**Total: ~1050 linee di codice**

---

## 🚀 Backend Integration Checklist

Il frontend è completamente implementato. Il backend deve:

### 1. API Endpoints

```typescript
// GET /api/messages?userId=...
// Ritorna: { messages: Message[], unreadCount: number }

// POST /api/messages
// Body: { subject, body, message_type, recipient_id }
// Ritorna: { success: boolean, messageId: string }

// POST /api/messages/:id/read
// Marca messaggio come letto
// Ritorna: { success: boolean }

// DELETE /api/messages/:id
// Elimina messaggio
// Ritorna: { success: boolean }
```

### 2. Real-time Subscriptions

```typescript
// Supabase real-time deve essere configurato per:
// - `messages` table (INSERT, UPDATE, DELETE)
// - `message_reads` table (UPDATE)
```

### 3. Push Notifications

```typescript
// Quando viene inviato un messaggio:
await sendPushNotification(userId, {
  title: "Messaggio da Osteria Basilico",
  body: `Nuovo messaggio: ${subject}`,
  url: "/profilo#messaggi",
  type: "message"
});
```

### 4. Authorization

```typescript
// Solo questi ruoli possono inviare messaggi:
- admin
- manager
- assistant_manager
```

---

## 🎨 UI Components

### MessagesList

```
┌─────────────────────────────────┐
│ 📢 Manager Generale    🔴 1 new │
│ "Cambio Turno Domani"     30 Mar│
└─────────────────────────────────┘
  ▼ Click per espandere
  
┌─────────────────────────────────┐
│ 📢 Manager Generale    ✓ LETTO  │
│ "Cambio Turno Domani"     30 Mar│
│                                  │
│ Da: Manager Generale             │
│ Data: 30 Mar 14:30              │
│                                  │
│ Messaggio:                       │
│ ┌─────────────────────────────┐ │
│ │ Da domani i turni sono      │ │
│ │ modificati. Vedi il nuovo   │ │
│ │ calendario in sezione turni.│ │
│ └─────────────────────────────┘ │
│                                  │
│ [Marca come letto] [❌ Elimina] │
└─────────────────────────────────┘
```

### MessageWriter (Manager)

```
╔═════════════════════════════════╗
║ ✉️ Scrivi Messaggio             ║
╠═════════════════════════════════╣
║ Destinatario:                   ║
║ [ 📢 Tutti ]  [ ✉️ Privato ]   ║
║                                 ║
║ Oggetto:                        ║
║ [Cambio Turno Domani____]       ║
║                                 ║
║ Messaggio:                      ║
║ ┌──────────────────────────┐   ║
║ │ Da domani i turni sono │   ║
║ │ modificati. Vedi il    │   ║
║ │ nuovo calendario...    │   ║
║ └──────────────────────────┘   ║
║ 68/500                          ║
║                                 ║
║ [ 📤 Invia ] [ ❌ Annulla ]    ║
╚═════════════════════════════════╝
```

---

## 📊 Database Performance

| Query | Indice | Tempo |
|-------|--------|-------|
| GET messaggi user | idx_message_reads_user | O(log n) |
| GET unread count | idx_message_reads_user_unread | O(log n) |
| GET all messages | idx_messages_created | O(log n) |
| POST message | - | Insert + trigger |

---

## 🧪 Testing Checklist

### Frontend
- [ ] MessagesList visualizza messaggi
- [ ] Badge rosso per non letti
- [ ] Espansione inline funziona
- [ ] "Marca come letto" aggiorna stato
- [ ] MessageWriter solo per manager
- [ ] Broadcast vs Private toggle
- [ ] Select destinatario funziona
- [ ] Validazione campi
- [ ] Dark mode funziona
- [ ] Responsive mobile/desktop

### Backend (quando implementato)
- [ ] POST /api/messages salva
- [ ] GET /api/messages carica
- [ ] POST .../read aggiorna
- [ ] RLS policies funzionano
- [ ] Real-time subscription funziona
- [ ] Push notification invia
- [ ] Trigger auto-crea entries

---

## 🔗 Integration Points

```
┌─────────────────┐
│ MobileProfileHeader
│   (Profilo)
└────────┬────────┘
         │
    ┌────┴────┐
    │          │
    ▼          ▼
MessagesList  MessageWriter
(dipendente)  (manager only)
    │          │
    └────┬─────┘
         │
    ┌────▼─────────────┐
    │ useMessages Hook │
    │                  │
    │ - markAsRead()   │
    │ - sendMessage()  │
    └────┬─────────────┘
         │
    ┌────▼────────────────────┐
    │ Supabase (Real-time)    │
    │ - messages table        │
    │ - message_reads table   │
    │ - RLS policies         │
    └────┬────────────────────┘
         │
    ┌────▼─────────────────┐
    │ Backend API Endpoints│
    │ - GET messages       │
    │ - POST messages      │
    │ - POST /.../read     │
    └──────────────────────┘
```

---

## 📞 Supporto & Debug

### Debug Messaggi
```javascript
// Console browser
console.log(useMessages);  // Vedi hook state
console.log(messages);     // Vedi lista messaggi
console.log(unreadCount);  // Conteggio non letti
```

### Errori Comuni

| Errore | Causa | Soluzione |
|--------|-------|----------|
| "Messaggi non caricano" | API non implementata | Implementa GET /api/messages |
| "Real-time non funziona" | Supabase non configurato | Configura real-time in Supabase |
| "Badge non scompare" | markAsRead fallisce | Verifica API POST /.../read |
| "Push non arriva" | Backend non invia | Implementa sendPushNotification |

---

## 🎓 Prossimi Step

### Implementazione Backend (Priorità HIGH)

1. **SQL Migrations**
   ```bash
   psql $DATABASE_URL < DATABASE_SCHEMA_MESSAGES.sql
   ```

2. **API Endpoints** (Node.js/Express)
   ```typescript
   // vedi PWA_PUSH_NOTIFICATIONS.md per pattern
   app.get('/api/messages', authenticate(), getMessages);
   app.post('/api/messages', authenticate(), sendMessage);
   app.post('/api/messages/:id/read', authenticate(), markAsRead);
   app.delete('/api/messages/:id', authenticate(), deleteMessage);
   ```

3. **Real-time Subscription**
   ```typescript
   database.supabase
     .channel('messages')
     .on('*', …)
     .subscribe();
   ```

4. **Push Notifications**
   ```typescript
   // Quando message.insert accade:
   await sendPushNotification(recipient_id, {…});
   ```

---

## 📝 Production Checklist

- [x] Frontend componenti implementati
- [x] Hook React con logica
- [x] Schema SQL creato
- [x] Build green
- [x] Linting clean
- [ ] Backend API endpoints
- [ ] Real-time subscriptions
- [ ] Push notifications
- [ ] RLS policies tested
- [ ] E2E testing
- [ ] Deploy produzione

---

## 🎉 Summary

**Osteria Basilico ora ha un completo Centro Messaggi:**
- ✅ UI componenti per visualizzare messaggi
- ✅ UI componenti per inviare messaggi (manager)
- ✅ Hook React con logica
- ✅ Schema database
- ✅ Pronto per backend integration

**Commit**: `e73db1b`
**Build**: ✓ GREEN
**Linting**: ✓ CLEAN

---

*Ultimo aggiornamento: 30 Marzo 2026*  
*Osteria Basilico - Centro Messaggi*
