-- Sblocca l'UPDATE su users per la chiave anon (app con login PIN).
-- Esegui questo script nel SQL Editor di Supabase (Dashboard -> SQL Editor -> New query).

DROP POLICY IF EXISTS "anon_can_update_users_for_pin_app" ON users;

CREATE POLICY "anon_can_update_users_for_pin_app"
  ON users FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
