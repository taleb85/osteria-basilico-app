/**
 * Applica lo schema shift_templates (scripts/sql/apply-shift-templates-bundle.sql).
 * Uso: npm run db:apply-shift-templates
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getPostgresConnectionUrl, hintIfUnreachable, supabaseLocalPgSsl } from './pg-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sqlPath = resolve(__dirname, 'sql/apply-shift-templates-bundle.sql');
const sql = readFileSync(sqlPath, 'utf8');

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
    await client.end();
    console.log('✅ Schema shift_templates applicato (bundle).');
  } catch (err) {
    console.error('❌ Errore:', err.message);
    hintIfUnreachable(err);
    process.exit(1);
  }
}

main();
