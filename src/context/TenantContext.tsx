import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { setDatabaseTenant } from '../lib/database';
import type { Tenant } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_SLUG = import.meta.env.VITE_TENANT_SLUG ?? 'osteria-basilico';
const DEFAULT_ACCENT = '#2D5A27';

/** Legge lo slug dal sottodominio oppure dal path oppure dall'env var. */
function readSlugFromEnv(): string {
  // 1. VITE_TENANT_SLUG (build-time, usato per deploy dedicati)
  if (import.meta.env.VITE_TENANT_SLUG) return import.meta.env.VITE_TENANT_SLUG;

  // 2. Sottodominio: "basilico.myapp.com" → "basilico"
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const parts = hostname.split('.');
  if (parts.length >= 3) return parts[0]; // sottodominio

  // 3. Path: "/t/basilico/..." → "basilico"
  const pathMatch = typeof window !== 'undefined'
    ? window.location.pathname.match(/^\/t\/([^/]+)/)
    : null;
  if (pathMatch) return pathMatch[1];

  return DEFAULT_SLUG;
}

/** Applica le CSS variables del brand al documento. */
export function applyTenantBrand(accent: string): void {
  const root = document.documentElement;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--color-accent', accent);
  root.style.setProperty('--basilico-primary', accent);
  root.style.setProperty('--accent-hover', darken(accent, 0.08));
  root.style.setProperty('--accent-dark', darken(accent, 0.18));
}

function darken(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TenantContextValue {
  tenant: Tenant | null;
  tenantId: string | null;
  tenantSlug: string;
  isLoading: boolean;
  error: string | null;
  /** Aggiorna la config del tenant corrente (nome, colore) senza ricaricare la pagina. */
  updateTenantConfig: (patch: Partial<Pick<Tenant, 'name' | 'accent_color' | 'logo_url'>>) => Promise<void>;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  tenantId: null,
  tenantSlug: DEFAULT_SLUG,
  isLoading: true,
  error: null,
  updateTenantConfig: async () => {},
});

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function TenantProvider({ children }: { children: ReactNode }) {
  const slug = readSlugFromEnv();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      if (!supabase) {
        // Modalità offline/dev: usa defaults
        const mock: Tenant = {
          id: 'local',
          slug,
          name: 'Osteria Basilico',
          accent_color: DEFAULT_ACCENT,
          plan: 'basic',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (!cancelled) {
        setTenant(mock);
        setDatabaseTenant(mock.id);
        applyTenantBrand(mock.accent_color);
        setIsLoading(false);
        }
        return;
      }

      try {
        const { data, error: err } = await supabase
          .from('tenants')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .maybeSingle();

        if (cancelled) return;

        if (err) throw err;

        if (!data) {
          setError(`Sede "${slug}" non trovata o non attiva.`);
          setIsLoading(false);
          return;
        }

        setTenant(data as Tenant);
        setDatabaseTenant((data as Tenant).id);
        applyTenantBrand((data as Tenant).accent_color);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Errore caricamento sede.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug]);

  const updateTenantConfig = async (
    patch: Partial<Pick<Tenant, 'name' | 'accent_color' | 'logo_url'>>
  ) => {
    if (!supabase || !tenant) return;
    const { data, error: err } = await supabase
      .from('tenants')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', tenant.id)
      .select()
      .maybeSingle();
    if (err) throw err;
    if (data) {
      const updated = data as Tenant;
      setTenant(updated);
      if (patch.accent_color) applyTenantBrand(patch.accent_color);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantId: tenant?.id ?? null,
        tenantSlug: slug,
        isLoading,
        error,
        updateTenantConfig,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}
