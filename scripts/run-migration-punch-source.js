/**
 * Aggiunge punch_records.source (kiosk | manual | manager).
 * Uso: npm run db:migrate-punch-source
 *
 * Usa DATABASE_POOLER_URL, oppure prova pooler multi-regione da DATABASE_URL,
 * oppure URL diretto (vedi scripts/supabasePgCandidates.js).
 */

import { lookup } from 'node:dns/promises';
import {
  collectSupabasePgCandidates,
  connectionStringForNodePg,
  sslOption,
  maskConnectionString,
} from './supabasePgCandidates.js';
import { hintIfUnreachable } from './pg-env.js';

const statements = [
  `ALTER TABLE punch_records ADD COLUMN IF NOT EXISTS source text`,
  `COMMENT ON COLUMN punch_records.source IS 'kiosk | manual | manager — how the punch was recorded'`,
];

/** @param {string} dbUrl */
async function createConnectedClient(dbUrl) {
  const pg = (await import('pg')).default;
  const connect = async (connStr) => {
    const c = new pg.Client({
      connectionString: connStr,
      ssl: sslOption(),
      connectionTimeoutMillis: 15000,
    });
    await c.connect();
    return c;
  };
  const conn =
    process.env.PG_REJECT_UNAUTHORIZED === '1' ? dbUrl : connectionStringForNodePg(dbUrl);
  try {
    return await connect(conn);
  } catch (e) {
    const msg = String(e?.message || '');
    if (!/EHOSTUNREACH|ENETUNREACH/i.test(msg)) throw e;
  }
  let parsed;
  try {
    parsed = new URL(dbUrl.replace(/^postgresql:/i, 'postgres:'));
  } catch {
    throw new Error('URL database non valido per fallback IPv4');
  }
  const { address } = await lookup(parsed.hostname, { family: 4 });
  parsed.hostname = address;
  const ipv4Url = parsed.toString().replace(/^postgres:/i, 'postgresql:');
  const conn2 = process.env.PG_REJECT_UNAUTHORIZED === '1' ? ipv4Url : connectionStringForNodePg(ipv4Url);
  console.log('↻ Connessione diretta fallita (IPv6): ritento via IPv4…');
  return connect(conn2);
}

async function main() {
  const candidates = collectSupabasePgCandidates();
  if (candidates.length === 0) {
    console.error('❌ Nessuna connection string: imposta DATABASE_URL o DATABASE_POOLER_URL in .env');
    process.exit(1);
  }

  const pg = (await import('pg')).default;
  let lastErr = null;

  for (let i = 0; i < candidates.length; i++) {
    const raw = candidates[i];
    const connectionString =
      process.env.PG_REJECT_UNAUTHORIZED === '1' ? raw : connectionStringForNodePg(raw);
    const client = new pg.Client({
      connectionString,
      ssl: sslOption(),
      connectionTimeoutMillis: 15000,
    });
    try {
      await client.connect();
      for (const sql of statements) {
        await client.query(sql);
        console.log('✓', sql.slice(0, 85));
      }
      await client.end();
      console.log('\n✅ Migrazione punch_records.source completata.');
      console.log(`   Connessione (${i + 1}/${candidates.length}): ${maskConnectionString(raw)}`);
      return;
    } catch (err) {
      lastErr = err;
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      const msg = String(err?.message || '');
      if (candidates.length > 1) {
        console.warn(`⚠️  Tentativo ${i + 1} fallito: ${msg.split('\n')[0]}`);
      }
      // Fallback IPv4 solo sull’URL diretto db.* (ultimo tentativo tipico)
      if (/EHOSTUNREACH|ENETUNREACH/i.test(msg) && /db\.[^.]+\.supabase\.co/i.test(raw)) {
        try {
          const c2 = await createConnectedClient(raw);
          for (const sql of statements) {
            await c2.query(sql);
            console.log('✓', sql.slice(0, 85));
          }
          await c2.end();
          console.log('\n✅ Migrazione punch_records.source completata (IPv4).');
          return;
        } catch (e2) {
          lastErr = e2;
          console.warn(`⚠️  Fallback IPv4 fallito: ${String(e2?.message || e2).split('\n')[0]}`);
        }
      }
    }
  }

  console.error('❌ Tutti i tentativi di connessione sono falliti.');
  if (lastErr) console.error('   Ultimo errore:', lastErr.message);
  hintIfUnreachable(lastErr);
  if (/ENOTFOUND/i.test(String(lastErr?.message || ''))) {
    console.error(
      '\n→ ENOTFOUND: verifica DATABASE_URL o incolla DATABASE_POOLER_URL da Supabase → Database → Connection pooling.'
    );
  }
  process.exit(1);
}

main();
