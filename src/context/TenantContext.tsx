import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { setDatabaseTenant } from '../lib/database';
import type { Tenant, TenantSettings } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_SLUG = import.meta.env.VITE_TENANT_SLUG ?? 'osteria-basilico';
const DEFAULT_ACCENT = '#2D5A27';

/** Opzioni font per l'intestazione dell'app. */
export const HEADER_FONTS = [
  { id: 'parisienne',  label: 'Parisienne',       value: "'Parisienne', 'Snell Roundhand', cursive" },
  { id: 'great-vibes', label: 'Great Vibes',       value: "'Great Vibes', cursive" },
  { id: 'inter',       label: 'Inter (moderno)',   value: "'Inter', sans-serif" },
  { id: 'playfair',    label: 'Playfair Display',  value: "'Playfair Display', Georgia, serif" },
  { id: 'montserrat',  label: 'Montserrat',        value: "'Montserrat', 'Inter', sans-serif" },
] as const;
export type HeaderFontId = typeof HEADER_FONTS[number]['id'];

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

/** Converte hex in HSL [hue 0-360, sat 0-100, l 0-100]. */
function hexToHsl(hex: string): [number, number, number] {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/** Applica le CSS variables del brand al documento — genera tutte le varianti shade + nav + shadow. */
export function applyTenantBrand(accent: string): void {
  const root = document.documentElement;
  const { r, g, b } = hexToRgb(accent);
  const [hue, sat] = hexToHsl(accent);

  // Genera shade HSL con la stessa tonalità del brand
  const hsl = (l: number, sMod = 1) =>
    `hsl(${hue} ${Math.min(Math.round(sat * sMod), 100)}% ${l}%)`;

  // Variabili base (retrocompatibili con codice esistente)
  root.style.setProperty('--brand',           accent);
  root.style.setProperty('--brand-rgb',       `${r} ${g} ${b}`);
  root.style.setProperty('--accent',          accent);
  root.style.setProperty('--color-accent',    accent);
  root.style.setProperty('--basilico-primary',accent);
  root.style.setProperty('--accent-hover',    hsl(30));
  root.style.setProperty('--accent-dark',     hsl(20));
  root.style.setProperty('--accent-light',    hsl(87, 0.28));
  root.style.setProperty('--brand-hover',     hsl(30));
  root.style.setProperty('--brand-dark',      hsl(20));
  root.style.setProperty('--brand-light',     hsl(87, 0.28));
  root.style.setProperty('--brand-muted',     `rgb(${r} ${g} ${b} / 0.12)`);

  // Palette shades (50–900) — usate da Tailwind via brand-50…brand-900
  root.style.setProperty('--brand-50',  hsl(97, 0.25));
  root.style.setProperty('--brand-100', hsl(93, 0.35));
  root.style.setProperty('--brand-200', hsl(85, 0.50));
  root.style.setProperty('--brand-300', hsl(73, 0.70));
  root.style.setProperty('--brand-400', hsl(57, 0.85));
  root.style.setProperty('--brand-500', hsl(45));
  root.style.setProperty('--brand-600', hsl(35));
  root.style.setProperty('--brand-700', hsl(26));
  root.style.setProperty('--brand-800', hsl(17));
  root.style.setProperty('--brand-900', hsl(10));

  // Gradienti bottom-nav
  const dr = Math.round(r * 0.77), dg = Math.round(g * 0.77), db = Math.round(b * 0.77);
  root.style.setProperty('--brand-nav-from', `rgb(${r} ${g} ${b} / 0.92)`);
  root.style.setProperty('--brand-nav-to',   `rgb(${dr} ${dg} ${db} / 0.88)`);
  root.style.setProperty('--brand-nav-dark-from', `rgb(${r} ${g} ${b} / 0.88)`);
  root.style.setProperty('--brand-nav-dark-to',   `rgb(${Math.round(r*0.66)} ${Math.round(g*0.66)} ${Math.round(b*0.66)} / 0.84)`);

  // Ombra card accent
  root.style.setProperty('--shadow-card-accent',
    `0 4px 16px -4px rgb(${r} ${g} ${b} / 0.14), 0 2px 8px -4px rgb(15 23 42 / 0.08)`);

  // Calendar (react-day-picker)
  root.style.setProperty('--rdp-accent-color', accent);
  root.style.setProperty('--rdp-accent-background-color', `rgb(${r} ${g} ${b} / 0.14)`);
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

  // SVG identico al logo OB: clipPath + drop shadow + gloss piatto clippato
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
    '<stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.20"/>',
    '<stop offset="35%" stop-color="#FFFFFF" stop-opacity="0.06"/>',
    '<stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>',
    '</linearGradient>',
    '<linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0%" stop-color="#D1D9D4"/>',
    '<stop offset="38%" stop-color="#FFFFFF"/>',
    '<stop offset="100%" stop-color="#F4FAF3"/>',
    '</linearGradient>',
    '<clipPath id="gc"><rect width="512" height="512" rx="120" ry="120"/></clipPath>',
    '<filter id="gd" x="-8%" y="-6%" width="116%" height="118%">',
    '<feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.18"/>',
    '</filter>',
    '</defs>',
    '<g filter="url(#gd)">',
    '<g clip-path="url(#gc)">',
    '<rect width="512" height="512" rx="120" ry="120" fill="url(#g1)"/>',
    '<rect width="512" height="220" x="0" y="0" fill="url(#g2)"/>',
    '</g>',
    '</g>',
    `<text x="256" y="250" text-anchor="middle" dominant-baseline="central"`,
    ` text-rendering="geometricPrecision"`,
    ` fill="url(#g3)"`,
    ` font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"`,
    ` font-weight="800" font-size="${fontSize}" letter-spacing="${letterSpacing}"`,
    ` font-feature-settings="'kern' 1"`,
    `>${initials}</text>`,
    '</svg>',
  ].join('');

  // base64 garantisce compatibilità massima in tutti i browser per SVG come <img>
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Aggiorna tutte le <link rel="icon"> e <link rel="apple-touch-icon">
 * puntandole al logo del tenant (data URL SVG o URL remoto).
 */
function updateFavicon(logoSrc: string): void {
  try {
    // Rimuove tutti i favicon esistenti
    document.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    ).forEach((el) => el.remove());

    // Favicon principale SVG (tutti i browser moderni)
    const svgLink = document.createElement('link');
    svgLink.rel = 'icon';
    svgLink.type = 'image/svg+xml';
    svgLink.href = logoSrc;
    document.head.appendChild(svgLink);

    // Fallback PNG 32×32 (generato via Canvas)
    generatePngFavicon(logoSrc, 32).then((png32) => {
      const pngLink = document.createElement('link');
      pngLink.rel = 'icon';
      pngLink.type = 'image/png';
      pngLink.sizes = '32x32';
      pngLink.href = png32;
      document.head.appendChild(pngLink);
    }).catch(() => null);

    // Apple touch icon 180×180
    generatePngFavicon(logoSrc, 180).then((png180) => {
      const appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      appleLink.sizes = '180x180';
      appleLink.href = png180;
      document.head.appendChild(appleLink);
    }).catch(() => null);
  } catch {
    // Silent fail in ambienti SSR/test
  }
}

/**
 * Renderizza il logo SVG su un Canvas e restituisce un PNG data URL.
 * Usato per i fallback favicon PNG e apple-touch-icon.
 */
function generatePngFavicon(logoSrc: string, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('no ctx')); return; }
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = logoSrc;
  });
}

/**
 * Aggiorna il Web App Manifest in-memory con i dati del tenant.
 * Funziona per la schermata "Aggiungi alla home" del browser.
 * Nota: le icone già installate non si aggiornano finché l'utente non
 * reinstalla la PWA.
 */
export function updatePWAManifest(tenant: Tenant): void {
  // I blob URL non hanno base → tutti i path devono essere assoluti
  const origin = window.location.origin;
  const iconPng = `${origin}/icon-192.png`;
  const iconLarge = `${origin}/icon-512.png`;
  const iconSrc = tenant.logo_url ?? iconPng;
  const manifest = {
    name: tenant.name,
    short_name: tenant.name.split(' ')[0],
    description: `App di gestione per ${tenant.name}`,
    start_url: `${origin}/`,
    scope: `${origin}/`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: tenant.accent_color,
    orientation: 'any',
    icons: [
      { src: iconSrc,    sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: iconSrc,    sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: iconLarge,  sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: iconLarge,  sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Timbratura', short_name: 'Timbratura', url: `${origin}/timbratura` },
      { name: 'Profilo',    short_name: 'Profilo',    url: `${origin}/profilo` },
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
    // Font intestazione header (--brand-header-font)
    const fontValue = HEADER_FONTS.find(f => f.id === t.settings?.header_font)?.value
      ?? HEADER_FONTS[0].value;
    document.documentElement.style.setProperty('--brand-header-font', fontValue);
    updatePWAManifest(t);
    // Titolo scheda browser + meta Apple
    document.title = t.name;
    const appleTitleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (appleTitleMeta) appleTitleMeta.content = t.name;
    const descMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (descMeta) descMeta.content = `Sistema di gestione per ${t.name}`;
    // Barra superiore PWA (theme-color) → colore brand del tenant
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(m => {
      m.content = t.accent_color;
    });
    // Favicon dinamica: sostituisce l'icona statica OB con quella del tenant corrente
    const faviconSvg = t.logo_url ?? generateTenantLogoSvg(t.name, t.accent_color);
    updateFavicon(faviconSvg);
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
