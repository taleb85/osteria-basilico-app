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

/**
 * Config per `pg.Client`: su host diretto db.*.supabase.co risolve IPv4 e imposta TLS SNI (`servername`),
 * così si evita EHOSTUNREACH quando solo IPv6 è risolto e non è raggiungibile.
 * Se è già DATABASE_POOLER_URL, usa la stringa così com’è.
 * @returns {Promise<{ clientConfig: object } | { error: string }>}
 */
export async function getPostgresClientConfig() {
  loadRootDotenv();
  const pooler = process.env.DATABASE_POOLER_URL;
  const dbUrl = pooler || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    return { error: 'Imposta DATABASE_POOLER_URL (consigliato) o DATABASE_URL in .env — vedi .env.example' };
  }

  if (pooler) {
    return {
      clientConfig: {
        connectionString: pooler,
        ssl: supabaseLocalPgSsl,
      },
    };
  }

  let u;
  try {
    u = new URL(dbUrl.replace(/^postgres:\/\//i, 'postgresql://'));
  } catch {
    return { error: 'DATABASE_URL non è un URL valido' };
  }

  const hostname = u.hostname;
  const isSupabaseDirect = /(^|\.)db\.[^.]+\.supabase\.co$/i.test(hostname);

  if (!isSupabaseDirect) {
    return {
      clientConfig: {
        connectionString: dbUrl,
        ssl: supabaseLocalPgSsl,
      },
    };
  }

  console.warn(
    '⚠️  Connessione diretta db.….supabase.co: risoluzione IPv4 + SNI; se fallisce, aggiungi DATABASE_POOLER_URL (pooler) in .env.'
  );

  try {
    const dns = await import('node:dns/promises');
    const { address } = await dns.lookup(hostname, { family: 4 });
    const user = decodeURIComponent(u.username || 'postgres');
    const password = u.password ? decodeURIComponent(u.password) : '';
    const port = u.port ? parseInt(u.port, 10) : 5432;
    const database = (u.pathname || '/postgres').replace(/^\//, '') || 'postgres';

    return {
      clientConfig: {
        host: address,
        port,
        user,
        password,
        database,
        ssl: {
          ...supabaseLocalPgSsl,
          servername: hostname,
        },
      },
    };
  } catch (lookupErr) {
    console.warn('⚠️  Risoluzione IPv4 fallita, uso URL originale:', (lookupErr && lookupErr.message) || lookupErr);
    return {
      clientConfig: {
        connectionString: dbUrl,
        ssl: supabaseLocalPgSsl,
      },
    };
  }
}
