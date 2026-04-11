-- Push turni via payload allineato ai Database Webhook Supabase (docs: Database Webhooks).
-- pg_net accoda la POST in modo asincrono: non blocca il commit e non richiede l’app aperta.
--
-- URL destinazione: {app.supabase_url}/functions/v1/shift-change-webhook
-- Headers: Authorization Bearer {app.service_role_key}
--
-- Stessi secret della migration 20260403140000_push_subscriptions.sql:
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<service_role_jwt>';
--
-- Opzionale: puoi creare un Webhook da Dashboard (tabella shifts, stessi eventi) puntando
-- allo stesso URL e disattivare i trigger qui sotto, per gestire tutto dall’UI.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Rimuove vecchia logica che chiamava send-push-notification con body già costruito.
DROP TRIGGER IF EXISTS trg_push_on_shift_update ON public.shifts;
DROP TRIGGER IF EXISTS trg_push_on_shift_delete ON public.shifts;
DROP FUNCTION IF EXISTS public.notify_push_on_shift();

CREATE OR REPLACE FUNCTION public.notify_shift_change_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base text;
  _url  text;
  _payload jsonb;
BEGIN
  _base := rtrim(coalesce(nullif(current_setting('app.supabase_url', true), ''), ''), '/');
  IF _base = '' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.approval_status IS NOT DISTINCT FROM 'draft'::text THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.date IS NOT DISTINCT FROM NEW.date
       AND OLD.start_time IS NOT DISTINCT FROM NEW.start_time
       AND OLD.end_time IS NOT DISTINCT FROM NEW.end_time
    THEN
      RETURN NEW;
    END IF;
  END IF;

  _url := _base || '/functions/v1/shift-change-webhook';

  IF TG_OP = 'INSERT' THEN
    _payload := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    _payload := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', to_jsonb(OLD)
    );
  ELSE
    _payload := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', NULL,
      'old_record', to_jsonb(OLD)
    );
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := _url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(nullif(current_setting('app.service_role_key', true), ''), '')
      ),
      body := _payload
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'notify_shift_change_webhook: net.http_post failed: %', SQLERRM;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shift_change_webhook_insert ON public.shifts;
DROP TRIGGER IF EXISTS trg_shift_change_webhook_update ON public.shifts;
DROP TRIGGER IF EXISTS trg_shift_change_webhook_delete ON public.shifts;

CREATE TRIGGER trg_shift_change_webhook_insert
  AFTER INSERT ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_shift_change_webhook();

CREATE TRIGGER trg_shift_change_webhook_update
  AFTER UPDATE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_shift_change_webhook();

CREATE TRIGGER trg_shift_change_webhook_delete
  AFTER DELETE ON public.shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_shift_change_webhook();

COMMENT ON FUNCTION public.notify_shift_change_webhook() IS
  'Accoda POST verso Edge shift-change-webhook (payload come Database Webhooks Supabase).';
