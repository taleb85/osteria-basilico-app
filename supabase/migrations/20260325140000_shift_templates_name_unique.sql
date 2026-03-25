-- Upsert Supabase usa ON CONFLICT (name): serve vincolo UNIQUE su name (PostgreSQL 42P10 se manca).

DELETE FROM public.shift_templates a
WHERE EXISTS (
  SELECT 1 FROM public.shift_templates b
  WHERE b.name = a.name AND b.ctid < a.ctid
);

CREATE UNIQUE INDEX IF NOT EXISTS shift_templates_name_unique ON public.shift_templates (name);
