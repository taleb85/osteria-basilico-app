/*
  Semplificazione Gestione Turni
  ==============================
  - Rimuove lo stato 'approved' (diventa 'confirmed')
  - Rimuove colonne approved_at, approved_by, approved_start_time, approved_end_time
  - Rimuove tabella punch_audit_log (troppo overhead)
  
  I turni ora hanno solo 3 stati: draft, confirmed, absent.
  L'approvazione è automatica: un turno è "completato" quando ha
  timbratura entrata + uscita registrate.
*/

-- 1. Converti tutti i turni 'approved' → 'confirmed'
UPDATE shifts
SET approval_status = 'confirmed'
WHERE approval_status = 'approved';

-- 2. Rimuovi colonne non più necessarie
ALTER TABLE shifts
  DROP COLUMN IF EXISTS approved_at,
  DROP COLUMN IF EXISTS approved_by,
  DROP COLUMN IF EXISTS approved_start_time,
  DROP COLUMN IF EXISTS approved_end_time;

-- 3. Rimuovi tabella punch_audit_log
DROP TABLE IF EXISTS punch_audit_log CASCADE;
