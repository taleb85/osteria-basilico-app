/*
  # Add Approval Status to Shifts

  1. Changes
    - Add `approval_status` column to shifts table with default 'pending'
    - Update existing shifts to have 'approved' status (backward compatibility)

  2. Notes
    - New shifts will default to 'pending' and require approval
    - Existing shifts are set to 'approved' to maintain current functionality
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shifts' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE shifts ADD COLUMN approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved'));

    UPDATE shifts SET approval_status = 'approved' WHERE approval_status IS NULL;
  END IF;
END $$;
