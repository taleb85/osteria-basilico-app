-- shift_templates: utenti con Supabase Auth hanno ruolo JWT "authenticated", non "anon".
-- La migrazione 20260324160000 ha lasciato solo policy TO anon → INSERT/UPDATE negati per sessioni loggate.

ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can insert shift_templates" ON public.shift_templates;
DROP POLICY IF EXISTS "Authenticated can update shift_templates" ON public.shift_templates;
DROP POLICY IF EXISTS "Authenticated can delete shift_templates" ON public.shift_templates;
DROP POLICY IF EXISTS "Authenticated can select shift_templates" ON public.shift_templates;

CREATE POLICY "Authenticated can insert shift_templates"
  ON public.shift_templates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update shift_templates"
  ON public.shift_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete shift_templates"
  ON public.shift_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can select shift_templates"
  ON public.shift_templates FOR SELECT TO authenticated USING (true);
