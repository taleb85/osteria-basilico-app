/**
 * Script di build: genera tutti i PNG PWA dall'icona ufficiale FLOW.
 * Usa sempre flow-app-icon-new.png (1024px sorgente).
 * Flatten con il colore del gradiente del bordo (no trasparenza) —
 * il sistema operativo (iOS/macOS/Android) applica da sé la maschera arrotondata.
 */

import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const src = join(publicDir, 'flow-app-icon-new.png');

// Colore del bordo del gradiente dell'icona FLOW (campionato dal pixel ~80,80)
const bg = { r: 251, g: 200, b: 246 };

async function generateIcon(size, path) {
  await sharp(src)
    .resize(size, size, { fit: 'fill' })
    .flatten({ background: bg })
    .png()
    .toFile(path);
}

await Promise.all([
  generateIcon(180, join(publicDir, 'apple-touch-icon.png')),
  generateIcon(192, join(publicDir, 'icon-192.png')),
  generateIcon(512, join(publicDir, 'icon-512.png')),
  generateIcon(512, join(publicDir, 'flow-app-icon.png')),
]);

console.log('[favicon] FLOW — icone PNG generate da flow-app-icon-new.png (no trasparenza)');
