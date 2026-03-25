-- Idempotente: assicura che approval_status possa essere 'absent' (se la migration 20260326100000 non era stata applicata).
-- Esegui con: supabase db push  oppure incolla in SQL Editor su Supabase.

ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_approval_status_check;

ALTER TABLE shifts ADD CONSTRAINT shifts_approval_status_check
  CHECK (approval_status IN ('draft', 'pending', 'approved', 'confirmed', 'standby', 'absent'));

COMMENT ON COLUMN shifts.approval_status IS 'draft, pending, approved, confirmed, standby, absent (non ha lavorato — 0 ore effettive)';
