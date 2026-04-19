import { supabase } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Wrapper robusto per accesso client Supabase.
 * 
 * - Dev: throw se client non configurato (env mancanti)
 * - Prod: return null con warning console (graceful degradation)
 * 
 * Uso: `const client = getSupabaseClient(); if (!client) return;`
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!supabase) {
    const msg = 'Supabase client non inizializzato: verifica VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY in .env';
    
    if (import.meta.env.DEV) {
      // Dev: fail fast con errore chiaro
      throw new Error(msg);
    } else {
      // Prod: graceful degradation
      console.warn(msg);
      return null;
    }
  }
  
  return supabase;
}

/**
 * Hook alternativo per componenti React (future).
 * Potrebbe lanciare error boundary in prod invece di return null.
 */
export function useSupabase(): SupabaseClient {
  const client = getSupabaseClient();
  
  if (!client) {
    // In prod questo log dovrebbe essere catturato da error boundary UI
    throw new Error('Supabase non disponibile: controlla configurazione ambiente');
  }
  
  return client;
}
