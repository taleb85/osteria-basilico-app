-- Schema Messaggi per Osteria Basilico
-- Supporta sia messaggi broadcast (a tutti) che privati (a uno/a specifico)

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Mittente (chi invia il messaggio)
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Tipo di messaggio
  message_type TEXT NOT NULL CHECK (message_type IN ('broadcast', 'private')),
  
  -- Per messaggi privati: destinatario specifico
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  -- Nota: per broadcast, recipient_id è NULL
  
  -- Contenuto
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  
  -- Metadati
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Per marca di lettura per singolo utente (vedi message_reads)
  
  CONSTRAINT broadcast_no_recipient CHECK (
    (message_type = 'broadcast' AND recipient_id IS NULL) OR
    (message_type = 'private' AND recipient_id IS NOT NULL)
  )
);

-- Tabella per tracciare chi ha letto i messaggi
-- Necessaria perché i messaggi broadcast vanno a tutti ma ognuno ha suo stato di lettura
CREATE TABLE message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  
  -- Un utente non può marcare due volte lo stesso messaggio come letto
  UNIQUE(message_id, user_id),
  
  created_at TIMESTAMP DEFAULT now()
);

-- Indici per performance
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_type ON messages(message_type);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_message_reads_user ON message_reads(user_id);
CREATE INDEX idx_message_reads_unread ON message_reads(is_read, user_id);
CREATE INDEX idx_message_reads_user_unread ON message_reads(user_id, is_read);

-- RLS Policies

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

-- Messaggi: solo mittente può creare, tutti possono leggere quelli loro visibili
CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT
  USING (
    sender_id = auth.uid()::uuid OR
    (message_type = 'broadcast') OR
    (recipient_id = auth.uid()::uuid)
  );

CREATE POLICY "Managers can create messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()::uuid AND
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::uuid
      AND users.role IN ('admin', 'manager', 'assistant_manager')
    )
  );

-- Message Reads: solo l'utente può gestire le sue letture
CREATE POLICY "Users can view their read status"
  ON message_reads FOR SELECT
  USING (user_id = auth.uid()::uuid);

CREATE POLICY "Users can mark messages as read"
  ON message_reads FOR INSERT
  WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY "Users can update their read status"
  ON message_reads FOR UPDATE
  USING (user_id = auth.uid()::uuid);

-- Trigger: auto-crea message_reads per messaggi broadcast
CREATE OR REPLACE FUNCTION create_broadcast_message_reads()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.message_type = 'broadcast' THEN
    INSERT INTO message_reads (message_id, user_id, is_read)
    SELECT NEW.id, id, false FROM users
    WHERE users.id != NEW.sender_id;
  ELSIF NEW.message_type = 'private' THEN
    -- Per messaggi privati, crea entry per il destinatario
    INSERT INTO message_reads (message_id, user_id, is_read)
    VALUES (NEW.id, NEW.recipient_id, false);
    -- E per il mittente (così può tracciare che l'ha inviato)
    INSERT INTO message_reads (message_id, user_id, is_read)
    VALUES (NEW.id, NEW.sender_id, true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broadcast_message_reads_trigger
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION create_broadcast_message_reads();

-- Trigger: aggiorna updated_at
CREATE OR REPLACE FUNCTION update_message_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_timestamp_trigger
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_message_timestamp();

-- View: Messaggi per utente con info di lettura
CREATE VIEW user_messages AS
SELECT
  m.id,
  m.sender_id,
  (SELECT first_name || ' ' || last_name FROM users WHERE users.id = m.sender_id) AS sender_name,
  m.recipient_id,
  m.message_type,
  m.subject,
  m.body,
  m.created_at,
  mr.is_read,
  mr.read_at
FROM messages m
LEFT JOIN message_reads mr ON m.id = mr.message_id
WHERE
  m.sender_id = auth.uid()::uuid OR
  (m.message_type = 'broadcast') OR
  (m.recipient_id = auth.uid()::uuid);
