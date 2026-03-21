-- Add enabled_modules (JSONB array) to users for per-profile module visibility
ALTER TABLE users ADD COLUMN IF NOT EXISTS enabled_modules jsonb DEFAULT '[]'::jsonb;
