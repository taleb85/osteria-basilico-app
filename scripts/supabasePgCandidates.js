/**
 * Costruisce una lista di connection string Postgres da provare (pooler esplicito,
 * poi pooler per regione AWS, infine URL diretto). Utile quando db.*.supabase.co
 * non risolve (IPv6) o la password è stata incollata come [password].
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadRootDotenv } from './pg-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const p = resolve(__dirname, '../.env.local');
  if (!existsSync(p)) return;
  readFileSync(p, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

export function loadMigrationEnv() {
  loadRootDotenv();
  loadEnvLocal();
}

/** Se l’utente incolla [pwd] pensando sia placeholder Supabase */
function normalizeDbPassword(pw) {
  if (pw == null || pw === '') return pw;
  const d = decodeURIComponent(String(pw));
  if (d.startsWith('[') && d.endsWith(']')) return d.slice(1, -1);
  return d;
}

/** Estrae project ref da host db.<ref>.supabase.co */
export function parseDirectSupabase(dbUrl) {
  try {
    const normalized = dbUrl.replace(/^postgres(ql)?:\/\//i, 'postgres://');
    const u = new URL(normalized);
    const m = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (!m) return null;
    return {
      ref: m[1],
      password: normalizeDbPassword(u.password),
      username: u.username || 'postgres',
    };
  } catch {
    return null;
  }
}

/** Candidate pooler (session prima, poi transaction) per regioni AWS comuni. */
export function buildPoolerCandidates(directUrl) {
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

export function collectSupabasePgCandidates() {
  loadMigrationEnv();
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

export function maskConnectionString(cs) {
  try {
    const u = new URL(cs.replace(/^postgres(ql)?:\/\//i, 'postgres://'));
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(stringa non valida)';
  }
}

/** Rimuove sslmode così `pg` usa l’oggetto `ssl`. */
export function connectionStringForNodePg(cs) {
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

export function sslOption() {
  if (process.env.PG_REJECT_UNAUTHORIZED === '1') {
    return { rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}
