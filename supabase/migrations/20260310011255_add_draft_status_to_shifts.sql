/*
  # Add Draft Status to Shifts

  1. Changes
    - Update approval_status check constraint to include 'draft' status
    - Draft shifts are invisible to staff until published to 'pending'
    - Management can publish entire weeks of draft shifts
  
  2. Notes
    - Draft: shift created but not visible to staff
    - Pending: shift published and visible, awaiting approval
    - Approved: shift completed and hours calculated
*/

-- Drop existing constraint
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_approval_status_check;

-- Add new constraint with draft status
ALTER TABLE shifts ADD CONSTRAINT shifts_approval_status_check 
  CHECK (approval_status IN ('draft', 'pending', 'approved'));