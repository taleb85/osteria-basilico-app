-- Bundle idempotente: tutte le colonne su `users` usate dall'app (fix PATCH 400).
-- Applicabile da Supabase → SQL Editor oppure: npm run db:ensure-users

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
COMMENT ON COLUMN users.phone IS 'Telefono opzionale (profilo)';

ALTER TABLE users ADD COLUMN IF NOT EXISTS department text;
COMMENT ON COLUMN users.department IS 'Reparto: sala, kitchen, bar';

ALTER TABLE users ADD COLUMN IF NOT EXISTS can_create_shifts boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_approve_shifts boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_total_hours boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_staff_pins boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_drafts boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_request_holidays boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_punch_from_app boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_bypass_pwa_check boolean DEFAULT false;

ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled_modules jsonb DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled_features jsonb DEFAULT '{}'::jsonb;

ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_confirmed jsonb DEFAULT '{}'::jsonb;

ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate_eur numeric(10, 2);
COMMENT ON COLUMN users.hourly_rate_eur IS 'Euro/ora per stima costo (Ore)';

UPDATE users SET can_bypass_pwa_check = true WHERE role = 'admin' AND (can_bypass_pwa_check IS NULL OR can_bypass_pwa_check = false);

COMMENT ON COLUMN users.enabled_modules IS 'Moduli dashboard (jsonb array)';
COMMENT ON COLUMN users.enabled_features IS 'Flag permessi / moduli legacy profilo (jsonb)';

ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_section_overrides jsonb DEFAULT '{}'::jsonb;
COMMENT ON COLUMN users.ui_section_overrides IS 'Override visibilità sezioni schermate (registro UI_SCREEN_WIDGETS)';
