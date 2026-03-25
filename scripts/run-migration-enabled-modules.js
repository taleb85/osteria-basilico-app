/**
 * Migrazione enabled_modules su users.
 * Uso: npm run db:migrate-enabled-modules
 */

import { getPostgresConnectionUrl, hintIfUnreachable, supabaseLocalPgSsl } from './pg-env.js';

const sql = `ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled_modules jsonb DEFAULT '[]'::jsonb;`;

async function main() {
  const res = getPostgresConnectionUrl();
  if (!res.dbUrl) {
    console.error('❌', res.error);
    process.exit(1);
  }
  try {
    const pg = (await import('pg')).default;
    const client = new pg.Client({
      connectionString: res.dbUrl,
      ssl: supabaseLocalPgSsl,
    });
    await client.connect();
    await client.query(sql);
    console.log('✓ enabled_modules column added');
    await client.end();
    console.log('\n✅ Migrazione enabled_modules completata.');
  } catch (err) {
    console.error('❌ Errore:', err.message);
    hintIfUnreachable(err);
    process.exit(1);
  }
}

main();
