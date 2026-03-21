-- Aggiunge colonne permessi per richiesta ferie e timbratura da app
-- Inoltre garantisce che tutte le colonne permessi esistano (in caso la migrazione 20260310191918 non sia stata eseguita)

-- Colonne da 20260310191918 (se mancanti)
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_create_shifts boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_approve_shifts boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_total_hours boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_staff_pins boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_drafts boolean DEFAULT false;

-- Nuove colonne
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_request_holidays boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_punch_from_app boolean DEFAULT true;

COMMENT ON COLUMN users.can_request_holidays IS 'Può inviare richieste di ferie dalla dashboard personale';
COMMENT ON COLUMN users.can_punch_from_app IS 'Può timbrare entrata/uscita dalla app (non solo dal Kiosk)';

