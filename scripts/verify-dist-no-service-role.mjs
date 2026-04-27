/**
 * Dopo `vite build`, il client non deve contenere riferimenti a chiave service role.
 * In dev, Vite espone invece l'intero import.meta.env (test e2e su dev non sono attendibili).
 */
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const BAD = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_SERVICE_ROLE',
  'supabaseAdmin',
  'service_role', // es. claim JWT con ruolo amministratore server
];

const root = join(process.cwd(), 'dist', 'assets');
const files = await readdir(root).catch(() => []);
const js = files.filter((f) => f.endsWith('.js'));

let failed = false;
for (const f of js) {
  const t = await readFile(join(root, f), 'utf-8');
  for (const p of BAD) {
    if (t.includes(p)) {
      console.error(`[verify-dist] Trovato pattern vietato in dist/assets/${f}: ${p}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
if (js.length === 0) {
  console.warn('[verify-dist] Nessun .js in dist/assets — salta?');
}
console.log(`[verify-dist] OK (${js.length} chunk controllati)`);
