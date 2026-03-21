-- Matrice permessi finale: enabled_features JSONB
-- Struttura: { "team_view": bool, "edit_shifts": bool, "approve_shifts": bool, "export_pdf": bool, "view_stats": bool, "desktop_access": bool }
-- Tabella users (Osteria Basilico usa users per i dipendenti)

-- Aggiorna commento su users.enabled_features
COMMENT ON COLUMN users.enabled_features IS 'Permessi: team_view, edit_shifts, approve_shifts, export_pdf, view_stats, desktop_access. Admin ha tutti TRUE.';

-- Se esiste la tabella profiles (Supabase Auth), aggiungi enabled_features
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS enabled_features jsonb DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN profiles.enabled_features IS 'Permessi: team_view, edit_shifts, approve_shifts, export_pdf, view_stats, desktop_access';
  END IF;
END $$;
