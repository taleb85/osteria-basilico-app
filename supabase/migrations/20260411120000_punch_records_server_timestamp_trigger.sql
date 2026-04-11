-- Timbratura: timestamp server-side (clock_timestamp) per source != manual.
-- Inserimenti manuali da Presenze (source = manual) conservano l'orario scelto dal gestore.

CREATE OR REPLACE FUNCTION public.punch_records_set_server_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source IS NOT NULL AND NEW.source::text = 'manual' THEN
    IF NEW.timestamp IS NULL THEN
      NEW.timestamp := clock_timestamp();
    END IF;
    RETURN NEW;
  END IF;
  NEW.timestamp := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_punch_records_server_timestamp ON public.punch_records;
CREATE TRIGGER trg_punch_records_server_timestamp
  BEFORE INSERT ON public.punch_records
  FOR EACH ROW
  EXECUTE FUNCTION public.punch_records_set_server_timestamp();
