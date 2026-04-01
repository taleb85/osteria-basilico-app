import { createClient, SupabaseClient } from '@supabase/supabase-js';

function cleanEnv(val: string | undefined): string {
  return (val ?? '').replace(/[\r\n\s]+/g, '').trim();
}

const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseKey = cleanEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY);

/** Fetch senza cache: evita risposte stale su pull-to-refresh e sync multi-dispositivo */
const fetchNoCache: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' });

/**
 * L'app usa sessione custom (`app_session`) e PostgREST/Storage con chiave anonima:
 * non usiamo Supabase Auth per il login. Disattivare persistenza/token evita spam di lock
 * GoTrue su localStorage (es. con React Strict Mode) e richieste inutili.
 * 
 * Il client Supabase viene inizializzato al caricamento del modulo.
 * I componenti che lo usano (ad es. useMessages) verificano se è disponibile
 * prima di accedervi.
 * 
 * Cache bypass: fetchNoCache assicura che ogni richiesta sia fresca,
 * evitando problemi di stale data su pull-to-refresh e sync multi-dispositivo.
 */
export const supabase: SupabaseClient | null = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      global: { fetch: fetchNoCache },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

/** Client con service role key — bypassa RLS. Usato solo nel SuperAdminPanel. */
const serviceRoleKey = cleanEnv(import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
export const supabaseAdmin: SupabaseClient | null = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      global: { fetch: fetchNoCache },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        // Chiave storage separata per evitare il warning "Multiple GoTrueClient instances"
        storageKey: 'sb-admin-auth-token',
      },
    })
  : null;
