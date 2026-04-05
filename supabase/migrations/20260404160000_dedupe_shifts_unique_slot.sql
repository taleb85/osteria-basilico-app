-- Doppio caricamento stessa settimana / stesso slot: elimina righe duplicate identiche
-- e impedisce nuovi duplicati (stessa sede, dipendente, giorno, fascia oraria, tipo).
--
-- Mantiene il turno con timbratura collegata (shift_id); se nessuna, il più vecchio.

DELETE FROM shifts s
WHERE s.id IN (
  SELECT id FROM (
    SELECT s2.id,
      ROW_NUMBER() OVER (
        PARTITION BY s2.tenant_id, s2.user_id, s2.date, s2.start_time, s2.end_time, s2.type
        ORDER BY
          EXISTS (SELECT 1 FROM punch_records pr WHERE pr.shift_id = s2.id) DESC,
          s2.created_at ASC NULLS LAST,
          s2.id ASC
      ) AS rn
    FROM shifts s2
  ) d
  WHERE d.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shifts_tenant_user_date_slot
  ON public.shifts (tenant_id, user_id, date, start_time, end_time, type);
