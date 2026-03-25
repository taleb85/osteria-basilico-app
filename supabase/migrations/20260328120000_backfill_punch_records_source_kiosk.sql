/*
  Backfill: timbrature create prima della colonna `source` restano NULL in UI come «Non indicato».
  Qui si assume che fossero tutte da kiosk/terminale; correggi manualmente se alcune erano inserite da Presenze.
*/
UPDATE punch_records
SET source = 'kiosk'
WHERE source IS NULL;
