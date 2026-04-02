/**
 * Migrazione secondary_pin e elevated_role sulla tabella users.
 * Uso: node scripts/run-migration-secondary-pin.js
 */

import { getPostgresClientConfig, hintIfUnreachable } from './pg-env.js';

const sql = `
-- Aggiunge secondary_pin e elevated_role se non esistono già
ALTER TABLE users ADD COLUMN IF NOT EXISTS secondary_pin text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS elevated_role text;

-- Forza il refresh della cache di PostgREST
NOTIFY pgrst, 'reload schema';
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
    console.log('⏳ Aggiunta colonne secondary_pin e elevated_role...');
    await client.query(sql);
    console.log('✓ Colonna secondary_pin aggiunta (se non esisteva)');
    console.log('✓ Colonna elevated_role aggiunta (se non esisteva)');
    console.log('✓ Cache PostgREST ricaricata');
    await client.end();
    console.log('\n✅ Migrazione completata con successo.');
  } catch (err) {
    console.error('❌ Errore durante la migrazione:', err.message);
    hintIfUnreachable(err);
    process.exit(1);
  }
}

main();
