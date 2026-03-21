/*
  # Seed Completo Staff Osteria Basilico

  1. Overview
    Popola il database con 20 utenti totali:
    - 6 titolari attivi (admin, manager, assistant_manager, camerieri, bartender)
    - 14 slot disponibili per futuri inserimenti (inattivi)
    
  2. Staff Titolari (Attivi)
    - Taleb Barikhan (admin, PIN: 8888)
    - Gustavo Ghetta (manager, PIN: 1111)
    - Alexis Man (assistant_manager, PIN: 2222)
    - Mauricio Man (waiter, PIN: 3333)
    - Freddy Junior (waiter, PIN: 4444)
    - Dany Man (bartender, PIN: 5555)

  3. Slot Disponibili (14 utenti)
    - Nome: "Dipendente"
    - Cognome: "Disponibile 1" fino a "Disponibile 14"
    - Ruolo: waiter (modificabile dall'admin)
    - PIN: 0000 (modificabile dall'admin)
    - Status: inactive (attivabili dall'admin)

  4. Notes
    - Reset completo di tutte le tabelle
    - Sort order definisce l'ordine di visualizzazione
    - Gli slot inattivi possono essere attivati modificando nome, cognome e PIN
*/

-- Reset completo database (rispettando foreign keys)
DELETE FROM punch_records;
DELETE FROM holiday_requests;
DELETE FROM shifts;
DELETE FROM users;

-- Inserimento 6 titolari attivi
INSERT INTO users (first_name, last_name, email, role, pin, status, sort_order, language, theme)
VALUES
  ('Taleb', 'Barikhan', 'taleb.barikhan@basilico.it', 'admin', '8888', 'active', 1, 'it', 'light'),
  ('Gustavo', 'Ghetta', 'gustavo.ghetta@basilico.it', 'manager', '1111', 'active', 2, 'it', 'light'),
  ('Alexis', 'Man', 'alexis.man@basilico.it', 'assistant_manager', '2222', 'active', 3, 'it', 'light'),
  ('Mauricio', 'Man', 'mauricio.man@basilico.it', 'waiter', '3333', 'active', 4, 'it', 'light'),
  ('Freddy', 'Junior', 'freddy.junior@basilico.it', 'waiter', '4444', 'active', 5, 'it', 'light'),
  ('Dany', 'Man', 'dany.man@basilico.it', 'bartender', '5555', 'active', 6, 'it', 'light');

-- Inserimento 14 slot disponibili (inattivi)
INSERT INTO users (first_name, last_name, email, role, pin, status, sort_order, language, theme)
VALUES
  ('Dipendente', 'Disponibile 1', 'slot01@basilico.it', 'waiter', '0000', 'inactive', 7, 'it', 'light'),
  ('Dipendente', 'Disponibile 2', 'slot02@basilico.it', 'waiter', '0000', 'inactive', 8, 'it', 'light'),
  ('Dipendente', 'Disponibile 3', 'slot03@basilico.it', 'waiter', '0000', 'inactive', 9, 'it', 'light'),
  ('Dipendente', 'Disponibile 4', 'slot04@basilico.it', 'waiter', '0000', 'inactive', 10, 'it', 'light'),
  ('Dipendente', 'Disponibile 5', 'slot05@basilico.it', 'waiter', '0000', 'inactive', 11, 'it', 'light'),
  ('Dipendente', 'Disponibile 6', 'slot06@basilico.it', 'waiter', '0000', 'inactive', 12, 'it', 'light'),
  ('Dipendente', 'Disponibile 7', 'slot07@basilico.it', 'waiter', '0000', 'inactive', 13, 'it', 'light'),
  ('Dipendente', 'Disponibile 8', 'slot08@basilico.it', 'waiter', '0000', 'inactive', 14, 'it', 'light'),
  ('Dipendente', 'Disponibile 9', 'slot09@basilico.it', 'waiter', '0000', 'inactive', 15, 'it', 'light'),
  ('Dipendente', 'Disponibile 10', 'slot10@basilico.it', 'waiter', '0000', 'inactive', 16, 'it', 'light'),
  ('Dipendente', 'Disponibile 11', 'slot11@basilico.it', 'waiter', '0000', 'inactive', 17, 'it', 'light'),
  ('Dipendente', 'Disponibile 12', 'slot12@basilico.it', 'waiter', '0000', 'inactive', 18, 'it', 'light'),
  ('Dipendente', 'Disponibile 13', 'slot13@basilico.it', 'waiter', '0000', 'inactive', 19, 'it', 'light'),
  ('Dipendente', 'Disponibile 14', 'slot14@basilico.it', 'waiter', '0000', 'inactive', 20, 'it', 'light');
