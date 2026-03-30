# 🔔 Unificazione Campanella Notifiche - Implementazione

## ✅ STATUS: COMPLETATO E PRONTO PER INTEGRAZIONE

---

## 📋 Cosa Fatto

### Componente Unificato `UnifiedBellButton`

Rimuove la confusione dell'header consolidando **3 componenti** in **1**:

| Componente Vecchio | Nuovo | Funzione |
|-------------------|-------|----------|
| NotificationPermissionButton | UnifiedBellButton | Attiva push notifications |
| NotificationCenter | UnifiedBellButton | Centro notifiche |
| Mute Button (separato) | UnifiedBellButton | Toggle mute audio |

---

## 🎯 Funzionalità Unificata

### Click Breve (< 500ms)
```
Utente: Clicca campanella
  ↓
triggerHapticFeedback('click')  ← Vibra
  ↓
Dropdown appare con ultime 5 notifiche
  ↓
Utente clicca messaggio
  ↓
markAsRead() + closeDropdown()
```

### Long Press (≥ 500ms)
```
Utente: Tiene premuta campanella 500ms
  ↓
triggerHapticFeedback('success' | 'warning')  ← Vibra
  ↓
Toggle isSoundEnabled
  ↓
Indicatore visual: puntino grigio se muto
```

---

## 🎨 Design

### Badge Notifiche
- **Posizione**: Top-right (absolute)
- **Colore**: Rosso (#EF4444)
- **Dimensione**: 20px x 20px
- **Stile**: Arrotondato, shadow
- **Numero**: Bianco bold, max "9+"

### Indicatore Mute
- **Posizione**: Bottom-right (absolute)
- **Colore**: Grigio (#64748B)
- **Dimensione**: 12px x 12px
- **Stile**: Cerchio, border bianco
- **Visibile solo quando muto**

### Icona Campanella
- **Colore**: Verde Basilico (#2D5A27)
- **Dimensione**: h-5 w-5 (mobile), h-6 w-6 (desktop)
- **Hover**: scale-105
- **Active**: scale-95
- **Stroke**: 2px

---

## 🔧 Integration nel Header

Sostituire nel `MobileProfileHeader.tsx`:

**Da rimuovere:**
```tsx
{/* Pulsante Push Notifications (compatto) */}
<div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center">
  <NotificationPermissionButton
    effectiveLanguage={effectiveLanguage}
    compact={true}
  />
</div>
{isUiWidgetVisible(currentUser, 'global.notifications') && (
  <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center surface-glass-sm px-1.5 surface-ghost-interactive transition-all duration-200 hover:scale-105 !text-slate-700 bg-white dark:bg-neutral-950 shadow-sm border border-slate-100 dark:border-white/10">
    <NotificationCenter denseTrigger />
  </div>
)}
```

**Da aggiungere:**
```tsx
<UnifiedBellButton
  userId={currentUser?.id}
  effectiveLanguage={effectiveLanguage}
  onMessageClick={(messageId) => {
    // Deep-link a messaggio
    navigateToMessage(messageId);
  }}
/>
```

---

## 📱 Interazione Utente

### Desktop
- **Click**: Apre dropdown
- **Hold 500ms**: Toggle mute (feedback suono + vibrazione)

### Mobile
- **Tap**: Apre dropdown
- **Long Press 500ms**: Toggle mute (feedback suono + vibrazione)

### Con Notifica Push
- Vibrazione: [200, 100, 200] (via service worker)
- Suono: F5 698Hz (se enabled)
- Badge: Numero aggiornato

---

## 🧩 Componenti Correlati

Richiesti per il funzionamento:

1. **NotificationDropdown**
   - Mostra ultime 5 messaggi
   - Anteprima testo (40 char)
   - Click → markAsRead + navigate

2. **useMessages Hook**
   - Fornisce messaggi e unreadCount
   - Real-time subscription
   - markAsRead() function

3. **useMultisensorialFeedback Hook**
   - Vibrazione tattile
   - Suono notifica
   - isSoundEnabled state
   - setIsSoundEnabled

4. **useMessageDeepLink Hook**
   - navigateToMessage()
   - Deep-linking con URL params

---

## 🧪 Testing Checklist

- [ ] Campanella visible nell'header
- [ ] Click breve apre dropdown
- [ ] Click fuori chiude dropdown
- [ ] Long press (500ms) toggle mute
- [ ] Indicatore mute visual (puntino grigio)
- [ ] Badge numero non letti
- [ ] Click messaggio chiude dropdown
- [ ] Click messaggio marca letto
- [ ] Vibrazione click breve
- [ ] Vibrazione long press
- [ ] Dark mode funziona
- [ ] Responsive mobile/desktop
- [ ] Spaziatura header allineata
- [ ] Accessibility labels corretti
- [ ] Tooltip "Long press per mutare" visible

---

## 📊 Commit

```
85a0ca1 - Unificazione campanella notifiche (pulizia header)
```

**File:**
- src/components/UnifiedBellButton.tsx (136 linee)

---

## 🚀 Integrazione nel Header

**Passaggi:**
1. Import UnifiedBellButton in MobileProfileHeader.tsx
2. Rimuovi NotificationPermissionButton e NotificationCenter
3. Aggiungi UnifiedBellButton nella sezione toolbar
4. Passa userId e onMessageClick callback
5. Test click breve e long press

---

**Status**: ✅ PRONTO PER INTEGRAZIONE

*Ultimo aggiornamento: 30 Marzo 2026*
