/*
  # Aggiunta Permessi Granulari per Utenti

  1. Overview
    Aggiunge 5 campi boolean alla tabella users per gestire permessi operativi specifici
    Questi permessi saranno modificabili solo dall'Admin attraverso l'interfaccia

  2. Nuovi Campi
    - can_create_shifts: Abilita la creazione di nuovi turni (pulsante +)
    - can_approve_shifts: Abilita l'approvazione dei turni (pulsante verde)
    - can_view_total_hours: Abilita la visualizzazione delle ore totali nei report
    - can_edit_staff_pins: Permette di modificare i PIN di altri utenti
    - can_manage_drafts: Abilita la pubblicazione delle settimane (pulsante "Pubblica Settimana")

  3. Default Values
    - Admin: Tutti i permessi attivi di default (true)
    - Manager/Assistant Manager: Permessi attivi di default
    - Staff (waiter/bartender): Permessi disattivati di default
    - Slot disponibili: Tutti i permessi disattivati

  4. Security
    - Solo l'Admin può modificare questi permessi
    - I permessi dell'Admin sono sempre attivi e non possono essere disabilitati
*/

-- Aggiungi i nuovi campi permessi alla tabella users
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS can_create_shifts boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_approve_shifts boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_total_hours boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit_staff_pins boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_drafts boolean DEFAULT false;

-- Imposta permessi per gli utenti esistenti basandosi sul loro ruolo
UPDATE users SET
  can_create_shifts = CASE 
    WHEN role IN ('admin', 'manager', 'assistant_manager') THEN true 
    ELSE false 
  END,
  can_approve_shifts = CASE 
    WHEN role IN ('admin', 'manager', 'assistant_manager') THEN true 
    ELSE false 
  END,
  can_view_total_hours = CASE 
    WHEN role IN ('admin', 'manager', 'assistant_manager') THEN true 
    ELSE false 
  END,
  can_edit_staff_pins = CASE 
    WHEN role = 'admin' THEN true 
    ELSE false 
  END,
  can_manage_drafts = CASE 
    WHEN role IN ('admin', 'manager', 'assistant_manager') THEN true 
    ELSE false 
  END
WHERE can_create_shifts IS NULL;

-- Assicura che i 14 slot disponibili abbiano tutti i permessi disattivati
UPDATE users SET
  can_create_shifts = false,
  can_approve_shifts = false,
  can_view_total_hours = false,
  can_edit_staff_pins = false,
  can_manage_drafts = false
WHERE status = 'inactive' AND first_name = 'Dipendente';
