/*
  Riduce avvisi Supabase Security Advisor:
  - "Multiple permissive policies": policy duplicate su punch_audit_log o sovrapposizioni ruoli.
  - app_settings_sync_signal: policy senza TO si applicano a tutti i ruoli; qui si usa esplicitamente TO anon.

  Nota: "RLS Policy Always True" (USING true) resta finché l’app usa solo la chiave anon + PIN in app:
  è un avviso informativo, non un errore.
*/

-- punch_audit_log: una sola policy anon (rimuove eventuali duplicati creati a mano in Dashboard)
DO $$
DECLARE
  pol text;
BEGIN
  IF to_regclass('public.punch_audit_log') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.punch_audit_log ENABLE ROW LEVEL SECURITY;
  FOR pol IN
    SELECT p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = 'punch_audit_log'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.punch_audit_log', pol);
  END LOOP;
  CREATE POLICY "anon_all_punch_audit_log"
    ON public.punch_audit_log
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
END $$;

-- app_settings_sync_signal: SELECT/INSERT/UPDATE solo per anon (niente DELETE in policy = delete negato)
DO $$
BEGIN
  IF to_regclass('public.app_settings_sync_signal') IS NULL THEN
    RETURN;
  END IF;
  ALTER TABLE public.app_settings_sync_signal ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "app_settings_sync_signal_select_all" ON public.app_settings_sync_signal;
  DROP POLICY IF EXISTS "app_settings_sync_signal_insert_all" ON public.app_settings_sync_signal;
  DROP POLICY IF EXISTS "app_settings_sync_signal_update_all" ON public.app_settings_sync_signal;
  DROP POLICY IF EXISTS "app_settings_sync_signal_anon_select" ON public.app_settings_sync_signal;
  DROP POLICY IF EXISTS "app_settings_sync_signal_anon_insert" ON public.app_settings_sync_signal;
  DROP POLICY IF EXISTS "app_settings_sync_signal_anon_update" ON public.app_settings_sync_signal;

  CREATE POLICY "app_settings_sync_signal_anon_select"
    ON public.app_settings_sync_signal FOR SELECT TO anon USING (true);
  CREATE POLICY "app_settings_sync_signal_anon_insert"
    ON public.app_settings_sync_signal FOR INSERT TO anon WITH CHECK (true);
  CREATE POLICY "app_settings_sync_signal_anon_update"
    ON public.app_settings_sync_signal FOR UPDATE TO anon USING (true);
END $$;
