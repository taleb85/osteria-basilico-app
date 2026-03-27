/**
 * Esegue la migrazione one-off che unifica ADMIN + TALEB (non Barikhan) in Taleb Barikhan.
 * Uso: npm run db:merge-users-taleb
 *
 * Richiede DATABASE_POOLER_URL o DATABASE_URL in .env (stesso pattern degli altri script DB).
 * In alternativa applica la migrazione con Supabase CLI: supabase db push
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getPostgresConnectionUrl, hintIfUnreachable, supabaseLocalPgSsl } from './pg-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sqlPath = resolve(__dirname, '../supabase/migrations/20260329120000_merge_admin_taleb_into_taleb_barikhan.sql');

async function main() {
  const res = getPostgresConnectionUrl();
  if (!res.dbUrl) {
    console.error('❌', res.error);
    process.exit(1);
  }
  const sql = readFileSync(sqlPath, 'utf8');
  try {
    const pg = (await import('pg')).default;
    const client = new pg.Client({
      connectionString: res.dbUrl,
      ssl: supabaseLocalPgSsl,
    });
    await client.connect();
    await client.query(sql);
    await client.end();
    console.log('✅ Migrazione merge utenti eseguita. Controlla i NOTICE nel log Postgres se necessario.');
  } catch (err) {
    console.error('❌ Errore:', err.message);
    hintIfUnreachable(err);
    process.exit(1);
  }
}

main();
