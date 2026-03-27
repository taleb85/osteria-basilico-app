/**
 * Diagnostica: elenca utenti con nome simile a Taleb e conteggio turni per user_id.
 * Uso: node scripts/inspect-taleb-shifts.js
 * Richiede VITE_SUPABASE_URL + VITE_SUPABASE_SERVICE_ROLE_KEY
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

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!URL || !KEY) {
    console.error('❌ VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY richiesti');
    process.exit(1);
  }
  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
  };

  const usersRes = await fetch(`${URL}/rest/v1/users?select=id,first_name,last_name,email,role&order=first_name`, {
    headers,
  });
  if (!usersRes.ok) throw new Error(await usersRes.text());
  const users = await usersRes.json();

  const shiftsRes = await fetch(`${URL}/rest/v1/shifts?select=user_id`, { headers });
  if (!shiftsRes.ok) throw new Error(await shiftsRes.text());
  const shifts = await shiftsRes.json();

  const countByUser = {};
  for (const s of shifts) {
    countByUser[s.user_id] = (countByUser[s.user_id] || 0) + 1;
  }

  const talebLike = users.filter((u) => {
    const fn = (u.first_name || '').toLowerCase().trim();
    const ln = (u.last_name || '').toLowerCase().trim();
    return fn.includes('taleb') || fn === 'taleb' || (u.email || '').toLowerCase().includes('taleb');
  });

  console.log('Utenti con "taleb" nel nome o email:\n');
  for (const u of talebLike) {
    const n = countByUser[u.id] || 0;
    console.log(
      `${u.id} | ${u.first_name} ${u.last_name} | ${u.email} | role=${u.role} | turni=${n}`
    );
  }

  const canonical = users.find(
    (u) =>
      (u.first_name || '').toLowerCase().trim() === 'taleb' &&
      (u.last_name || '').toLowerCase().trim() === 'barikhan'
  );
  if (canonical) {
    console.log('\nCanonico Taleb Barikhan:', canonical.id, '| turni:', countByUser[canonical.id] || 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
