-- Date rapporto (anagrafica dipendente)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS employment_start_date date,
  ADD COLUMN IF NOT EXISTS employment_end_date date;

COMMENT ON COLUMN public.users.employment_start_date IS 'Data inizio rapporto (opzionale)';
COMMENT ON COLUMN public.users.employment_end_date IS 'Data fine rapporto / sospensione (opzionale)';
