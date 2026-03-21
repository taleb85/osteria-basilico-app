/**
 * Rasterizza public/logo-ob.svg in icone PWA (PNG opachi ai bordi, tinta #2D5A27 in trasparenza).
 * Uso: node scripts/generate-pwa-icons.mjs
 */
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const GREEN = '#2D5A27';
const logoSvg = join(publicDir, 'logo-ob.svg');

async function toPng(size) {
  return sharp(logoSvg)
    .resize(size, size)
    .png()
    .flatten({ background: GREEN })
    .toBuffer();
}

await writeFile(join(publicDir, 'icon-512.png'), await toPng(512));
await writeFile(join(publicDir, 'icon-192.png'), await toPng(192));
await writeFile(join(publicDir, 'apple-touch-icon.png'), await toPng(180));

const icoBuffer = await pngToIco([await toPng(16), await toPng(32), await toPng(48)]);
await writeFile(join(publicDir, 'favicon.ico'), icoBuffer);

console.log('OK: icon-512.png, icon-192.png, apple-touch-icon.png, favicon.ico (da logo-ob.svg, #2D5A27)');
