-- Aggiunge clock_out_time a punch_records (usata per registrare l'uscita manuale dei turni sera)
ALTER TABLE punch_records
  ADD COLUMN IF NOT EXISTS clock_out_time TIMESTAMPTZ;

-- Aggiunge approved_at e approved_by a shifts (usate per congelare i turni approvati)
ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Crea punch_audit_log se non esiste (tracciabilità modifiche manuali)
CREATE TABLE IF NOT EXISTS punch_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_record_id UUID REFERENCES punch_records(id) ON DELETE CASCADE,
  actor_id      UUID,
  actor_name    TEXT,
  field         TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  changed_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS: stessa policy permissiva delle altre tabelle
ALTER TABLE punch_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_punch_audit_log" ON punch_audit_log;
CREATE POLICY "anon_all_punch_audit_log"
  ON punch_audit_log FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
