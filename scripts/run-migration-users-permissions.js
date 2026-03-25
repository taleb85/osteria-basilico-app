/**
 * Migrazione colonne permessi su users.
 * Uso: npm run db:migrate-permissions
 */

import { getPostgresConnectionUrl, hintIfUnreachable, supabaseLocalPgSsl } from './pg-env.js';

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
      console.log('✓', stmt.trim().slice(0, 60) + '...');
    }
    await client.end();
    console.log('\n✅ Migrazione completata.');
  } catch (err) {
    console.error('❌ Errore:', err.message);
    hintIfUnreachable(err);
    if (/EHOSTUNREACH|ENETUNREACH/i.test(String(err.message)) && process.env.DATABASE_URL && !process.env.DATABASE_POOLER_URL) {
      console.error(
        '\n   Supabase → Settings → Database → Connection string con “Use connection pooling” (Session).'
      );
      console.error('   Aggiungi DATABASE_POOLER_URL=postgresql://postgres.REF:…@aws-0-….pooler.supabase.com:5432/postgres');
    }
    process.exit(1);
  }
}

main();
