-- Rimuove lo stato 'absent' dal CHECK constraint di approval_status.
-- Prima converte i turni esistenti con status 'absent' in 'draft'
UPDATE shifts SET approval_status = 'draft' WHERE approval_status = 'absent';

ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_approval_status_check;

ALTER TABLE shifts ADD CONSTRAINT shifts_approval_status_check
  CHECK (approval_status IN ('draft', 'pending', 'approved', 'confirmed', 'standby', 'frozen'));

COMMENT ON COLUMN shifts.approval_status IS 'draft, pending, approved, confirmed, standby, frozen (congelato per payroll)';
