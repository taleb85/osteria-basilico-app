/**
 * Applica su Postgres tutte le colonne `users` attese dall'app (idempotente).
 *
 * Richiede in .env una di:
 *   DATABASE_URL
 *   DATABASE_POOLER_URL
 *   SUPABASE_DB_URL
 *
 * (Supabase Dashboard → Settings → Database → Connection string, meglio pooler Session mode)
 *
 * Se hai solo DATABASE_URL diretto (IPv6) e fallisce, lo script prova automaticamente
 * le stringhe pooler `postgres.<ref>@aws-0-<region>.pooler.supabase.com` (session 5432, poi 6543).
 * Opzionale: SUPABASE_POOLER_REGION=eu-central-1 (regione del progetto dalla dashboard) per provare quella per prima.
 *
 * SSL: per Postgres gestito (Supabase) la catena può non essere accettata da Node con
 * verify-full. Di default: rejectUnauthorized=false (solo per questo script da locale).
 * Per forzare verifica: PG_REJECT_UNAUTHORIZED=1
 *
 * Uso: npm run db:ensure-users
 */

import { setDefaultResultOrder } from 'node:dns';
import { readFileSync, existsSync } from 'fs';

/** Evita EHOSTUNREACH su IPv6 quando il direct connection risolve solo AAAA. */
try {
  setDefaultResultOrder('ipv4first');
} catch {
  /* Node vecchio */
}
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(name) {
  const p = resolve(__dirname, '..', name);
  if (!existsSync(p)) return;
  readFileSync(p, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const sqlPath = resolve(__dirname, '../supabase/migrations/20260317200000_ensure_all_users_app_columns.sql');
const sql = readFileSync(sqlPath, 'utf8');

/** Estrae project ref da host db.<ref>.supabase.co */
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

/** Candidate pooler (session prima, poi transaction) per regioni AWS comuni. */
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
    'eu-central-2',
    'eu-north-1',
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ap-northeast-2',
    'ap-south-1',
    'ca-central-1',
    'sa-east-1',
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
    return '(stringa non valida)';
  }
}

/** Rimuove sslmode dalla URL così `pg` applica l'oggetto `ssl` (rejectUnauthorized: false). */
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
  if (process.env.PG_REJECT_UNAUTHORIZED === '1') {
    return { rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

async function main() {
  const candidates = collectConnectionCandidates();
  if (candidates.length === 0) {
    console.error('❌ Nessuna connection string: imposta DATABASE_URL o DATABASE_POOLER_URL in .env');
    console.error('   In alternativa incolla in Supabase → SQL Editor il file:');
    console.error('   supabase/migrations/20260317200000_ensure_all_users_app_columns.sql');
    process.exit(1);
  }

  const pg = (await import('pg')).default;
  let lastErr = null;
  let attempt = 0;

  for (const connectionString of candidates) {
    attempt += 1;
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
      await client.query(sql);
      console.log('✅ Migrazione users completata (colonne app allineate).');
      console.log(`   Connessione usata (${attempt}/${candidates.length}): ${maskConnectionString(connectionString)}`);
      await client.end();
      return;
    } catch (err) {
      lastErr = err;
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      const msg = String(err.message || err);
      if (candidates.length > 1) {
        console.warn(`⚠️  Tentativo ${attempt} fallito: ${msg.split('\n')[0]}`);
      }
    }
  }

  console.error('❌ Tutti i tentativi di connessione sono falliti.');
  if (lastErr) console.error('   Ultimo errore:', lastErr.message);
  console.error('\n→ Imposta DATABASE_POOLER_URL (Session pooler) da Supabase Dashboard, oppure');
  console.error('   incolla manualmente in SQL Editor: supabase/migrations/20260317200000_ensure_all_users_app_columns.sql');
  process.exit(1);
}

main();
