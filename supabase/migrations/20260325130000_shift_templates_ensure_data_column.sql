-- L'app usa la colonna jsonb `data` per le righe del template (PostgREST PGRST204 se manca).
-- Alcuni DB avevano la tabella senza `data`, o la tabella non esiste ancora.

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
