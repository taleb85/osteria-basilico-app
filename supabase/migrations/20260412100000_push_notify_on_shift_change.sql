-- Push automatica al dipendente quando un turno cambia orario/data o viene eliminato.
-- Richiede: estensione pg_net (come per staff_messages) e variabili di sessione database:
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<service_role_jwt>';
-- (oppure equivalente per il vostro ambiente; vedi 20260403140000_push_subscriptions.sql)

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_push_on_shift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base   text;
  _url    text;
  _body   text;
  _rec    uuid;
  _start  text;
  _end    text;
  _range  text;
BEGIN
  _base := rtrim(coalesce(nullif(current_setting('app.supabase_url', true), ''), ''), '/');
  IF _base = '' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  _url := _base || '/functions/v1/send-push-notification';

  IF TG_OP = 'DELETE' THEN
    _rec := OLD.user_id;
    _body := format(
      'Il tuo turno del %s è stato annullato',
      to_char(OLD.date, 'DD/MM/YYYY')
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.date IS NOT DISTINCT FROM NEW.date
       AND OLD.start_time IS NOT DISTINCT FROM NEW.start_time
       AND OLD.end_time IS NOT DISTINCT FROM NEW.end_time
    THEN
      RETURN NEW;
    END IF;
    _rec := NEW.user_id;
    _start := to_char(NEW.start_time::time, 'HH24:MI');
    IF NEW.end_time IS NULL THEN
      _range := _start;
    ELSE
      _end := to_char(NEW.end_time::time, 'HH24:MI');
      _range := _start || '-' || _end;
    END IF;
    _body := format(
      'Il tuo turno del %s è stato modificato: %s',
      to_char(NEW.date, 'DD/MM/YYYY'),
      _range
    );
  ELSE
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := _url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(nullif(current_setting('app.service_role_key', true), ''), '')
      ),
      body := jsonb_build_object(
        'message_type', 'private',
        'recipient_id', _rec,
        'push_title', 'FLOW',
        'body', left(_body, 120)
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'notify_push_on_shift: net.http_post failed: %', SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_on_shift_update ON public.shifts;
CREATE TRIGGER trg_push_on_shift_update
  AFTER UPDATE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_shift();

DROP TRIGGER IF EXISTS trg_push_on_shift_delete ON public.shifts;
CREATE TRIGGER trg_push_on_shift_delete
  AFTER DELETE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_shift();
