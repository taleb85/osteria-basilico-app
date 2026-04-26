/**
 * Generates iOS-style splash PNGs. Uses sharp (already a devDep) to rasterize SVG,
 * so no native `canvas` build (Node 24 has no prebuilt node-canvas yet).
 * Visual intent matches: bg #0d3b6e, FLOW, WORK IN MOTION.
 */
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/splash');
mkdirSync(outDir, { recursive: true });

const sizes = [
  [750, 1334],
  [1125, 2436],
  [828, 1792],
  [1170, 2532],
  [1179, 2556],
  [1536, 2048],
  [1668, 2388],
  [2048, 2732],
];

for (const [w, h] of sizes) {
  const titleSize = Math.round(w * 0.1);
  const subSize = Math.round(w * 0.03);
  const subY = h / 2 + Math.round(w * 0.13);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#0d3b6e"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${titleSize}">FLOW</text>
  <text x="50%" y="${subY}" text-anchor="middle" dominant-baseline="middle" fill="#7a8fad" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="${subSize}">WORK IN MOTION</text>
</svg>`;

  const buffer = await sharp(Buffer.from(svg, 'utf8')).png().toBuffer();
  const filename = `splash-${w}x${h}.png`;
  writeFileSync(join(outDir, filename), buffer);
  console.log(`✓ ${filename}`);
}

console.log('\nTutti gli splash generati in public/splash/');
