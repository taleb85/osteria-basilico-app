/**
 * Elimina utenti con first_name esattamente "Alex" (case-insensitive). Non tocca "Alexis".
 * Richiede: DATABASE_URL o DATABASE_POOLER_URL in .env (come gli altri script run-migration-*).
 *
 * Uso: node scripts/run-delete-users-named-alex.js
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const dbUrl = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('❌ Imposta DATABASE_URL o DATABASE_POOLER_URL in .env nella root del progetto.');
  process.exit(1);
}

const sql = `
DELETE FROM public.users
WHERE lower(trim(first_name)) = 'alex';
`.trim();

async function main() {
  try {
    const pg = (await import('pg')).default;
    const client = new pg.Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: true },
    });
    await client.connect();
    const res = await client.query(sql);
    await client.end();
    console.log('✅ Eliminati', res.rowCount ?? 0, 'utente/i con nome Alex.');
  } catch (err) {
    if (err.message.includes('EHOSTUNREACH') && process.env.DATABASE_URL && !process.env.DATABASE_POOLER_URL) {
      console.error('❌ IPv6 non raggiungibile. Usa DATABASE_POOLER_URL (Session mode) come negli altri script.');
    } else {
      console.error('❌ Errore:', err.message);
    }
    process.exit(1);
  }
}

main();
