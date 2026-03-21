/*
  # Add shift_id to punch_records for precise shift matching

  When a user has multiple shifts per day (e.g. lunch + dinner), we need shift_id
  to correctly associate each punch with the specific shift.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'punch_records' AND column_name = 'shift_id'
  ) THEN
    ALTER TABLE punch_records ADD COLUMN shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_punch_records_shift_id ON punch_records(shift_id);
  END IF;
END $$;
