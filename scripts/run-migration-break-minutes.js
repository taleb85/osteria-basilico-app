/**
 * Esegue la migrazione per break_minutes e is_auto_break su shifts.
 * Richiede: DATABASE_URL in .env
 *
 * Uso: node scripts/run-migration-break-minutes.js
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

const sql = `
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS break_minutes integer DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS is_auto_break boolean DEFAULT false;
`.trim();

async function main() {
  try {
    const pg = (await import('pg')).default;
    const client = new pg.Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: true },
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
    process.exit(1);
  }
}

main();
