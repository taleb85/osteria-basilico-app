import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')     ?? 'mailto:admin@flow-app.com';

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  try {
    const body = await req.json();
    const { message_id, sender_id, recipient_id, message_type, subject, body: msgBody, type: notifType } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Trova le subscription dei destinatari
    let query = supabase.from('push_subscriptions').select('*');

    if (message_type === 'private' && recipient_id) {
      query = query.eq('user_id', recipient_id);
    } else {
      // Broadcast → tutti tranne il mittente
      if (sender_id) query = query.neq('user_id', sender_id);
    }

    const { data: subscriptions, error } = await query;
    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'Nessuna subscription trovata' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const notification = JSON.stringify({
      title: subject || 'Nuovo messaggio',
      body: (msgBody || '').slice(0, 120),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      url: '/',
      message_id,
      ...(notifType ? { type: notifType } : {}),
    });

    const expiredEndpoints: string[] = [];

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth_key,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, notification);
          return true;
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            expiredEndpoints.push(sub.endpoint);
          }
          console.error('[push] Errore invio a', sub.endpoint, err?.statusCode, err?.message);
          return false;
        }
      })
    );

    // Rimuovi subscription scadute
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;

    return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-push-notification]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
