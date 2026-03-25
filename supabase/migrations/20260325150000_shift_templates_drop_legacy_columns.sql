-- Schema atteso dall'app: una riga per template con `name` + `data` (jsonb array di turni).
-- Se la tabella è stata creata con colonne flat (day_of_week, user_id, …) NOT NULL,
-- INSERT/UPSERT con solo { name, data } fallisce con 23502.

ALTER TABLE public.shift_templates
  DROP COLUMN IF EXISTS day_of_week,
  DROP COLUMN IF EXISTS user_id,
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time,
  DROP COLUMN IF EXISTS type;

ALTER TABLE public.shift_templates
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '[]'::jsonb;
