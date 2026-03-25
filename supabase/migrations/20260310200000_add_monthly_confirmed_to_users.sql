/*
  # Aggiunta colonna monthly_confirmed per ore mensili confermate

  Permette di salvare le ore e i turni confermati per ogni mese,
  visibili nelle dashboard personali dei dipendenti.
*/

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS monthly_confirmed jsonb DEFAULT '{}';

COMMENT ON COLUMN users.monthly_confirmed IS 'Ore e turni confermati per mese. Es: {"2025-03":{"minutes":480,"shiftsCount":12}}';
