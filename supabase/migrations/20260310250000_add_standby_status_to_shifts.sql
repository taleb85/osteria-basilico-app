-- Add 'standby' (reperibilità) to approval_status for shifts
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_approval_status_check;
ALTER TABLE shifts ADD CONSTRAINT shifts_approval_status_check
  CHECK (approval_status IN ('draft', 'pending', 'approved', 'confirmed', 'standby'));
COMMENT ON COLUMN shifts.approval_status IS 'draft=bozza, pending=in attesa, approved=approvato, confirmed=confermato, standby=reperibilità (?)';
