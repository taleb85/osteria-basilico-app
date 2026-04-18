/**
 * Script di build: genera tutti i PNG PWA e favicon dall'icona ufficiale FLOW.
 * Sorgente: icon-flow-final.png (1024px, bordi arrotondati inclusi).
 * Il flatten rimuove trasparenza per compatibilità iOS/Android.
 *
 * Imposta SKIP_ICON_GEN=1 per saltare la generazione (es. su Vercel
 * dove sharp potrebbe non compilare il binding nativo correttamente).
 *
 * NOTA: sharp viene importato dinamicamente DOPO il check SKIP_ICON_GEN.
 * Gli import statici in ES module sono hoistati prima di qualsiasi codice,
 * quindi non sarebbero mai saltati anche con process.exit(0) prima di essi.
 */

if (process.env.SKIP_ICON_GEN === '1') {
  console.log('[favicon] skipped (SKIP_ICON_GEN=1)');
  process.exit(0);
}

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const { default: sharp } = await import('sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const src = join(publicDir, 'icon-flow-final.png');

// Colore di sfondo icona FLOW (blu scuro del gradiente)
const bg = { r: 6, g: 20, b: 90 };

async function generateIcon(size, path) {
  await sharp(src)
    .resize(size, size, { fit: 'fill' })
    .flatten({ background: bg })
    .png()
    .toFile(path);
}

// favicon.ico = PNG 32x32 rinominato (formato accettato dai browser moderni)
async function generateFaviconIco(path) {
  const buf = await sharp(src)
    .resize(32, 32, { fit: 'fill' })
    .flatten({ background: bg })
    .png()
    .toBuffer();
  writeFileSync(path, buf);
}

await Promise.all([
  generateIcon(32,   join(publicDir, 'favicon-32.png')),
  generateFaviconIco(join(publicDir, 'favicon.ico')),
  generateIcon(180,  join(publicDir, 'apple-touch-icon.png')),
  generateIcon(192,  join(publicDir, 'icon-192.png')),
  generateIcon(512,  join(publicDir, 'icon-512.png')),
  generateIcon(512,  join(publicDir, 'flow-app-icon.png')),
  generateIcon(1024, join(publicDir, 'icon-1024.png')),
  generateIcon(1024, join(publicDir, 'app-icon-reference.png')),
]);

console.log('[favicon] FLOW — tutte le icone generate da icon-flow-final.png');
