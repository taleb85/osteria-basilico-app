-- Aggiunge la colonna avatar_url alla tabella users per salvare URL foto profilo
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
