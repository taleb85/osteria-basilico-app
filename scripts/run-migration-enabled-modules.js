/**
 * Esegue la migrazione per enabled_modules su users.
 * Richiede: DATABASE_URL in .env
 *
 * Uso: node scripts/run-migration-enabled-modules.js
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
  console.error('❌ Imposta DATABASE_URL in .env');
  process.exit(1);
}

const sql = `ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled_modules jsonb DEFAULT '[]'::jsonb;`;

async function main() {
  try {
    const pg = (await import('pg')).default;
    const client = new pg.Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: true },
    });
    await client.connect();
    await client.query(sql);
    console.log('✓ enabled_modules column added');
    await client.end();
    console.log('\n✅ Migrazione enabled_modules completata.');
  } catch (err) {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  }
}

main();
