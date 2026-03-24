/*
  Realtime (Supabase): le tabelle devono stare nella publication `supabase_realtime`
  perché `src/lib/database.ts` si iscriva a postgres_changes.

  Idempotente: aggiunge solo le tabelle mancanti. Salta se la tabella non esiste.
  Copre: users, shifts, punch_records, holiday_requests, app_settings_sync_signal
  (quest’ultima può essere già stata aggiunta da 20260322180000 / 20260324130000).
*/

DO $rt$
DECLARE
  t text;
  tables text[] := ARRAY[
    'users',
    'shifts',
    'punch_records',
    'holiday_requests',
    'app_settings_sync_signal'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'Publication supabase_realtime non trovata; skip (host non Supabase?).';
    RETURN;
  END IF;

  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
  END LOOP;
END $rt$;
