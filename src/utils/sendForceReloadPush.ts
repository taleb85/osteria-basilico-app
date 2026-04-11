/**
 * Invia una push notification di tipo force_reload a tutti i dispositivi connessi,
 * escludendo il mittente. Il service worker intercetta il tipo e posta FORCE_DATA_RELOAD
 * alle finestre aperte senza mostrare alcuna notifica di sistema.
 */
import { supabase } from '../lib/supabase';

export async function sendForceReloadPush(senderId?: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        sender_id: senderId ?? null,
        message_type: 'broadcast',
        type: 'force_reload',
        subject: 'Aggiornamento impostazioni',
        body: "L'amministratore ha aggiornato le impostazioni. L'app si aggiorna automaticamente.",
      },
    });
  } catch (err) {
    // Non bloccare l'operazione principale se il push fallisce
    console.warn('[sendForceReloadPush] Errore invio notifica:', err);
  }
}
