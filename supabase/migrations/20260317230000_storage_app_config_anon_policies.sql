-- L'app usa login custom (email+PIN su tabella `users`), NON Supabase Auth.
-- Il client invia sempre JWT ruolo `anon` → servono policy per `anon` su `app-config`.
-- (La chiave anon è già nel frontend; allineato al resto del progetto che usa anon su REST.)

DROP POLICY IF EXISTS "app_config_select_anon" ON storage.objects;
DROP POLICY IF EXISTS "app_config_insert_anon" ON storage.objects;
DROP POLICY IF EXISTS "app_config_update_anon" ON storage.objects;
DROP POLICY IF EXISTS "app_config_delete_anon" ON storage.objects;

CREATE POLICY "app_config_select_anon"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'app-config');

CREATE POLICY "app_config_insert_anon"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'app-config');

CREATE POLICY "app_config_update_anon"
  ON storage.objects FOR UPDATE
  TO anon
  USING (bucket_id = 'app-config')
  WITH CHECK (bucket_id = 'app-config');

CREATE POLICY "app_config_delete_anon"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'app-config');
