/**
 * Risolve un link breve /i/:slug → cerca il dipendente globalmente su tutti i tenant
 * → redirige a /profilo?t=<token-con-tenantSlug>.
 *
 * In modalità Option B (single-URL), non c'è un tenant pre-caricato:
 * la query va direttamente su Supabase senza filtro tenant_id.
 * Se lo slug non corrisponde a nessun utente, redirige a /profilo (login normale).
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { buildUserInviteSlug, buildProfiloAccessLink, PATH_PROFILO } from '../config/appPaths';

function cleanSlug(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type SlimUser = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  pin?: string | null;
  tenant_id?: string | null;
};

export default function InviteRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    if (!slug) {
      navigate(PATH_PROFILO, { replace: true });
      return;
    }

    async function resolve() {
      setResolving(true);

      try {
        if (!supabase) {
          // Ambiente locale senza Supabase — fallback al profilo
          navigate(PATH_PROFILO, { replace: true });
          return;
        }

        // Query globale su TUTTI i tenant (nessun filtro tenant_id)
        const [usersRes, tenantsRes] = await Promise.all([
          supabase
            .from('users')
            .select('id, first_name, last_name, pin, tenant_id')
            .eq('status', 'active'),
          supabase
            .from('tenants')
            .select('id, slug')
            .eq('is_active', true),
        ]);

        const allUsers: SlimUser[] = usersRes.data ?? [];
        const tenantSlugMap = new Map<string, string>(
          (tenantsRes.data ?? []).map((t: { id: string; slug: string }) => [t.id, t.slug])
        );

        // Raggruppa utenti per tenant per disambiguare gli slug correttamente
        const usersByTenant = new Map<string, SlimUser[]>();
        for (const u of allUsers) {
          const tid = u.tenant_id ?? '_none';
          if (!usersByTenant.has(tid)) usersByTenant.set(tid, []);
          usersByTenant.get(tid)!.push(u);
        }

        // Trova l'utente il cui slug (calcolato nel contesto del suo tenant) combacia
        let matched: SlimUser | undefined;
        let matchedTenantSlug = '';

        for (const [tenantId, tenantUsers] of usersByTenant) {
          const found = tenantUsers.find(
            (u) => buildUserInviteSlug(u, tenantUsers) === cleanSlug(slug)
          );
          if (found) {
            matched = found;
            matchedTenantSlug = tenantSlugMap.get(tenantId) ?? '';
            break;
          }
        }

        if (!matched) {
          navigate(PATH_PROFILO, { replace: true });
          return;
        }

        // Costruisce il token con tenantSlug incluso e redirige al login precompilato
        const link = buildProfiloAccessLink(matched.id, undefined, {
          displayName: `${matched.first_name ?? ''} ${matched.last_name ?? ''}`.trim(),
          pin: matched.pin ?? '',
          tenantSlug: matchedTenantSlug,
        });

        const url = new URL(link, window.location.origin);
        navigate(url.pathname + url.search, { replace: true });
      } catch {
        navigate(PATH_PROFILO, { replace: true });
      } finally {
        setResolving(false);
      }
    }

    resolve();
  }, [slug, navigate]);

  // Schermata di caricamento mentre risolve
  if (!resolving) return null;

  return (
    <div
      className="min-h-screen min-h-[100dvh] w-full flex flex-col items-center justify-center"
      style={{ backgroundColor: '#0052FF' }}
    >
      <div
        className="mb-6 text-white font-bold select-none"
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '2rem',
          letterSpacing: '-0.04em',
        }}
      >
        <span style={{ color: '#00D1FF' }}>F</span>LOW
      </div>
      <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
    </div>
  );
}
