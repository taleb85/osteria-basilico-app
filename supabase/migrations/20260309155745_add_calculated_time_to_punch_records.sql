/*
  # Add calculated_time field to punch_records

  1. Changes
    - Add `calculated_time` (timestamptz, nullable) column to `punch_records` table
      This field stores the rounded time used for payroll calculations (5-minute intervals)
    - The original `timestamp` field continues to store the actual punch time
    
  2. Notes
    - Early arrivals: calculated_time = shift start time
    - Late arrivals: calculated_time = rounded up to next 5-minute interval
    - This supports transparent time tracking and payroll accuracy
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'punch_records' AND column_name = 'calculated_time'
  ) THEN
    ALTER TABLE punch_records ADD COLUMN calculated_time timestamptz;
  END IF;
END $$;
