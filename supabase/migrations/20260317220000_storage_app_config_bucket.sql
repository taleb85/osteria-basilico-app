-- Bucket Storage `app-config` + policy per utenti autenticati (fix POST 400 su upload JSON).
-- Esegui in Supabase → SQL Editor se non usi CLI migrate.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('app-config', 'app-config', false, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Rimuovi eventuali policy omonime da riesecuzione idempotente
DROP POLICY IF EXISTS "app_config_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "app_config_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "app_config_update_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "app_config_delete_authenticated" ON storage.objects;

CREATE POLICY "app_config_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'app-config');

CREATE POLICY "app_config_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'app-config');

CREATE POLICY "app_config_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'app-config')
  WITH CHECK (bucket_id = 'app-config');

CREATE POLICY "app_config_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'app-config');
