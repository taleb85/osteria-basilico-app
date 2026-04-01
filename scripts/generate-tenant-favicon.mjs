/**
 * Script di build: genera favicon.svg, icon.svg e aggiorna favicon.ico stub
 * per il tenant corrente (letto da VITE_TENANT_SLUG / VITE_APP_TITLE / VITE_TENANT_ACCENT).
 * Eseguito automaticamente prima di `npm run build` tramite `prebuild`.
 *
 * Per Osteria Basilico (slug assente) copia il logo-ob.svg originale → nessun cambiamento visibile.
 * Per altri tenant genera un SVG stile OB con le iniziali e il colore accent del tenant.
 */

import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Legge le variabili d'ambiente (disponibili a build time su Vercel)
const slug   = process.env.VITE_TENANT_SLUG   ?? '';
const title  = process.env.VITE_APP_TITLE      ?? 'Osteria Basilico';
const accent = process.env.VITE_TENANT_ACCENT  ?? '#2D5A27';

// Se non c'è uno slug specifico → Osteria Basilico → copia logo originale come icon.svg
if (!slug || slug === 'osteria-basilico') {
  copyFileSync(join(publicDir, 'logo-ob.svg'), join(publicDir, 'icon.svg'));
  console.log('[favicon] Osteria Basilico → icon.svg = logo-ob.svg originale');
  process.exit(0);
}

// Genera iniziali dal titolo
function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// Schiarisce un hex del fattore dato (0-1)
function lighten(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.round(((n >> 16) & 0xff) + (255 - ((n >> 16) & 0xff)) * amount);
  const g = Math.round(((n >> 8)  & 0xff) + (255 - ((n >> 8)  & 0xff)) * amount);
  const b = Math.round(( n        & 0xff) + (255 - ( n        & 0xff)) * amount);
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

// Scurisce un hex del fattore dato (0-1)
function darken(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.round(((n >> 16) & 0xff) * (1 - amount));
  const g = Math.round(((n >> 8)  & 0xff) * (1 - amount));
  const b = Math.round(( n        & 0xff) * (1 - amount));
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

const inits    = initials(title);
const fontSize = inits.length === 1 ? 310 : inits.length === 2 ? 278 : 190;
const spacing  = inits.length <= 2 ? 24 : 10;
const c0 = lighten(accent, 0.42);
const c1 = lighten(accent, 0.18);
const c2 = accent;
const c3 = darken(accent, 0.38);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="${title}">
  <defs>
    <radialGradient id="tg-bg" cx="38%" cy="26%" r="78%" fx="36%" fy="24%">
      <stop offset="0%"   stop-color="${c0}"/>
      <stop offset="28%"  stop-color="${c1}"/>
      <stop offset="55%"  stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </radialGradient>
    <linearGradient id="tg-gl" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#fff" stop-opacity="0.22"/>
      <stop offset="35%"  stop-color="#fff" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="tg-tx" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#D1D9D4"/>
      <stop offset="38%"  stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F4FAF3"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="120" ry="120" fill="url(#tg-bg)"/>
  <rect width="512" height="220" rx="120" ry="120" fill="url(#tg-gl)"/>
  <text x="256" y="256"
    text-anchor="middle" dominant-baseline="central"
    fill="url(#tg-tx)"
    font-family="system-ui,-apple-system,sans-serif"
    font-weight="800" font-size="${fontSize}" letter-spacing="${spacing}"
  >${inits}</text>
</svg>`;

// Scrive icon.svg (usato nel manifest PWA dinamico e come riferimento)
writeFileSync(join(publicDir, 'icon.svg'), svg, 'utf-8');
// Sovrascrive anche favicon.ico con un SVG (browser moderni accettano SVG come favicon)
writeFileSync(join(publicDir, 'favicon.ico'), svg, 'utf-8');

console.log(`[favicon] Generato favicon per "${title}" (${inits}) con accent ${accent}`);
