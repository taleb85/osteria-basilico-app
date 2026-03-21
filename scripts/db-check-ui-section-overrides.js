/**
 * Verifica (e opzionalmente crea) la colonna public.users.ui_section_overrides.
 *
 * Richiede DATABASE_URL o DATABASE_POOLER_URL in .env (come db:ensure-users).
 *
 * Uso:
 *   node scripts/db-check-ui-section-overrides.js           # solo verifica + fix se manca
 *   node scripts/db-check-ui-section-overrides.js --check-only
 */

import { setDefaultResultOrder } from 'node:dns';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

try {
  setDefaultResultOrder('ipv4first');
} catch {
  /* ignore */
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const checkOnly = process.argv.includes('--check-only');

function loadEnvFile(name) {
  const p = resolve(__dirname, '..', name);
  if (!existsSync(p)) return;
  readFileSync(p, 'utf8')
    .split('\n')
    .forEach((line) => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    });
}

loadEnvFile('.env');
loadEnvFile('.env.local');

function parseDirectSupabase(dbUrl) {
  try {
    const normalized = dbUrl.replace(/^postgres(ql)?:\/\//i, 'postgres://');
    const u = new URL(normalized);
    const m = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (!m) return null;
    return { ref: m[1], password: u.password, username: u.username || 'postgres' };
  } catch {
    return null;
  }
}

function buildPoolerCandidates(directUrl) {
  const parsed = parseDirectSupabase(directUrl);
  if (!parsed) return [];
  const { ref, password } = parsed;
  const encPass = encodeURIComponent(password);
  const preferred = process.env.SUPABASE_POOLER_REGION?.trim();
  const regions = [
    ...(preferred ? [preferred] : []),
    'eu-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'us-east-1',
    'us-east-2',
  ].filter((r, i, a) => r && a.indexOf(r) === i);
  const out = [];
  for (const r of regions) {
    const host = `aws-0-${r}.pooler.supabase.com`;
    out.push(`postgresql://postgres.${ref}:${encPass}@${host}:5432/postgres?sslmode=require`);
    out.push(`postgresql://postgres.${ref}:${encPass}@${host}:6543/postgres?sslmode=require`);
  }
  return out;
}

function collectConnectionCandidates() {
  const seen = new Set();
  const candidates = [];
  const add = (u) => {
    if (!u || typeof u !== 'string' || !u.trim()) return;
    const t = u.trim();
    if (seen.has(t)) return;
    seen.add(t);
    candidates.push(t);
  };
  const poolerExplicit = process.env.DATABASE_POOLER_URL;
  const direct = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  add(poolerExplicit);
  if (direct) {
    for (const p of buildPoolerCandidates(direct)) add(p);
    add(direct);
  }
  return candidates;
}

function maskConnectionString(cs) {
  try {
    const u = new URL(cs.replace(/^postgres(ql)?:\/\//i, 'postgres://'));
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(invalid)';
  }
}

function connectionStringForNodePg(cs) {
  try {
    const normalized = cs.replace(/^postgres(ql)?:\/\//i, 'postgres://');
    const u = new URL(normalized);
    u.searchParams.delete('sslmode');
    let out = u.toString();
    if (out.endsWith('?')) out = out.slice(0, -1);
    return out;
  } catch {
    return cs.replace(/[?&]sslmode=[^&]*/gi, '').replace(/\?&/g, '?').replace(/\?$/g, '');
  }
}

function sslOption() {
  if (process.env.PG_REJECT_UNAUTHORIZED === '1') return { rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

const CHECK_SQL = `
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'ui_section_overrides';
`;

async function main() {
  const candidates = collectConnectionCandidates();
  if (candidates.length === 0) {
    console.error('❌ Nessuna connection string in .env (DATABASE_URL / DATABASE_POOLER_URL).');
    console.error('   Non posso controllare il DB da qui. Esegui in Supabase → SQL Editor:');
    console.error('   supabase/migrations/20260317240000_add_ui_section_overrides_to_users.sql');
    process.exit(2);
  }

  const migrationPath = resolve(__dirname, '../supabase/migrations/20260317240000_add_ui_section_overrides_to_users.sql');
  const migrateSql = readFileSync(migrationPath, 'utf8');

  const pg = (await import('pg')).default;
  let lastErr = null;

  for (let attempt = 0; attempt < candidates.length; attempt++) {
    const connectionString = candidates[attempt];
    const conn =
      process.env.PG_REJECT_UNAUTHORIZED === '1'
        ? connectionString
        : connectionStringForNodePg(connectionString);
    const client = new pg.Client({
      connectionString: conn,
      ssl: sslOption(),
      connectionTimeoutMillis: 15000,
    });
    try {
      await client.connect();
      const { rows } = await client.query(CHECK_SQL);

      if (rows.length > 0) {
        console.log('✅ Colonna `public.users.ui_section_overrides` presente.');
        console.log(`   Tipo: ${rows[0].data_type}, default: ${rows[0].column_default ?? '(null)'}`);
        console.log(`   Connessione: ${maskConnectionString(connectionString)}`);
        await client.end();
        process.exit(0);
      }

      console.warn('⚠️  Colonna `ui_section_overrides` assente sul database connesso.');
      if (checkOnly) {
        console.error('   Esegui senza --check-only per applicare la migrazione, oppure SQL Editor.');
        await client.end();
        process.exit(1);
      }

      await client.query(migrateSql);
      console.log('✅ Migrazione applicata (ADD COLUMN IF NOT EXISTS).');
      console.log(`   Connessione: ${maskConnectionString(connectionString)}`);
      await client.end();
      process.exit(0);
    } catch (err) {
      lastErr = err;
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      if (candidates.length > 1) {
        console.warn(`⚠️  Tentativo ${attempt + 1}/${candidates.length}: ${String(err.message || err).split('\n')[0]}`);
      }
    }
  }

  console.error('❌ Connessione fallita.');
  if (lastErr) console.error('   ', lastErr.message);
  process.exit(1);
}

main();
