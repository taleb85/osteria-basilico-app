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
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Legge le variabili d'ambiente (disponibili a build time su Vercel)
const slug   = process.env.VITE_TENANT_SLUG   ?? '';
const title  = process.env.VITE_APP_TITLE      ?? 'Osteria Basilico';
const accent = process.env.VITE_TENANT_ACCENT  ?? '#2D5A27';

// Genera apple-touch-icon.png da un SVG buffer
async function svgToPng(svgBuffer, outPath, size = 180) {
  await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
}

// Se non c'è uno slug specifico → Osteria Basilico → copia logo originale come icon.svg
if (!slug || slug === 'osteria-basilico') {
  copyFileSync(join(publicDir, 'logo-ob.svg'), join(publicDir, 'icon.svg'));
  // Rigenera tutti i PNG da logo-ob.svg (Chrome usa icon-192/512 per l'icona installata)
  const obSvg = readFileSync(join(publicDir, 'logo-ob.svg'));
  await Promise.all([
    svgToPng(obSvg, join(publicDir, 'apple-touch-icon.png'), 180),
    svgToPng(obSvg, join(publicDir, 'icon-192.png'), 192),
    svgToPng(obSvg, join(publicDir, 'icon-512.png'), 512),
  ]);
  console.log('[favicon] Osteria Basilico → icon.svg = logo-ob.svg, tutti i PNG rigenerati');
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
      <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.20"/>
      <stop offset="35%"  stop-color="#FFFFFF" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="tg-tx" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#D1D9D4"/>
      <stop offset="38%"  stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F4FAF3"/>
    </linearGradient>
    <clipPath id="tg-clip">
      <rect width="512" height="512" rx="120" ry="120"/>
    </clipPath>
    <filter id="tg-drop" x="-8%" y="-6%" width="116%" height="118%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.18"/>
    </filter>
  </defs>
  <g filter="url(#tg-drop)">
    <g clip-path="url(#tg-clip)">
      <rect width="512" height="512" rx="120" ry="120" fill="url(#tg-bg)"/>
      <rect width="512" height="220" x="0" y="0" fill="url(#tg-gl)"/>
    </g>
  </g>
  <text x="256" y="250"
    text-anchor="middle" dominant-baseline="central"
    text-rendering="geometricPrecision"
    fill="url(#tg-tx)"
    font-family="system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
    font-weight="800" font-size="${fontSize}" letter-spacing="${spacing}"
    font-feature-settings="'kern' 1"
  >${inits}</text>
</svg>`;

// Scrive icon.svg (usato nel manifest PWA dinamico e come riferimento)
writeFileSync(join(publicDir, 'icon.svg'), svg, 'utf-8');
// Sovrascrive anche favicon.ico con un SVG (browser moderni accettano SVG come favicon)
writeFileSync(join(publicDir, 'favicon.ico'), svg, 'utf-8');

// Genera tutti i PNG tenant-specifici (Chrome usa icon-192/512 per l'icona installata)
const svgBuffer = Buffer.from(svg, 'utf-8');
await Promise.all([
  svgToPng(svgBuffer, join(publicDir, 'apple-touch-icon.png'), 180),
  svgToPng(svgBuffer, join(publicDir, 'icon-192.png'), 192),
  svgToPng(svgBuffer, join(publicDir, 'icon-512.png'), 512),
]);

console.log(`[favicon] Generato favicon per "${title}" (${inits}) con accent ${accent} — apple-touch-icon, icon-192, icon-512`);
