-- Esclusione per regola: quali voci break admin non detrarre su questo turno
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS deduct_excluded_rule_ids jsonb DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.shifts.deduct_excluded_rule_ids IS
  'Array di id delle BreakRule (admin) esclusi dal calcolo su questo turno.';
