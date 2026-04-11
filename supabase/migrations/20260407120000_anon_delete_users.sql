/*
  Ripristina il permesso DELETE per la chiave anonima sulla tabella `users`.

  La migration 20260310182540_implement_secure_rls_policies_v2.sql ha rimosso
  la policy anon DELETE e l'ha sostituita con una policy `authenticated` che
  controlla auth.uid() — ma l'app usa la chiave anonima, quindi auth.uid() è
  NULL e la delete fallisce silenziosamente (RLS non lancia errore).

  La protezione dal cancellare utenti a caso avviene a livello applicativo
  (controllo currentUser.role === 'admin' in AppContext.deleteUser).
*/

DROP POLICY IF EXISTS "anon_can_delete_users" ON public.users;
DROP POLICY IF EXISTS "Only admins can delete users" ON public.users;

CREATE POLICY "anon_can_delete_users"
  ON public.users
  FOR DELETE
  TO anon
  USING (true);
