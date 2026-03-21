-- Sezioni UI nascoste per profilo (registro app: UI_SCREEN_WIDGETS)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ui_section_overrides jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.users.ui_section_overrides IS 'Override visibilità sezioni schermate: { "home_mgmt.stats_bar": false, ... }';
