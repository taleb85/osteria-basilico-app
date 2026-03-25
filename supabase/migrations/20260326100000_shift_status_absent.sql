-- Stato "absent": turno pianificato ma il dipendente non ha lavorato (no-show). Non eliminabile come congelato; ore effettive = 0.

ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_approval_status_check;

ALTER TABLE shifts ADD CONSTRAINT shifts_approval_status_check
  CHECK (approval_status IN ('draft', 'pending', 'approved', 'confirmed', 'standby', 'absent'));

COMMENT ON COLUMN shifts.approval_status IS 'draft, pending, approved, confirmed, standby, absent (non ha lavorato — 0 ore effettive)';
