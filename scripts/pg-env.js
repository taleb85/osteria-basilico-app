/**
 * Carica .env dalla root, preferisce IPv4 (evita EHOSTUNREACH su db.….supabase.co),
 * espone l’URL Postgres per gli script di migrazione.
 */

import dns from 'node:dns';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

dns.setDefaultResultOrder('ipv4first');

/** Da script locali: la catena TLS di Supabase/Pooler non è sempre validata da Node con default CA. */
export const supabaseLocalPgSsl = { rejectUnauthorized: false };

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadRootDotenv() {
  const envPath = resolve(__dirname, '../.env');
  if (!existsSync(envPath)) return;
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

/**
 * Pooler prima della URL diretta (IPv6 spesso non raggiungibile).
 * @returns {{ dbUrl: string } | { dbUrl: null, error: string }}
 */
export function getPostgresConnectionUrl(options = { warnIfDirectDbHost: true }) {
  loadRootDotenv();
  const dbUrl =
    process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    return {
      dbUrl: null,
      error: 'Imposta DATABASE_POOLER_URL (consigliato) o DATABASE_URL in .env — vedi .env.example',
    };
  }
  if (
    options.warnIfDirectDbHost &&
    !process.env.DATABASE_POOLER_URL &&
    /[@.]db\.[^.]+\.supabase\.co/i.test(dbUrl)
  ) {
    console.warn(
      '⚠️  Connessione diretta db.….supabase.co: se fallisce (EHOSTUNREACH), aggiungi DATABASE_POOLER_URL da Supabase → Database → Connection pooling.'
    );
  }
  return { dbUrl };
}

export function hintIfUnreachable(err) {
  const msg = String(err?.message || '');
  if (/EHOSTUNREACH|ENETUNREACH/i.test(msg)) {
    console.error(
      '\n→ Impossibile raggiungere il server DB (spesso IPv6). In .env usa DATABASE_POOLER_URL (host …pooler.supabase.com) da Supabase Dashboard.'
    );
  }
}
