-- Segnale Realtime per propagare subito il pull del bundle impostazioni (config/settings_bundle.json) a tutti i client.
-- La riga id=1 viene aggiornata da bumpAppSettingsSyncSignal() dopo push del bundle.

CREATE TABLE IF NOT EXISTS public.app_settings_sync_signal (
  id smallint PRIMARY KEY DEFAULT 1,
  CONSTRAINT app_settings_sync_signal_single_row CHECK (id = 1),
  revision bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings_sync_signal (id, revision) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings_sync_signal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_sync_signal_select_all" ON public.app_settings_sync_signal;
DROP POLICY IF EXISTS "app_settings_sync_signal_insert_all" ON public.app_settings_sync_signal;
DROP POLICY IF EXISTS "app_settings_sync_signal_update_all" ON public.app_settings_sync_signal;

CREATE POLICY "app_settings_sync_signal_select_all"
  ON public.app_settings_sync_signal FOR SELECT
  USING (true);

CREATE POLICY "app_settings_sync_signal_insert_all"
  ON public.app_settings_sync_signal FOR INSERT
  WITH CHECK (true);

CREATE POLICY "app_settings_sync_signal_update_all"
  ON public.app_settings_sync_signal FOR UPDATE
  USING (true);

-- Realtime: idempotente se la tabella è già nella publication (replay / db push dopo SQL manuale).
DO $sync$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_settings_sync_signal'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings_sync_signal;
  END IF;
END $sync$;
