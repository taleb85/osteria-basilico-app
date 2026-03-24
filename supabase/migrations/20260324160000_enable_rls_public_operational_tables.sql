/*
  Supabase linter: tabelle public esposte a PostgREST devono avere RLS abilitata.
  L'app usa chiave anon + PIN (vedi allow_anon_full_access): policy permissive TO anon.

  Copre: shifts, punch_records, holiday_requests, shift_templates (+ holidays / notifications se presenti).
*/

-- ─── shifts ───────────────────────────────────────────────────────────────
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

-- ─── punch_records ──────────────────────────────────────────────────────────
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

-- ─── holiday_requests ─────────────────────────────────────────────────────
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

-- ─── shift_templates (prima: solo authenticated; l’app usa anon) ──────────
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON public.shift_templates;
DROP POLICY IF EXISTS "Allow authenticated write" ON public.shift_templates;

DROP POLICY IF EXISTS "Anon can insert shift_templates" ON public.shift_templates;
DROP POLICY IF EXISTS "Anon can update shift_templates" ON public.shift_templates;
DROP POLICY IF EXISTS "Anon can delete shift_templates" ON public.shift_templates;
DROP POLICY IF EXISTS "Anon can select shift_templates" ON public.shift_templates;

CREATE POLICY "Anon can insert shift_templates"
  ON public.shift_templates FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon can update shift_templates"
  ON public.shift_templates FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anon can delete shift_templates"
  ON public.shift_templates FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can select shift_templates"
  ON public.shift_templates FOR SELECT TO anon USING (true);

-- ─── holidays (tabella opzionale su alcuni progetti) ─────────────────────────
DO $$
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
END $$;

-- ─── notifications (tabella opzionale) ────────────────────────────────────
DO $$
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
END $$;
