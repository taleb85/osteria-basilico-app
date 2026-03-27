/**
 * Elimina utenti da Supabase Auth (auth.users) per UUID.
 * Utile dopo merge DB su public.users: rimuove login duplicati se l’id Auth coincide.
 *
 * Uso:
 *   node scripts/delete-auth-users-by-id.js <uuid> [<uuid> ...]
 * Esempio (UUID sorgenti merge Taleb):
 *   node scripts/delete-auth-users-by-id.js e6e924e6-dc41-4daf-ab74-11372a49278b fd8be391-de6c-434e-a83a-8cd00af57f9f
 *
 * Richiede .env: VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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

const uuids = process.argv.slice(2).filter((a) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a));

async function main() {
  if (!URL || !KEY) {
    console.error('❌ VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY richiesti in .env');
    process.exit(1);
  }
  if (uuids.length === 0) {
    console.error('❌ Passa almeno un UUID valido come argomento.');
    process.exit(1);
  }

  const supabase = createClient(URL, KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const id of uuids) {
    const { data, error } = await supabase.auth.admin.deleteUser(id);
    if (error) {
      if (String(error.message || '').toLowerCase().includes('not found') || error.status === 404) {
        console.log('⏭️  Auth: nessun utente', id);
      } else {
        console.error('❌', id, error.message);
      }
    } else {
      console.log('✅ Eliminato da Auth:', id, data?.user?.email ?? '');
    }
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
