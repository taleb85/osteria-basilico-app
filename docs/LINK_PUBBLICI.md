# Link pubblici (Kiosk vs Profili)

| Uso | URL | Note |
|-----|-----|------|
| **Solo timbratura** (tablet in sala) | `https://<dominio>/timbratura` | Nessun login obbligatorio |
| **Accesso staff / manager** | `https://<dominio>/profilo` | Email + PIN → `/app` |

### Retrocompatibilità

- `/kiosk` → reindirizza a `/timbratura`
- `/login` → reindirizza a `/profilo`

### PWA (Android / Chrome)

Dal launcher possono comparire due scorciatoie: **Timbratura** e **Area profili**, con gli URL sopra.

### Avvio predefinito

`/` e `start_url` del manifest restano sulla root: l’app reindirizza a **`/timbratura`**. Per aprire direttamente l’area login, usa un segnalibro o la scorciatoia **Profili**.
