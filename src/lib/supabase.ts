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
 * CRITICAL: Se questo export è `null` (env mancanti), l'app degrada gracefully in prod.
 * Usa sempre `getSupabaseClient()` da `./supabaseClient.ts` per error handling robusto.
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

/**
 * SECURITY: Service role key rimossa dal bundle client.
 * Se serve admin SDK, usa Vercel Serverless Function con variabile non-VITE_ prefixed.
 * SuperAdminPanel e operazioni privilegiate devono migrare a endpoint server-side.
 */
