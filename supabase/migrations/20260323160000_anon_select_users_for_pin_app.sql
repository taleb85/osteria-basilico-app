/*
  Lettura tabella `users` con chiave anonima (login PIN, lista staff, GET dopo INSERT).

  Se su `users` esistono solo policy INSERT/UPDATE per `anon` e nessuna SELECT,
  l’app non può leggere le righe: creazione dipendente fallisce dopo l’insert e
  molte schermate risultano vuote o incoerenti.

  Esegui in Supabase → SQL Editor se `pg_policies` non mostra alcuna riga
  cmd = SELECT, roles = {anon} per tablename = users.
*/

DROP POLICY IF EXISTS "anon_can_select_users_for_pin_app" ON users;

CREATE POLICY "anon_can_select_users_for_pin_app"
  ON users
  FOR SELECT
  TO anon
  USING (true);
