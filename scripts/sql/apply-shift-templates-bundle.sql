-- Bundle idempotente: schema shift_templates allineato all'app (template settimana).
-- Ordine: tabella + data → rimuovi colonne legacy → unicità name → RLS authenticated.

-- 1) Tabella e colonna data (PGRST204)
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  data        jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.shift_templates
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.shift_templates.data IS 'Array JSON: day_of_week, user_id, start_time, end_time, type';

-- 2) Colonne flat legacy (23502 se NOT NULL senza valore in INSERT)
ALTER TABLE public.shift_templates
  DROP COLUMN IF EXISTS day_of_week,
  DROP COLUMN IF EXISTS user_id,
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time,
  DROP COLUMN IF EXISTS type;

ALTER TABLE public.shift_templates
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3) Unicità name per upsert ON CONFLICT (42P10)
DELETE FROM public.shift_templates a
WHERE EXISTS (
  SELECT 1 FROM public.shift_templates b
  WHERE b.name = a.name AND b.ctid < a.ctid
);

CREATE UNIQUE INDEX IF NOT EXISTS shift_templates_name_unique ON public.shift_templates (name);

-- 4) RLS: ruolo authenticated (sessioni login Supabase)
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
