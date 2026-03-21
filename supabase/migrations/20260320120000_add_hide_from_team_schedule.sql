-- Profilo attivo ma nascosto dal tabellone turni / riepiloghi collettivi (es. proprietario in back-office)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS hide_from_team_schedule boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.hide_from_team_schedule IS 'Se true, utente attivo ma non mostrato in tabellone turni, presenze collettive e statistiche team';
