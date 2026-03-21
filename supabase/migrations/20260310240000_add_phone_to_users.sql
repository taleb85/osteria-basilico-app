-- Add optional phone column to users table for profile settings
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
COMMENT ON COLUMN users.phone IS 'Numero di telefono personale (opzionale)';
