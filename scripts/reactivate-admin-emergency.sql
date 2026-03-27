-- Emergenza: nessun admin può entrare (account disattivato per errore).
-- Esegui in Supabase → SQL Editor (service role / owner).
--
-- 1) Vedi gli admin:
--    select id, email, first_name, role, status from public.users where role = 'admin';
--
-- 2) Riattiva quello giusto (sostituisci l'email):
update public.users
set status = 'active'
where role = 'admin'
  and email = 'LA_TUA_EMAIL_QUI';

-- Oppure per id:
-- update public.users set status = 'active' where id = 'UUID_QUI';
