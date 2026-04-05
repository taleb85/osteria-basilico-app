-- Retrofit turni creati dall’import storico CSV (prima: solo approval_status = confirmed).
-- Li porta allo stesso stato dei nuovi import: approvati congelati + tracciamento.
--
-- Criterio (conservativo): solo turni ancora non congelati, data già passata, nessuna
-- punch_records con shift_id = turno (l’import non crea timbrature). Può includere anche
-- turni passati «pubblicati» senza timbratura: se non va bene, restringere in SQL Editor
-- con AND tenant_id = '…' o intervallo su date.
UPDATE public.shifts
SET
  approval_status = 'approved',
  approved_at = now(),
  approved_start_time = start_time,
  approved_end_time = COALESCE(end_time, start_time),
  approved_by = 'import_storico'
WHERE approval_status = 'confirmed'
  AND approved_at IS NULL
  AND approved_by IS NULL
  AND date < CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1
    FROM public.punch_records pr
    WHERE pr.shift_id = shifts.id
  );
