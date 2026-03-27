-- Garantisce che turni, timbrature e ferie legati a profili "Admin" o "Taleb" (senza cognome Barikhan)
-- risultino sull’unico utente canonico Taleb Barikhan.
-- Stessi criteri del merge 20260329120000; idempotente se non ci sono più sorgenti.

DO $repair$
DECLARE
  tid uuid;
  src_ids uuid[];
  n bigint;
BEGIN
  SELECT id INTO tid
  FROM public.users
  WHERE lower(trim(first_name)) = 'taleb'
    AND lower(trim(last_name)) = 'barikhan'
  LIMIT 1;

  IF tid IS NULL THEN
    RAISE NOTICE 'reassign_taleb_shifts: skip — nessun utente Taleb Barikhan';
    RETURN;
  END IF;

  SELECT array_agg(u.id ORDER BY u.created_at NULLS LAST, u.id)
  INTO src_ids
  FROM public.users u
  WHERE u.id <> tid
    AND (
      lower(trim(u.first_name)) = 'admin'
      OR (
        lower(trim(u.first_name)) = 'taleb'
        AND lower(trim(coalesce(u.last_name, ''))) <> 'barikhan'
      )
    );

  IF src_ids IS NULL OR cardinality(src_ids) = 0 THEN
    RAISE NOTICE 'reassign_taleb_shifts: skip — nessun profilo sorgente (turni già sul canonico o merge già applicato)';
    RETURN;
  END IF;

  UPDATE public.shifts SET user_id = tid WHERE user_id = ANY (src_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'reassign_taleb_shifts: shifts aggiornati: %', n;

  UPDATE public.punch_records SET user_id = tid WHERE user_id = ANY (src_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'reassign_taleb_shifts: punch_records aggiornati: %', n;

  UPDATE public.holiday_requests SET user_id = tid WHERE user_id = ANY (src_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'reassign_taleb_shifts: holiday_requests aggiornati: %', n;
END
$repair$;
