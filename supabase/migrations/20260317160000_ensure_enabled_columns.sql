-- Assicura che enabled_modules e enabled_features esistano (fix 400 Bad Request)
-- Esegui in Supabase SQL Editor se le colonne mancano

ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled_modules jsonb DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled_features jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.enabled_modules IS 'Moduli visibili: my_shifts, team_schedule, stats_hours, etc.';
COMMENT ON COLUMN users.enabled_features IS 'Funzionalità: team_view, edit_shifts, visibility_management, etc.';
