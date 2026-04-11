-- =============================================================================
-- RLS punch_records — bozza per consulente / Supabase SQL Editor
-- =============================================================================
-- ATTENZIONE: l’app FLOW oggi usa la chiave anonima senza Supabase Auth per lo
-- staff (sessione custom in localStorage). Con il solo anon key queste policy
-- bloccherebbero l’app finché non si introduce uno di questi approcci:
--   A) Supabase Auth + colonna users.auth_id (uuid) = auth.uid(), oppure
--   B) JWT custom firmato da Edge Function con claim tenant_id, user_id, role.
--
-- Lo snippet sotto assume JWT claims JSON:
--   tenant_id  (uuid string)
--   app_user_id (uuid string) — id riga in public.users
--   app_role    (text) — es. admin | manager | assistant_manager | waiter | ...
--
-- Adatta i nomi dei claim al tuo provider prima di eseguire in produzione.
-- =============================================================================

-- Esempio helper (opzionale): ruoli gestionali
CREATE OR REPLACE FUNCTION public.jwt_is_management()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'app_role') IN ('admin', 'manager', 'assistant_manager'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.jwt_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(trim(auth.jwt() ->> 'tenant_id'), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.jwt_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(trim(auth.jwt() ->> 'app_user_id'), '')::uuid;
$$;

ALTER TABLE public.punch_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS punch_select_own_or_mgmt ON public.punch_records;
DROP POLICY IF EXISTS punch_insert_own ON public.punch_records;
DROP POLICY IF EXISTS punch_update_mgmt ON public.punch_records;
DROP POLICY IF EXISTS punch_delete_admin ON public.punch_records;

-- SELECT: propri record nello stesso tenant, oppure management sul tenant
CREATE POLICY punch_select_own_or_mgmt
  ON public.punch_records
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = jwt_tenant_id()
    AND (
      user_id = jwt_app_user_id()
      OR jwt_is_management()
    )
  );

-- INSERT: solo il proprio user_id nello stesso tenant
CREATE POLICY punch_insert_own
  ON public.punch_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id = jwt_tenant_id()
    AND user_id = jwt_app_user_id()
  );

-- UPDATE/DELETE: solo management (o restringi ad admin)
CREATE POLICY punch_update_mgmt
  ON public.punch_records
  FOR UPDATE
  TO authenticated
  USING (tenant_id = jwt_tenant_id() AND jwt_is_management())
  WITH CHECK (tenant_id = jwt_tenant_id() AND jwt_is_management());

CREATE POLICY punch_delete_admin
  ON public.punch_records
  FOR DELETE
  TO authenticated
  USING (
    tenant_id = jwt_tenant_id()
    AND (auth.jwt() ->> 'app_role') = 'admin'
  );
