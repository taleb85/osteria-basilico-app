-- Rende il bucket app-config pubblico: i loghi tenant devono essere
-- accessibili senza autenticazione (login page, PWA install screen, manifest icons).
-- Eseguito via Supabase Storage API (updateBucket public: true).

-- Policy di fallback per SELECT anon su tutto il bucket (già pubblico, ma esplicita)
DROP POLICY IF EXISTS "app_config_logos_public_select" ON storage.objects;

CREATE POLICY "app_config_logos_public_select"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'app-config');
