-- Add break_minutes (int) and is_auto_break (bool) to shifts for automatic break handling
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS break_minutes integer DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS is_auto_break boolean DEFAULT false;
