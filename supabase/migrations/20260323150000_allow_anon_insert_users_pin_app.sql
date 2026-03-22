/*
  Creazione dipendenti dall’app (chiave anonima + auth a PIN in app).

  Alcune sequenze di migrazioni lasciano su `users` solo SELECT per `anon` e UPDATE
  (es. sort_order), ma nessun INSERT: in quel caso «Nuovo dipendente» fallisce in silenzio
  o con errore permessi.

  Esegui su Supabase → SQL Editor se il deploy automatico delle migrazioni non è attivo.
*/

DROP POLICY IF EXISTS "anon_can_insert_users_for_pin_app" ON users;

CREATE POLICY "anon_can_insert_users_for_pin_app"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (true);
