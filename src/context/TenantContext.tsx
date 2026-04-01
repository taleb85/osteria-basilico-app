import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { setDatabaseTenant } from '../lib/database';
import type { Tenant, TenantSettings } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_SLUG = import.meta.env.VITE_TENANT_SLUG ?? 'osteria-basilico';
const DEFAULT_ACCENT = '#2D5A27';

/** Legge lo slug dal sottodominio oppure dal path oppure dall'env var. */
function readSlugFromEnv(): string {
  if (import.meta.env.VITE_TENANT_SLUG) return import.meta.env.VITE_TENANT_SLUG;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const parts = hostname.split('.');
  if (parts.length >= 3) return parts[0];
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

/** Restituisce le iniziali (max 2) del nome sede. */
export function getTenantInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/** Converte un colore hex in { r, g, b }. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** Converte { r, g, b } in stringa hex. */
function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

/** Schiarisce un colore hex mescolandolo con il bianco (amount 0-1). */
function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Scurisce un colore hex (amount 0-1). */
function darkenColor(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/**
 * Genera un SVG stile "OB" con gradiente radiale, effetto vetro e testo gradiente.
 * Replica fedelmente il logo di Osteria Basilico sostituendo colore e iniziali.
 * Nota: filtro drop-shadow rimosso per massima compatibilità browser quando usato come <img src>.
 * Restituisce un data URL usabile come <img src>.
 */
export function generateTenantLogoSvg(name: string, accent: string): string {
  const initials = getTenantInitials(name);
  const fontSize = initials.length === 1 ? 310 : initials.length === 2 ? 278 : 190;
  const letterSpacing = initials.length <= 2 ? 24 : 10;

  // Palette gradiente dal colore accent (proporzioni identiche al logo OB)
  const c0 = lighten(accent, 0.42);      // stop 0%  — luce calda al centro
  const c1 = lighten(accent, 0.18);      // stop 28% — leggermente chiaro
  const c2 = accent;                      // stop 55% — colore base
  const c3 = darkenColor(accent, 0.38);  // stop 100% — scuro ai bordi

  // SVG come stringa base64 — base64 è più robusto di encodeURIComponent per SVG complessi
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
    '<defs>',
    `<radialGradient id="g1" cx="38%" cy="26%" r="78%" fx="36%" fy="24%">`,
    `<stop offset="0%" stop-color="${c0}"/>`,
    `<stop offset="28%" stop-color="${c1}"/>`,
    `<stop offset="55%" stop-color="${c2}"/>`,
    `<stop offset="100%" stop-color="${c3}"/>`,
    '</radialGradient>',
    '<linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0%" stop-color="#fff" stop-opacity="0.22"/>',
    '<stop offset="35%" stop-color="#fff" stop-opacity="0.07"/>',
    '<stop offset="100%" stop-color="#fff" stop-opacity="0"/>',
    '</linearGradient>',
    '<linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0%" stop-color="#D1D9D4"/>',
    '<stop offset="38%" stop-color="#FFFFFF"/>',
    '<stop offset="100%" stop-color="#F4FAF3"/>',
    '</linearGradient>',
    '</defs>',
    // Sfondo squircle con gradiente radiale
    `<rect width="512" height="512" rx="120" ry="120" fill="url(#g1)"/>`,
    // Gloss superiore (pillowed)
    `<rect width="512" height="220" rx="120" ry="120" fill="url(#g2)"/>`,
    // Testo iniziali con gradiente
    `<text x="256" y="256" text-anchor="middle" dominant-baseline="central"`,
    ` fill="url(#g3)"`,
    ` font-family="system-ui,-apple-system,sans-serif"`,
    ` font-weight="800" font-size="${fontSize}" letter-spacing="${letterSpacing}"`,
    `>${initials}</text>`,
    '</svg>',
  ].join('');

  // base64 garantisce compatibilità massima in tutti i browser per SVG come <img>
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Aggiorna il Web App Manifest in-memory con i dati del tenant.
 * Funziona per la schermata "Aggiungi alla home" del browser.
 * Nota: le icone già installate non si aggiornano finché l'utente non
 * reinstalla la PWA.
 */
export function updatePWAManifest(tenant: Tenant): void {
  const iconSrc = tenant.logo_url ?? '/icon-192.png';
  const manifest = {
    name: tenant.name,
    short_name: tenant.name.split(' ')[0],
    description: `App di gestione per ${tenant.name}`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: tenant.accent_color,
    orientation: 'any',
    icons: [
      { src: iconSrc, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: iconSrc, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: iconSrc, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: iconSrc, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Timbratura', short_name: 'Timbratura', url: '/timbratura' },
      { name: 'Profilo',    short_name: 'Profilo',    url: '/profilo' },
    ],
  };

  try {
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const blobUrl = URL.createObjectURL(blob);

    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    // Revoca il precedente blob URL per evitare memory leak
    if (link.href.startsWith('blob:')) URL.revokeObjectURL(link.href);
    link.href = blobUrl;

    // Aggiorna anche il meta theme-color
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = tenant.accent_color;
  } catch {
    // In ambienti senza blob URL (SSR/test) ignora silenziosamente
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TenantContextValue {
  tenant: Tenant | null;
  tenantId: string | null;
  tenantSlug: string;
  tenantSettings: TenantSettings;
  /** Logo URL del tenant: logo_url se presente, altrimenti SVG generato dalle iniziali. */
  tenantLogoUrl: string;
  isLoading: boolean;
  error: string | null;
  updateTenantConfig: (patch: Partial<Pick<Tenant, 'name' | 'accent_color' | 'logo_url'>>) => Promise<void>;
  updateTenantSettings: (patch: Partial<TenantSettings>) => Promise<void>;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  tenantId: null,
  tenantSlug: DEFAULT_SLUG,
  tenantSettings: {},
  tenantLogoUrl: generateTenantLogoSvg('App', DEFAULT_ACCENT),
  isLoading: true,
  error: null,
  updateTenantConfig: async () => {},
  updateTenantSettings: async () => {},
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

  const applyTenant = (t: Tenant) => {
    setTenant(t);
    setDatabaseTenant(t.id);
    applyTenantBrand(t.accent_color);
    updatePWAManifest(t);
    // Titolo scheda browser + meta Apple
    document.title = t.name;
    const appleTitleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (appleTitleMeta) appleTitleMeta.content = t.name;
    const descMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (descMeta) descMeta.content = `Sistema di gestione per ${t.name}`;
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      if (!supabase) {
        const mock: Tenant = {
          id: 'local',
          slug,
          name: 'Osteria Basilico',
          accent_color: DEFAULT_ACCENT,
          plan: 'basic',
          is_active: true,
          settings: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (!cancelled) { applyTenant(mock); setIsLoading(false); }
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

        applyTenant(data as Tenant);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Errore caricamento sede.');
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
      applyTenant(updated);
    }
  };

  const updateTenantSettings = async (patch: Partial<TenantSettings>) => {
    if (!supabase || !tenant) return;
    const merged: TenantSettings = { ...(tenant.settings ?? {}), ...patch };
    const { data, error: err } = await supabase
      .from('tenants')
      .update({ settings: merged, updated_at: new Date().toISOString() })
      .eq('id', tenant.id)
      .select()
      .maybeSingle();
    if (err) throw err;
    if (data) applyTenant(data as Tenant);
  };

  // Logo URL: usa logo_url se presente, altrimenti genera SVG dalle iniziali
  const tenantLogoUrl = tenant?.logo_url
    ?? generateTenantLogoSvg(tenant?.name ?? 'App', tenant?.accent_color ?? DEFAULT_ACCENT);

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantId: tenant?.id ?? null,
        tenantSlug: slug,
        tenantSettings: tenant?.settings ?? {},
        tenantLogoUrl,
        isLoading,
        error,
        updateTenantConfig,
        updateTenantSettings,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}
