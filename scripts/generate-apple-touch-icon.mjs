/**
 * Genera apple-touch-icon.png — 180×180, opaco, sfondo #0052FF,
 * lettera "F" geometrica bianca centrata.
 * Apple richiede icone senza trasparenza per i Web Clip / profili .mobileconfig.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const SIZE = 180;

// SVG con sfondo pieno FLOW blue e "F" geometrica bianca
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 180 180">
  <!-- Sfondo solido FLOW blue — nessuna trasparenza -->
  <rect width="180" height="180" fill="#0052FF"/>

  <!-- Lettera F geometrica, bianca, centrata -->
  <!-- Asta verticale -->
  <rect x="54" y="42" width="22" height="96" rx="4" fill="white"/>
  <!-- Barra orizzontale superiore -->
  <rect x="54" y="42" width="72" height="22" rx="4" fill="white"/>
  <!-- Barra orizzontale media -->
  <rect x="54" y="82" width="56" height="20" rx="4" fill="white"/>
</svg>`;

await sharp(Buffer.from(svg))
  .resize(SIZE, SIZE)
  .flatten({ background: { r: 0, g: 82, b: 255 } })
  .png({ compressionLevel: 9 })
  .toFile(join(publicDir, 'apple-touch-icon.png'));

console.log('✅ apple-touch-icon.png generato — 180×180, opaco, #0052FF + F bianca');
