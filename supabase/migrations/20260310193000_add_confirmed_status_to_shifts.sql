/*
  # Add Confirmed Status to Shifts

  1. Changes
    - Update approval_status check constraint to include 'confirmed' status
    - Confirmed: shift approved and employee has punched in from Kiosk
    - Used for green cell styling in Admin Panel (semaforo turni)
*/

ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_approval_status_check;

ALTER TABLE shifts ADD CONSTRAINT shifts_approval_status_check 
  CHECK (approval_status IN ('draft', 'pending', 'approved', 'confirmed'));
