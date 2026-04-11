/**
 * Aggiunge admin_note alla tabella shifts.
 * Uso: node scripts/run-migration-admin-note.js
 */

import { getPostgresClientConfig, hintIfUnreachable } from './pg-env.js';

const sql = `
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS admin_note text;

NOTIFY pgrst, 'reload schema';

SELECT 'admin_note aggiunto a shifts' AS result;
`;

async function main() {
  const res = await getPostgresClientConfig();
  if (res.error) {
    console.error('❌', res.error);
    process.exit(1);
  }
  try {
    const pg = (await import('pg')).default;
    const client = new pg.Client(res.clientConfig);
    await client.connect();
    console.log('⏳ Aggiunta colonna admin_note a shifts...');
    const result = await client.query(sql);
    const last = result[result.length - 1];
    console.log('✓', last?.rows?.[0]?.result ?? 'ok');
    await client.end();
    console.log('\n✅ Migrazione completata.');
  } catch (err) {
    console.error('❌ Errore:', err.message);
    hintIfUnreachable(err);
    process.exit(1);
  }
}

main();
