-- Add notes column to shifts (optional text for shift badge display)
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS notes text;
