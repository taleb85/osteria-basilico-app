-- Orari congelati all'approvazione definitiva (separati da start_time/end_time pianificati sul turno)
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS approved_start_time text,
  ADD COLUMN IF NOT EXISTS approved_end_time text;

COMMENT ON COLUMN public.shifts.approved_start_time IS 'HH:mm congelato alla approvazione definitiva (con approved_at)';
COMMENT ON COLUMN public.shifts.approved_end_time IS 'HH:mm congelato alla approvazione definitiva (con approved_at)';
