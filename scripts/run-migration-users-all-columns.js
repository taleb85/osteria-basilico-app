/**
 * Applica su Postgres tutte le colonne `users` attese dall'app (idempotente).
 *
 * Richiede in .env una di: DATABASE_URL, DATABASE_POOLER_URL, SUPABASE_DB_URL.
 * Prova automaticamente pooler multi-regione (vedi scripts/supabasePgCandidates.js).
 * Opzionale: SUPABASE_POOLER_REGION=eu-central-1
 *
 * Uso: npm run db:ensure-users
 */

import { setDefaultResultOrder } from 'node:dns';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/** Evita EHOSTUNREACH su IPv6 quando il direct connection risolve solo AAAA. */
try {
  setDefaultResultOrder('ipv4first');
} catch {
  /* Node vecchio */
}

import {
  collectSupabasePgCandidates,
  connectionStringForNodePg,
  sslOption,
  maskConnectionString,
} from './supabasePgCandidates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sqlPath = resolve(__dirname, '../supabase/migrations/20260317200000_ensure_all_users_app_columns.sql');
const sql = readFileSync(sqlPath, 'utf8');

async function main() {
  const candidates = collectSupabasePgCandidates();
  if (candidates.length === 0) {
    console.error('❌ Nessuna connection string: imposta DATABASE_URL o DATABASE_POOLER_URL in .env');
    console.error('   In alternativa incolla in Supabase → SQL Editor il file:');
    console.error('   supabase/migrations/20260317200000_ensure_all_users_app_columns.sql');
    process.exit(1);
  }

  const pg = (await import('pg')).default;
  let lastErr = null;
  let attempt = 0;

  for (const connectionString of candidates) {
    attempt += 1;
    const conn =
      process.env.PG_REJECT_UNAUTHORIZED === '1'
        ? connectionString
        : connectionStringForNodePg(connectionString);
    const client = new pg.Client({
      connectionString: conn,
      ssl: sslOption(),
      connectionTimeoutMillis: 15000,
    });
    try {
      await client.connect();
      await client.query(sql);
      console.log('✅ Migrazione users completata (colonne app allineate).');
      console.log(`   Connessione usata (${attempt}/${candidates.length}): ${maskConnectionString(connectionString)}`);
      await client.end();
      return;
    } catch (err) {
      lastErr = err;
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      const msg = String(err.message || err);
      if (candidates.length > 1) {
        console.warn(`⚠️  Tentativo ${attempt} fallito: ${msg.split('\n')[0]}`);
      }
    }
  }

  console.error('❌ Tutti i tentativi di connessione sono falliti.');
  if (lastErr) console.error('   Ultimo errore:', lastErr.message);
  console.error('\n→ Imposta DATABASE_POOLER_URL (Session pooler) da Supabase Dashboard, oppure');
  console.error('   incolla manualmente in SQL Editor: supabase/migrations/20260317200000_ensure_all_users_app_columns.sql');
  process.exit(1);
}

main();
