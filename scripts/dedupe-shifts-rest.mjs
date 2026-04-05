/**
 * Elimina righe duplicate in `shifts` con lo stesso slot
 * (tenant_id, user_id, date, start_time, end_time, type).
 * Mantiene il turno con timbratura (shift_id su punch_records) se presente, altrimenti il più vecchio.
 *
 * Uso:
 *   node scripts/dedupe-shifts-rest.mjs           # dry-run (solo conteggio)
 *   node scripts/dedupe-shifts-rest.mjs --execute # elimina duplicati
 *
 * Richiede in .env: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'count=exact',
};

function padTime(t) {
  return (t ?? '').toString().trim().slice(0, 5);
}

function slotKey(s) {
  const tid = s.tenant_id ?? '';
  return `${tid}|${s.user_id}|${s.date}|${padTime(s.start_time)}|${padTime(s.end_time)}|${s.type}`;
}

async function fetchAllShifts() {
  const pageSize = 1000;
  const out = [];
  let offset = 0;
  for (;;) {
    const u = new URL(`${SUPABASE_URL}/rest/v1/shifts`);
    u.searchParams.set(
      'select',
      'id,tenant_id,user_id,date,start_time,end_time,type,created_at'
    );
    u.searchParams.set('order', 'created_at.asc');
    u.searchParams.set('limit', String(pageSize));
    u.searchParams.set('offset', String(offset));
    const res = await fetch(u, { headers });
    if (!res.ok) throw new Error(`shifts ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return out;
}

/** shift_id -> ha almeno una punch */
async function fetchPunchShiftIds(shiftIds) {
  const has = new Set();
  const chunk = 80;
  for (let i = 0; i < shiftIds.length; i += chunk) {
    const part = shiftIds.slice(i, i + chunk);
    const u = new URL(`${SUPABASE_URL}/rest/v1/punch_records`);
    u.searchParams.set('select', 'shift_id');
    u.searchParams.set('shift_id', `in.(${part.join(',')})`);
    const res = await fetch(u, { headers });
    if (!res.ok) throw new Error(`punch_records ${res.status}: ${await res.text()}`);
    const rows = await res.json();
    for (const r of rows) {
      if (r.shift_id) has.add(r.shift_id);
    }
  }
  return has;
}

async function deleteByIds(ids) {
  const chunk = 40;
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk);
    const u = `${SUPABASE_URL}/rest/v1/shifts?id=in.(${part.join(',')})`;
    const res = await fetch(u, { method: 'DELETE', headers });
    if (!res.ok) throw new Error(`delete ${res.status}: ${await res.text()}`);
  }
}

async function main() {
  const execute = process.argv.includes('--execute');
  if (!SUPABASE_URL || !KEY) {
    console.error('❌ Servono VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  console.log('⏳ Scarico tutti i turni…');
  const shifts = await fetchAllShifts();
  console.log(`   Totale righe: ${shifts.length}`);

  const groups = new Map();
  for (const s of shifts) {
    const k = slotKey(s);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }

  const dupGroups = [...groups.entries()].filter(([, arr]) => arr.length > 1);
  if (dupGroups.length === 0) {
    console.log('✅ Nessun duplicato (stesso slot).');
    return;
  }

  const allDupIds = dupGroups.flatMap(([, arr]) => arr.map((x) => x.id));
  console.log(`⏳ Gruppi con duplicati: ${dupGroups.length} (righe coinvolte: ${allDupIds.length})`);
  console.log('⏳ Verifico timbrature…');
  const withPunch = await fetchPunchShiftIds(allDupIds);

  const toDelete = [];
  for (const [, arr] of dupGroups) {
    const sorted = [...arr].sort((a, b) => {
      const pa = withPunch.has(a.id) ? 1 : 0;
      const pb = withPunch.has(b.id) ? 1 : 0;
      if (pb !== pa) return pb - pa;
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      if (ta !== tb) return ta - tb;
      return a.id.localeCompare(b.id);
    });
    const keep = sorted[0];
    for (let i = 1; i < sorted.length; i++) toDelete.push(sorted[i].id);
  }

  console.log(`   Da eliminare: ${toDelete.length} righe (ne resta 1 per slot).`);
  if (!execute) {
    console.log('\nℹ️  Dry-run: nessuna modifica. Esegui con --execute per applicare.');
    return;
  }

  console.log('⏳ Elimino…');
  await deleteByIds(toDelete);
  console.log(`✅ Eliminate ${toDelete.length} righe duplicate.`);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
