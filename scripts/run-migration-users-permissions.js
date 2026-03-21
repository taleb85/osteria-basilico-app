/**
 * Esegue la migrazione per le colonne permessi users.
 * Richiede: DATABASE_URL in .env (Supabase > Settings > Database > Connection string URI)
 *
 * Uso: node scripts/run-migration-users-permissions.js
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

let dbUrl = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('❌ Imposta DATABASE_URL o DATABASE_POOLER_URL in .env');
  process.exit(1);
}
// Se DATABASE_URL fallisce con IPv6, usa il pooler (Session mode)
// Formato pooler: postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres

const sql = `
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_create_shifts boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_approve_shifts boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_total_hours boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_staff_pins boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_drafts boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_request_holidays boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_punch_from_app boolean DEFAULT true;
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
      console.log('✓', stmt.trim().slice(0, 60) + '...');
    }
    await client.end();
    console.log('\n✅ Migrazione completata.');
  } catch (err) {
    if (err.message.includes('EHOSTUNREACH') && process.env.DATABASE_URL && !process.env.DATABASE_POOLER_URL) {
      console.error('❌ Connessione IPv6 non raggiungibile. Usa il Connection Pooler:\n');
      console.error('   1. Supabase Dashboard → Settings → Database');
      console.error('   2. Copia "Connection string" con toggle "Use connection pooling" = ON (Session mode)');
      console.error('   3. Aggiungi in .env: DATABASE_POOLER_URL=postgresql://postgres.xxx:...@aws-0-xx.pooler.supabase.com:5432/postgres');
      console.error('\n   Oppure esegui il SQL manualmente in SQL Editor.');
    } else {
      console.error('❌ Errore:', err.message);
    }
    process.exit(1);
  }
}

main();
