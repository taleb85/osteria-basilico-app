/*
  # Seed Staff Osteria Basilico

  1. Overview
    Popola il database con i 6 membri dello staff iniziali
    
  2. Staff Members
    - Taleb Barikhan (admin, PIN: 8888)
    - Gustavo Ghetta (manager, PIN: 1111)
    - Alexis Man (assistant_manager, PIN: 2222)
    - Mauricio Man (waiter, PIN: 3333)
    - Freddy Junior (waiter, PIN: 4444)
    - Dany Man (bartender, PIN: 5555)

  3. Notes
    - Gli UUID sono generati automaticamente
    - Svuota prima la tabella per reset completo
    - Sort order definisce l'ordine di visualizzazione
*/

-- Svuota le tabelle in ordine corretto (rispettando foreign keys)
DELETE FROM punch_records;
DELETE FROM holiday_requests;
DELETE FROM shifts;
DELETE FROM users;

-- Inserisci i 6 membri dello staff
INSERT INTO users (first_name, last_name, email, role, pin, status, sort_order, language, theme)
VALUES
  ('Taleb', 'Barikhan', 'taleb.barikhan@basilico.it', 'admin', '8888', 'active', 1, 'it', 'light'),
  ('Gustavo', 'Ghetta', 'gustavo.ghetta@basilico.it', 'manager', '1111', 'active', 2, 'it', 'light'),
  ('Alexis', 'Man', 'alexis.man@basilico.it', 'assistant_manager', '2222', 'active', 3, 'it', 'light'),
  ('Mauricio', 'Man', 'mauricio.man@basilico.it', 'waiter', '3333', 'active', 4, 'it', 'light'),
  ('Freddy', 'Junior', 'freddy.junior@basilico.it', 'waiter', '4444', 'active', 5, 'it', 'light'),
  ('Dany', 'Man', 'dany.man@basilico.it', 'bartender', '5555', 'active', 6, 'it', 'light');
