/*
  Funzione RPC con SECURITY DEFINER per eliminare un utente e tutti i suoi dati
  collegati, bypassando RLS (necessario perché l'app usa chiave anonima).

  La protezione applicativa (solo admin può chiamarla) è gestita in AppContext.
*/

CREATE OR REPLACE FUNCTION public.delete_user_cascade(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Timbrature collegate agli shift dell'utente
  DELETE FROM punch_records
  WHERE shift_id IN (
    SELECT id FROM shifts WHERE user_id = target_user_id
  );

  -- Timbrature dirette sull'utente
  DELETE FROM punch_records WHERE user_id = target_user_id;

  -- Push subscriptions
  DELETE FROM push_subscriptions WHERE user_id = target_user_id;

  -- Turni
  DELETE FROM shifts WHERE user_id = target_user_id;

  -- Richieste ferie
  DELETE FROM holiday_requests WHERE user_id = target_user_id;

  -- Messaggi inviati/ricevuti
  DELETE FROM staff_messages
  WHERE sender_id = target_user_id OR recipient_id = target_user_id;

  -- Utente
  DELETE FROM users WHERE id = target_user_id;
END;
$$;

-- Permette alla chiave anonima di chiamare la funzione
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.delete_user_cascade(UUID) TO authenticated;
