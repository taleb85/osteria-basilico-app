-- Add enabled_features (JSONB) to users for dynamic permission flags
ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled_features jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.enabled_features IS 'Funzionalità abilitate: view_team_schedule, edit_shifts_draft, edit_shifts_approval, view_stats_hours, export_pdf, bypass_pwa';
