-- Aggiunge la colonna admin_note alla tabella shifts.
-- Usata per tracciare l'origine dei turni (es. import storico CSV).
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS admin_note text;
