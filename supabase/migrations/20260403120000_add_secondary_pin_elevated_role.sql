-- Migration: aggiunge secondary_pin ed elevated_role alla tabella users
-- Usati dal pannello "Accesso elevato (PIN secondario)" nelle impostazioni admin.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS secondary_pin  text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS elevated_role  text    DEFAULT NULL;

-- Indice per lookup veloce sul PIN secondario (usato al login)
CREATE INDEX IF NOT EXISTS users_secondary_pin_idx
  ON public.users (secondary_pin)
  WHERE secondary_pin IS NOT NULL;

COMMENT ON COLUMN public.users.secondary_pin IS
  'PIN alternativo (4 cifre) che eleva temporaneamente il ruolo per la sessione corrente.';
COMMENT ON COLUMN public.users.elevated_role IS
  'Ruolo concesso quando si usa secondary_pin (session-only, non sovrascrive il ruolo reale).';
