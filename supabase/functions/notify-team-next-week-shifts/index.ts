import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const MANAGEMENT_ROLES = ['admin', 'manager', 'assistant_manager'] as const;

const PUSH_BODY =
  'Il nuovo calendario turni è disponibile. Controlla i tuoi orari nell\'app!';
const PUSH_URL = '/app?open=turni';

function todayRomeYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = Date.UTC(y!, m! - 1, d!) + delta * 86400000;
  const x = new Date(t);
  const yy = x.getUTCFullYear();
  const mm = String(x.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(x.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Lun=0 … Dom=6 (settimana che inizia il lunedì), data civile Europe/Rome. */
function weekdayMon0Rome(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  const wd = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0)).toLocaleDateString('en-US', {
    timeZone: 'Europe/Rome',
    weekday: 'short',
  });
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[wd] ?? 0;
}

function nextWeekMonSunRome(): { start: string; end: string } {
  const today = todayRomeYmd();
  const mon0 = weekdayMon0Rome(today);
  const thisMonday = addDaysYmd(today, -mon0);
  const nextMonday = addDaysYmd(thisMonday, 7);
  const nextSunday = addDaysYmd(nextMonday, 6);
  return { start: nextMonday, end: nextSunday };
}

function canNotifyTeam(op: {
  status: string | null;
  role: string;
  elevated_role: string | null;
}): boolean {
  if (op.status !== 'active') return false;
  if (MANAGEMENT_ROLES.includes(op.role as (typeof MANAGEMENT_ROLES)[number])) return true;
  const e = op.elevated_role;
  return !!(e && MANAGEMENT_ROLES.includes(e as (typeof MANAGEMENT_ROLES)[number]));
}

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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();
    const operator_user_id = typeof body.operator_user_id === 'string' ? body.operator_user_id.trim() : '';
    if (!operator_user_id) {
      return new Response(JSON.stringify({ error: 'operator_user_id richiesto' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: operator, error: opErr } = await supabase
      .from('users')
      .select('id, role, elevated_role, tenant_id, status')
      .eq('id', operator_user_id)
      .maybeSingle();

    if (opErr || !operator) {
      return new Response(JSON.stringify({ error: 'Operatore non trovato' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!canNotifyTeam(operator)) {
      return new Response(JSON.stringify({ error: 'Permesso negato' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { start, end } = nextWeekMonSunRome();

    let shiftQuery = supabase
      .from('shifts')
      .select('user_id')
      .gte('date', start)
      .lte('date', end)
      .neq('approval_status', 'draft');

    if (operator.tenant_id) {
      shiftQuery = shiftQuery.eq('tenant_id', operator.tenant_id);
    } else {
      shiftQuery = shiftQuery.is('tenant_id', null);
    }

    const { data: shiftRows, error: shErr } = await shiftQuery;
    if (shErr) throw shErr;

    const rawIds = [...new Set((shiftRows ?? []).map((r: { user_id: string }) => r.user_id))];
    if (rawIds.length === 0) {
      return new Response(
        JSON.stringify({
          recipients: 0,
          sent: 0,
          week_start: start,
          week_end: end,
          message: 'Nessun turno nella prossima settimana',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: activeUsers, error: uErr } = await supabase
      .from('users')
      .select('id')
      .in('id', rawIds)
      .eq('status', 'active');

    if (uErr) throw uErr;

    const recipientIds = (activeUsers ?? []).map((u: { id: string }) => u.id);
    if (recipientIds.length === 0) {
      return new Response(
        JSON.stringify({
          recipients: 0,
          sent: 0,
          week_start: start,
          week_end: end,
          message: 'Nessun utente attivo con turni',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pushUrl = `${SUPABASE_URL}/functions/v1/send-push-notification`;
    const BATCH = 100;
    let totalSent = 0;

    for (let i = 0; i < recipientIds.length; i += BATCH) {
      const slice = recipientIds.slice(i, i + BATCH);
      const pushRes = await fetch(pushUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message_type: 'targeted',
          recipient_ids: slice,
          push_title: 'FLOW',
          body: PUSH_BODY,
          type: 'schedule_week_available',
          url: PUSH_URL,
        }),
      });
      try {
        const j = await pushRes.json();
        if (typeof j.sent === 'number') totalSent += j.sent;
      } catch {
        /* ignore */
      }
    }

    return new Response(
      JSON.stringify({
        recipients: recipientIds.length,
        sent: totalSent,
        week_start: start,
        week_end: end,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[notify-team-next-week-shifts]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
