/**
 * Migrazione break_minutes / is_auto_break su shifts.
 * Uso: npm run db:migrate-break-minutes
 */

import { getPostgresConnectionUrl, hintIfUnreachable, supabaseLocalPgSsl } from './pg-env.js';

const sql = `
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS break_minutes integer DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS is_auto_break boolean DEFAULT false;
`.trim();

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
    for (const stmt of sql.split(';').filter(Boolean)) {
      await client.query(stmt.trim() + ';');
      console.log('✓', stmt.trim().slice(0, 70));
    }
    await client.end();
    console.log('\n✅ Migrazione break_minutes completata.');
  } catch (err) {
    console.error('❌ Errore:', err.message);
    hintIfUnreachable(err);
    process.exit(1);
  }
}

main();
