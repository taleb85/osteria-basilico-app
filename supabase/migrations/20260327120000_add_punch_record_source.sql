-- Origine registrazione timbratura: kiosk (terminale), manual (Presenze), manager (responsabile per altro utente).
ALTER TABLE punch_records
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN punch_records.source IS 'kiosk | manual | manager — how the punch was recorded';
