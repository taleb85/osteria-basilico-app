-- Make last_name optional for users (cognome non obbligatorio)
-- Run this migration to allow employees without a surname

ALTER TABLE users ALTER COLUMN last_name DROP NOT NULL;
