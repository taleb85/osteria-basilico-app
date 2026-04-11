import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const REMINDER_BODY =
  "Ti sei dimenticato di timbrare l'uscita? Clicca qui per chiudere il turno";
const OPEN_PATH = '/app?open=punch_exit';

function authorize(req: Request): boolean {
  const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (CRON_SECRET && bearer === CRON_SECRET) return true;
  if (bearer && bearer === SUPABASE_SERVICE_ROLE_KEY) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    });
  }

  if (!authorize(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: rows, error: rpcError } = await supabase.rpc('get_stale_open_punch_for_reminder');
  if (rpcError) {
    console.error('[punch-exit-reminder-cron]', rpcError);
    return new Response(JSON.stringify({ error: String(rpcError.message) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const list = (rows ?? []) as { user_id: string; punch_record_id: string }[];
  let pushed = 0;
  let logged = 0;

  for (const row of list) {
    const pushUrl = `${SUPABASE_URL}/functions/v1/send-push-notification`;
    const pushRes = await fetch(pushUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message_type: 'private',
        recipient_id: row.user_id,
        push_title: 'FLOW',
        body: REMINDER_BODY,
        type: 'punch_exit_reminder',
        url: OPEN_PATH,
      }),
    });

    let sent = 0;
    try {
      const j = await pushRes.json();
      sent = typeof j.sent === 'number' ? j.sent : 0;
    } catch {
      sent = 0;
    }

    if (sent > 0) {
      pushed += sent;
      const { error: insErr } = await supabase.from('punch_exit_reminder_log').insert({
        punch_record_id: row.punch_record_id,
        user_id: row.user_id,
      });
      if (!insErr) logged += 1;
      else console.error('[punch-exit-reminder-cron] log insert', insErr);
    }
  }

  return new Response(
    JSON.stringify({
      candidates: list.length,
      subscriptions_notified: pushed,
      reminders_logged: logged,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
