import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface ApiError { error: string; code: string }
function err(msg: string, code: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg, code } satisfies ApiError), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/v1\/?/, '').split('/').filter(Boolean);
  const tenantId = req.headers.get('x-tenant-id');
  const auth = req.headers.get('authorization');
  const apiKey = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!tenantId) return err('x-tenant-id header required', 'MISSING_TENANT', 400);
  if (!apiKey) return err('Authorization Bearer token required', 'MISSING_AUTH', 401);

  const { data: validKey } = await supabase
    .from('api_keys')
    .select('tenant_id')
    .eq('key', apiKey)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .maybeSingle();
  if (!validKey) return err('Invalid or inactive API key', 'INVALID_KEY', 403);

  const resource = path[0];

  try {
    if (resource === 'users' && req.method === 'GET') {
      const { data } = await supabase.from('users').select('id, first_name, last_name, email, role, status, department, hourly_rate_eur').eq('tenant_id', tenantId).order('sort_order');
      return new Response(JSON.stringify(data ?? []), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (resource === 'users' && req.method === 'POST') {
      const body = await req.json();
      const { data, error } = await supabase.from('users').insert({ ...body, tenant_id: tenantId }).select().single();
      if (error) return err(error.message, 'INSERT_ERROR', 400);
      return new Response(JSON.stringify(data), { status: 201, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (resource === 'shifts' && req.method === 'GET') {
      const startDate = url.searchParams.get('start_date') ?? new Date().toISOString().slice(0, 10);
      const endDate = url.searchParams.get('end_date');
      let query = supabase.from('shifts').select('*').eq('tenant_id', tenantId).gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);
      const { data } = await query.order('date').order('start_time');
      return new Response(JSON.stringify(data ?? []), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (resource === 'shifts' && req.method === 'POST') {
      const body = await req.json();
      const { data, error } = await supabase.from('shifts').insert({ ...body, tenant_id: tenantId }).select().single();
      if (error) return err(error.message, 'INSERT_ERROR', 400);
      return new Response(JSON.stringify(data), { status: 201, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (resource === 'punch-records' && req.method === 'GET') {
      const userId = url.searchParams.get('user_id');
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');
      let query = supabase.from('punch_records').select('*').eq('tenant_id', tenantId);
      if (userId) query = query.eq('user_id', userId);
      if (startDate) query = query.gte('timestamp', startDate);
      if (endDate) query = query.lte('timestamp', endDate);
      const { data } = await query.order('timestamp', { ascending: false }).limit(500);
      return new Response(JSON.stringify(data ?? []), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (resource === 'holidays' && req.method === 'GET') {
      const { data } = await supabase.from('holiday_requests').select('*').eq('tenant_id', tenantId).order('start_date');
      return new Response(JSON.stringify(data ?? []), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (resource === 'export') {
      const type = url.searchParams.get('type') ?? 'shifts';
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');
      if (type === 'timesheets') {
        let q = supabase.from('punch_records').select('*, users(first_name, last_name)').eq('tenant_id', tenantId);
        if (startDate) q = q.gte('timestamp', startDate);
        if (endDate) q = q.lte('timestamp', endDate);
        const { data } = await q.order('timestamp', { ascending: false }).limit(1000);
        return new Response(JSON.stringify(data ?? []), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    return err(`Not found: ${req.method} /api/v1/${resource}`, 'NOT_FOUND', 404);
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Internal error', 'SERVER_ERROR', 500);
  }
});
