-- Aggiunge lo stato 'frozen' al CHECK constraint di approval_status.
-- Un turno congelato è bloccato per la gestione stipendi/payroll.
-- Idempotente: esegue DROP/ADD.

ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_approval_status_check;

ALTER TABLE shifts ADD CONSTRAINT shifts_approval_status_check
  CHECK (approval_status IN ('draft', 'pending', 'approved', 'confirmed', 'standby', 'absent', 'frozen'));

COMMENT ON COLUMN shifts.approval_status IS 'draft, pending, approved, confirmed, standby, absent (non ha lavorato — 0 ore effettive), frozen (congelato per payroll)';
