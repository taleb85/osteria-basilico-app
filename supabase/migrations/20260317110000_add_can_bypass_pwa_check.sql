-- Aggiunge colonna can_bypass_pwa_check per permettere accesso da browser senza installazione PWA
-- Solo Admin ha TRUE di default; tutti gli altri FALSE

ALTER TABLE users ADD COLUMN IF NOT EXISTS can_bypass_pwa_check boolean DEFAULT false;

-- Imposta TRUE solo per Admin
UPDATE users SET can_bypass_pwa_check = true WHERE role = 'admin';

COMMENT ON COLUMN users.can_bypass_pwa_check IS 'Permette accesso da browser senza installazione app PWA (solo Admin di default)';
