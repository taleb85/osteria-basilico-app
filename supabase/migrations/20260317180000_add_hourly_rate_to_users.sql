-- Tariffa oraria lorda (€/h) per stima costo in Statistiche
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hourly_rate_eur numeric(10, 2);

COMMENT ON COLUMN public.users.hourly_rate_eur IS 'Euro/ora per stima costo turni approvati (Statistiche). NULL = non impostato.';
