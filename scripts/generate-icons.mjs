/**
 * Genera icone PWA dal logo Flow (barre arancioni su #1a2744) — niente ridimensionamento da PNG vecchi.
 * Output: public/icons/icon-{size}.png, public/favicon.ico, copie in public/ per /icon-192.png ecc.
 *
 * `SKIP_ICON_GEN=1` salta (es. CI senza sharp nativo).
 */
import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

if (process.env.SKIP_ICON_GEN === '1') {
  console.log('[icons] skipped (SKIP_ICON_GEN=1)');
  process.exit(0);
}

const { default: sharp } = await import('sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');
const outDir = join(publicDir, 'icons');
mkdirSync(outDir, { recursive: true });

const sizes = [16, 32, 48, 72, 96, 128, 144, 152, 167, 180, 192, 384, 512, 1024];

async function generateIcon(size) {
  const br = Math.round(size * 0.175);
  const tw = Math.round(size * 0.74);
  const th = Math.round(size * 0.138);
  const gap = Math.round(size * 0.063);
  const startX = Math.round((size - tw) / 2);
  const totalH = 3 * th + 2 * gap;
  const startY = Math.round((size - totalH) / 2);
  const pillR = Math.round(th / 2);
  const bar1W = Math.round(tw * 0.73);
  const bar2W = tw;
  const bar3W = Math.round(tw * 0.51);
  const glossH = Math.round(size * 0.52);

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="face" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#253660"/>
        <stop offset="40%" stop-color="#1a2744"/>
        <stop offset="100%" stop-color="#111c36"/>
      </linearGradient>
      <linearGradient id="fa" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffcc00"/>
        <stop offset="60%" stop-color="#ff9900"/>
        <stop offset="100%" stop-color="#e07800"/>
      </linearGradient>
      <linearGradient id="fb" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffd700"/>
        <stop offset="60%" stop-color="#ffaa00"/>
        <stop offset="100%" stop-color="#e08800"/>
      </linearGradient>
      <clipPath id="clip">
        <rect width="${size}" height="${size}" rx="${br}" ry="${br}"/>
      </clipPath>
    </defs>
    <rect width="${size}" height="${size}" rx="${br}" ry="${br}" fill="url(#face)"/>
    <rect x="${startX}" y="${startY}" width="${tw}" height="${th}" rx="${pillR}" fill="#3a2e35"/>
    <rect x="${startX}" y="${startY}" width="${bar1W}" height="${th}" rx="${pillR}" fill="url(#fa)"/>
    <rect x="${startX}" y="${startY + th + gap}" width="${tw}" height="${th}" rx="${pillR}" fill="#3a2e35"/>
    <rect x="${startX}" y="${startY + th + gap}" width="${bar2W}" height="${th}" rx="${pillR}" fill="url(#fb)"/>
    <rect x="${startX}" y="${startY + 2 * (th + gap)}" width="${tw}" height="${th}" rx="${pillR}" fill="#3a2e35"/>
    <rect x="${startX}" y="${startY + 2 * (th + gap)}" width="${bar3W}" height="${th}" rx="${pillR}" fill="url(#fa)"/>
    <rect width="${size}" height="${glossH}" rx="${br}" ry="${br}"
      fill="rgba(255,255,255,0.12)" clip-path="url(#clip)"/>
  </svg>`;

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const filename = `icon-${size}.png`;
  writeFileSync(join(outDir, filename), buffer);
  console.log(`✓ ${filename}`);
}

for (const size of sizes) {
  await generateIcon(size);
}

// favicon.ico (stesso identico a precedenza: payload PNG 32×32, molti browser lo accettano)
const icon32 = readFileSync(join(outDir, 'icon-32.png'));
const faviconBuf = await sharp(icon32).png().toBuffer();
writeFileSync(join(publicDir, 'favicon.ico'), faviconBuf);
console.log('✓ favicon.ico');

// Copie in /public per URL storici: notifiche, edge, super-admin
copyFileSync(join(outDir, 'icon-192.png'), join(publicDir, 'icon-192.png'));
copyFileSync(join(outDir, 'icon-512.png'), join(publicDir, 'icon-512.png'));
copyFileSync(join(outDir, 'icon-1024.png'), join(publicDir, 'icon-1024.png'));
copyFileSync(join(outDir, 'icon-180.png'), join(publicDir, 'apple-touch-icon.png'));
copyFileSync(join(outDir, 'icon-512.png'), join(publicDir, 'flow-app-icon.png'));
copyFileSync(join(outDir, 'icon-1024.png'), join(publicDir, 'app-icon-reference.png'));
console.log('✓ root: icon-192/512/1024, apple-touch-icon, flow-app-icon, app-icon-reference');

console.log('\nTutte le icone generate in public/icons/');
