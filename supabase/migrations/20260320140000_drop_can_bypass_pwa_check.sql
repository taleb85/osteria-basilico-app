-- Rimuove bypass PWA per utente: regola unica in PwaGate (standalone / dev / env / non loggato).
ALTER TABLE users DROP COLUMN IF EXISTS can_bypass_pwa_check;
