/**
 * Script di build: genera tutti i PNG PWA dall'icona ufficiale FLOW.
 * Usa sempre flow-app-icon.png — ignora tenant/slug per il branding.
 */

import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const src = join(publicDir, 'flow-app-icon.png');

await Promise.all([
  sharp(src).resize(180, 180).png().toFile(join(publicDir, 'apple-touch-icon.png')),
  sharp(src).resize(192, 192).png().toFile(join(publicDir, 'icon-192.png')),
  sharp(src).resize(512, 512).png().toFile(join(publicDir, 'icon-512.png')),
]);

console.log('[favicon] FLOW — icone PNG generate da flow-app-icon.png');
