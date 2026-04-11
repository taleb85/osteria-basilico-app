-- Log invii promemoria uscita timbratura (una riga per punch "in" ancora aperto).
CREATE TABLE IF NOT EXISTS public.punch_exit_reminder_log (
  punch_record_id uuid PRIMARY KEY REFERENCES public.punch_records(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punch_exit_reminder_log_user_id
  ON public.punch_exit_reminder_log(user_id);

ALTER TABLE public.punch_exit_reminder_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.punch_exit_reminder_log IS
  'Traccia promemoria push per ingresso timbrato da >10h senza uscita; service_role in scrittura da Edge Function.';

-- Ultimo punch per utente = ''in'' e più vecchio di 10 ore, senza promemoria già inviato per quel record.
CREATE OR REPLACE FUNCTION public.get_stale_open_punch_for_reminder()
RETURNS TABLE (user_id uuid, punch_record_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (pr.user_id)
      pr.user_id AS uid,
      pr.id AS prid,
      pr.type,
      pr.timestamp
    FROM public.punch_records pr
    INNER JOIN public.users u ON u.id = pr.user_id AND u.status = 'active'
    ORDER BY pr.user_id, pr.timestamp DESC
  )
  SELECT latest.uid, latest.prid
  FROM latest
  WHERE latest.type = 'in'
    AND latest.timestamp < (now() AT TIME ZONE 'utc') - interval '10 hours'
    AND NOT EXISTS (
      SELECT 1
      FROM public.punch_exit_reminder_log l
      WHERE l.punch_record_id = latest.prid
    );
$$;

REVOKE ALL ON FUNCTION public.get_stale_open_punch_for_reminder() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stale_open_punch_for_reminder() TO service_role;
