/**
 * Script di build: genera tutti i PNG PWA e favicon dall'icona ufficiale FLOW.
 * Sorgente: flow-app-icon-new.png (1024px, bordi arrotondati inclusi).
 * Il flatten rimuove trasparenza per compatibilità iOS/Android.
 */

import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';
import sharp from 'sharp';

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
