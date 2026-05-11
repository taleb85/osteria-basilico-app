-- API keys per integrazioni REST di terze parti

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  permissions JSONB NOT NULL DEFAULT '["read"]'::jsonb
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_select_tenant" ON public.api_keys
  FOR SELECT USING (tenant_id = get_session_tenant_id());
CREATE POLICY "api_keys_insert_tenant" ON public.api_keys
  FOR INSERT WITH CHECK (tenant_id = get_session_tenant_id());
CREATE POLICY "api_keys_update_tenant" ON public.api_keys
  FOR UPDATE USING (tenant_id = get_session_tenant_id());
CREATE POLICY "api_keys_delete_tenant" ON public.api_keys
  FOR DELETE USING (tenant_id = get_session_tenant_id());
