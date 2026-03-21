-- Add deduct_break to shifts: se false, non si detrae la mezz'ora di pausa dal calcolo ore
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS deduct_break boolean DEFAULT true;
