/**
 * Aggiunge secondary_pin ed elevated_role alla tabella users.
 * Uso: node scripts/run-migration-secondary-pin.js
 */

import { getPostgresClientConfig, hintIfUnreachable } from './pg-env.js';

const sql = `
-- Aggiunge colonne per il PIN secondario / accesso elevato
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS secondary_pin text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS elevated_role text DEFAULT NULL;

-- Indice per lookup veloce al login
CREATE INDEX IF NOT EXISTS users_secondary_pin_idx
  ON public.users (secondary_pin)
  WHERE secondary_pin IS NOT NULL;

-- Forza refresh cache PostgREST
NOTIFY pgrst, 'reload schema';

SELECT 'secondary_pin e elevated_role aggiunti' AS result;
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
    console.log('⏳ Esecuzione migrazione secondary_pin...');
    const result = await client.query(sql);
    const last = result[result.length - 1];
    console.log('✓', last?.rows?.[0]?.result ?? 'ok');
    await client.end();
    console.log('\n✅ Migrazione completata. Ora puoi salvare PIN secondari.');
  } catch (err) {
    console.error('❌ Errore:', err.message);
    hintIfUnreachable(err);
    process.exit(1);
  }
}

main();
