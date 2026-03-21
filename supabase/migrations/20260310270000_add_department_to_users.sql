-- Add department to users (Cucina, Sala, Bar)
ALTER TABLE users ADD COLUMN IF NOT EXISTS department text;
COMMENT ON COLUMN users.department IS 'Reparto: Cucina, Sala, Bar';
