/*
  Aggiunge accesso SELECT/INSERT/UPDATE/DELETE per la chiave anonima su shift_templates.
  
  Le policy precedenti erano solo per `authenticated`, ma l'app usa chiave anonima
  per tutte le operazioni → le query fallivano con 400/403.
*/

DROP POLICY IF EXISTS "anon_select_shift_templates" ON public.shift_templates;
DROP POLICY IF EXISTS "anon_insert_shift_templates" ON public.shift_templates;
DROP POLICY IF EXISTS "anon_update_shift_templates" ON public.shift_templates;
DROP POLICY IF EXISTS "anon_delete_shift_templates" ON public.shift_templates;

CREATE POLICY "anon_select_shift_templates"
  ON public.shift_templates FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_shift_templates"
  ON public.shift_templates FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_shift_templates"
  ON public.shift_templates FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_delete_shift_templates"
  ON public.shift_templates FOR DELETE TO anon USING (true);
