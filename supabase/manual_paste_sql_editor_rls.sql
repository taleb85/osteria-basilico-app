-- Paste completo per Supabase SQL Editor (tag $rls$ al posto di $$ per evitare parser strani).
-- Se vedi errore su $$: controlla che non sia rimasta selezionata solo una parte dello script.
-- Allineato a: 20260324160000, 20260324170000, 20260325200000 (+ shift_templates in DO se la tabella esiste).

-- ========== operational tables RLS ==========

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can insert shifts" ON public.shifts;
DROP POLICY IF EXISTS "Anon can update shifts" ON public.shifts;
DROP POLICY IF EXISTS "Anon can delete shifts" ON public.shifts;
DROP POLICY IF EXISTS "Anon can select shifts" ON public.shifts;

CREATE POLICY "Anon can insert shifts"
  ON public.shifts FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update shifts"
  ON public.shifts FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon can delete shifts"
  ON public.shifts FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can select shifts"
  ON public.shifts FOR SELECT TO anon USING (true);

ALTER TABLE public.punch_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can insert punch records" ON public.punch_records;
DROP POLICY IF EXISTS "Anon can update punch records" ON public.punch_records;
DROP POLICY IF EXISTS "Anon can delete punch records" ON public.punch_records;
DROP POLICY IF EXISTS "Anon can select punch records" ON public.punch_records;

CREATE POLICY "Anon can insert punch records"
  ON public.punch_records FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update punch records"
  ON public.punch_records FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon can delete punch records"
  ON public.punch_records FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can select punch records"
  ON public.punch_records FOR SELECT TO anon USING (true);

ALTER TABLE public.holiday_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can insert holiday requests" ON public.holiday_requests;
DROP POLICY IF EXISTS "Anon can update holiday requests" ON public.holiday_requests;
DROP POLICY IF EXISTS "Anon can delete holiday requests" ON public.holiday_requests;
DROP POLICY IF EXISTS "Anon can select holiday requests" ON public.holiday_requests;

CREATE POLICY "Anon can insert holiday requests"
  ON public.holiday_requests FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update holiday requests"
  ON public.holiday_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon can delete holiday requests"
  ON public.holiday_requests FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can select holiday requests"
  ON public.holiday_requests FOR SELECT TO anon USING (true);

DO $rls$
BEGIN
  IF to_regclass('public.shift_templates') IS NOT NULL THEN
    ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Allow authenticated read" ON public.shift_templates;
    DROP POLICY IF EXISTS "Allow authenticated write" ON public.shift_templates;
    DROP POLICY IF EXISTS "Anon can insert shift_templates" ON public.shift_templates;
    DROP POLICY IF EXISTS "Anon can update shift_templates" ON public.shift_templates;
    DROP POLICY IF EXISTS "Anon can delete shift_templates" ON public.shift_templates;
    DROP POLICY IF EXISTS "Anon can select shift_templates" ON public.shift_templates;
    DROP POLICY IF EXISTS "Authenticated can insert shift_templates" ON public.shift_templates;
    DROP POLICY IF EXISTS "Authenticated can update shift_templates" ON public.shift_templates;
    DROP POLICY IF EXISTS "Authenticated can delete shift_templates" ON public.shift_templates;
    DROP POLICY IF EXISTS "Authenticated can select shift_templates" ON public.shift_templates;
    CREATE POLICY "Anon can insert shift_templates"
      ON public.shift_templates FOR INSERT TO anon WITH CHECK (true);
    CREATE POLICY "Anon can update shift_templates"
      ON public.shift_templates FOR UPDATE TO anon USING (true) WITH CHECK (true);
    CREATE POLICY "Anon can delete shift_templates"
      ON public.shift_templates FOR DELETE TO anon USING (true);
    CREATE POLICY "Anon can select shift_templates"
      ON public.shift_templates FOR SELECT TO anon USING (true);
    CREATE POLICY "Authenticated can insert shift_templates"
      ON public.shift_templates FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "Authenticated can update shift_templates"
      ON public.shift_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY "Authenticated can delete shift_templates"
      ON public.shift_templates FOR DELETE TO authenticated USING (true);
    CREATE POLICY "Authenticated can select shift_templates"
      ON public.shift_templates FOR SELECT TO authenticated USING (true);
  END IF;
END $rls$;

DO $rls$
BEGIN
  IF to_regclass('public.holidays') IS NOT NULL THEN
    ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anon can insert holidays" ON public.holidays;
    DROP POLICY IF EXISTS "Anon can update holidays" ON public.holidays;
    DROP POLICY IF EXISTS "Anon can delete holidays" ON public.holidays;
    DROP POLICY IF EXISTS "Anon can select holidays" ON public.holidays;
    CREATE POLICY "Anon can insert holidays"
      ON public.holidays FOR INSERT TO anon WITH CHECK (true);
    CREATE POLICY "Anon can update holidays"
      ON public.holidays FOR UPDATE TO anon USING (true) WITH CHECK (true);
    CREATE POLICY "Anon can delete holidays"
      ON public.holidays FOR DELETE TO anon USING (true);
    CREATE POLICY "Anon can select holidays"
      ON public.holidays FOR SELECT TO anon USING (true);
  END IF;
END $rls$;

DO $rls$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Anon can insert notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Anon can update notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Anon can delete notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Anon can select notifications" ON public.notifications;
    CREATE POLICY "Anon can insert notifications"
      ON public.notifications FOR INSERT TO anon WITH CHECK (true);
    CREATE POLICY "Anon can update notifications"
      ON public.notifications FOR UPDATE TO anon USING (true) WITH CHECK (true);
    CREATE POLICY "Anon can delete notifications"
      ON public.notifications FOR DELETE TO anon USING (true);
    CREATE POLICY "Anon can select notifications"
      ON public.notifications FOR SELECT TO anon USING (true);
  END IF;
END $rls$;

-- ========== audit + sync signal ==========

DO $rls$
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
END $rls$;

DO $rls$
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
END $rls$;

-- ========== Realtime publication (stesso contenuto di 20260325200000_*.sql) ==========

DO $rt$
DECLARE
  t text;
  tables text[] := ARRAY[
    'users',
    'shifts',
    'punch_records',
    'holiday_requests',
    'app_settings_sync_signal'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'Publication supabase_realtime non trovata; skip.';
    RETURN;
  END IF;

  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
  END LOOP;
END $rt$;
