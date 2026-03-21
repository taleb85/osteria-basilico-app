# Sincronizzazione tra PWA, browser e più dispositivi

## Dati sul server (Supabase)

Turni, utenti, timbrature, ferie e la maggior parte delle impostazioni vivono nel **database** o in **Supabase Storage**. Allineamento:

- **Realtime**: aggiornamenti in tempo reale quando la connessione è attiva (canali Supabase **distinti** per ogni iscrizione, così web + staff non si pestano i piedi).
- **Ritorno in primo piano**: all’apertura dell’app o del tab, l’app **ricarica i dati dal DB** anche **senza utente loggato** (es. **kiosk** timbrature), e quando torna la **rete** (`online`).
- **Utente loggato**: se la riga in `users` cambia (permessi, profilo), il Realtime aggiorna anche la **sessione** corrente; se lo stato non è più `active`, la sessione viene chiusa.
- **Storage** (flag, template ruoli): al massimo ogni ~12s quando torni in primo piano, per non sovraccaricare Supabase.

## Limitazioni iOS (Safari vs icona Home)

Su iPhone/iPad, **Safari** e l’app **Aggiungi a Home** usano spesso **contenitori di storage separati** (`localStorage`, cache, a volte sessione). Non è possibile unificarli da codice.

Restano **solo sul dispositivo** (non condivisi tra Safari e PWA):

- sessione “resta collegato” (`app_session`) — può servire **login separato**;
- notifiche già lette, banner installazione PWA, alcune preferenze UI;
- messaggio **Bacheca team** sulla Home (solo locale);
- periodo nascosto / cronologia locale del planning, se usati.

Per avere la stessa vista: **stesso canale** (solo PWA o solo Safari) oppure **tira per aggiornare** / riapri l’app dopo le modifiche.

## Regole lavoro / pause

Se configurate solo in locale (fallback Storage), possono differire tra due installazioni finché non sono salvate su Storage e ricaricate.
