/**
 * Migrazione staff_messages per Centro Messaggi.
 * Crea la tabella staff_messages e forza il refresh dello schema cache di PostgREST.
 * Uso: node scripts/run-migration-staff-messages.js
 */

import { getPostgresClientConfig, hintIfUnreachable } from './pg-env.js';

const sql = `
-- 1. Crea la tabella staff_messages se non esiste
CREATE TABLE IF NOT EXISTS staff_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL = broadcast
  message_type TEXT NOT NULL CHECK (message_type IN ('broadcast', 'private')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Aggiungi la colonna body se manca (per sicurezza se la tabella esisteva già senza)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_messages' AND column_name='body') THEN
    ALTER TABLE staff_messages ADD COLUMN body TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- 3. Indici per performance
CREATE INDEX IF NOT EXISTS idx_staff_messages_recipient ON staff_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_staff_messages_sender ON staff_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_staff_messages_created ON staff_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_messages_is_read ON staff_messages(is_read);

-- 4. Abilita RLS
ALTER TABLE staff_messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (Drop se esistono per evitare errori su re-run)
DROP POLICY IF EXISTS messages_view ON staff_messages;
DROP POLICY IF EXISTS messages_insert ON staff_messages;
DROP POLICY IF EXISTS messages_update ON staff_messages;

-- Utenti vedono solo messaggi loro (broadcast) o privati
CREATE POLICY messages_view ON staff_messages FOR SELECT
  USING (recipient_id IS NULL OR recipient_id = auth.uid()::uuid OR sender_id = auth.uid()::uuid);

-- Utenti possono inserire solo come sender
CREATE POLICY messages_insert ON staff_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid()::uuid);

-- Utenti possono marcare come letto solo loro messaggi
CREATE POLICY messages_update ON staff_messages FOR UPDATE
  USING (recipient_id = auth.uid()::uuid OR sender_id = auth.uid()::uuid);

-- 6. Forza il refresh della cache di PostgREST
NOTIFY pgrst, 'reload schema';
`;

async function main() {
  const res = await getPostgresClientConfig();
  if (res.error) {
    console.error('❌', res.error);
    process.exit(1);
  }
  try {
    const pg = (await import('pg')).default;
    const client = new pg.Client(res.clientConfig);
    await client.connect();
    console.log('⏳ Esecuzione migrazione staff_messages...');
    await client.query(sql);
    console.log('✓ Tabella staff_messages creata/aggiornata');
    console.log('✓ Policies RLS configurate');
    console.log('✓ Cache PostgREST ricaricata');
    await client.end();
    console.log('\n✅ Migrazione Centro Messaggi completata con successo.');
  } catch (err) {
    console.error('❌ Errore durante la migrazione:', err.message);
    hintIfUnreachable(err);
    process.exit(1);
  }
}

main();
