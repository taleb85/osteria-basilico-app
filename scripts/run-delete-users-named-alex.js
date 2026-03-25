/**
 * Elimina utenti con first_name esattamente "Alex" (case-insensitive). Non tocca "Alexis".
 * Uso: npm run db:delete-users-alex
 */

import { getPostgresConnectionUrl, hintIfUnreachable, supabaseLocalPgSsl } from './pg-env.js';

const sql = `
DELETE FROM public.users
WHERE lower(trim(first_name)) = 'alex';
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
    const r = await client.query(sql);
    await client.end();
    console.log('✅ Eliminati', r.rowCount ?? 0, 'utente/i con nome Alex.');
  } catch (err) {
    console.error('❌ Errore:', err.message);
    hintIfUnreachable(err);
    process.exit(1);
  }
}

main();
