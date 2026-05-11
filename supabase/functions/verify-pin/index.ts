import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface VerifyPinRequest {
  tenantId: string;
  name: string;
  pin: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: VerifyPinRequest = await req.json();
    const { tenantId, name, pin } = body;

    if (!tenantId || !name || !pin) {
      return new Response(JSON.stringify({ error: 'tenantId, name e pin sono richiesti' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Cerca utente per nome (first_name) + tenant_id
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, role, pin, status, tenant_id')
      .eq('tenant_id', tenantId)
      .or(`first_name.ilike.${name},email.ilike.${name}`)
      .limit(5);

    if (userError) {
      return new Response(JSON.stringify({ error: 'Errore database' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ error: 'Utente non trovato', code: 'USER_NOT_FOUND' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Controllo casi ambigui (omonimi)
    if (users.length > 1) {
      const exact = users.filter((u) => u.first_name.toLowerCase() === name.toLowerCase());
      if (exact.length !== 1) {
        return new Response(JSON.stringify({
          error: 'Nome ambiguo: specificare nome e cognome',
          code: 'AMBIGUOUS_NAME',
          candidates: users.map((u) => ({ id: u.id, first_name: u.first_name, last_name: u.last_name })),
        }), {
          status: 409,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    const user = users.length === 1 ? users[0] : users.find((u) => u.first_name.toLowerCase() === name.toLowerCase());

    if (!user) {
      return new Response(JSON.stringify({ error: 'Utente non trovato', code: 'USER_NOT_FOUND' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Verifica stato utente
    if (user.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Utente non attivo', code: 'USER_INACTIVE' }), {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Verifica PIN (server-side comparison)
    const pinMatch = user.pin === pin;

    if (!pinMatch) {
      return new Response(JSON.stringify({ error: 'PIN errato', code: 'WRONG_PIN' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Login riuscito: restituisci dati utente (MAI il PIN)
    const { pin: _, ...safeUser } = user;

    return new Response(JSON.stringify({
      ok: true,
      user: {
        id: safeUser.id,
        first_name: safeUser.first_name,
        last_name: safeUser.last_name,
        role: safeUser.role,
        status: safeUser.status,
        tenant_id: safeUser.tenant_id,
      },
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error', detail: err instanceof Error ? err.message : 'Unknown' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
