/**
 * Origine pubblica dell’app in produzione (link copiabili, Super Admin, metadati).
 * In build: imposta VITE_PUBLIC_APP_ORIGIN (es. dominio custom su Cloudflare Pages).
 */
const raw = import.meta.env.VITE_PUBLIC_APP_ORIGIN as string | undefined;
export const PUBLIC_APP_ORIGIN = (raw && raw.replace(/\/$/, '')) || 'https://flow-workinmotion.pages.dev';
