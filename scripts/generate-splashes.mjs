/**
 * Generates iOS-style splash PNGs. Uses sharp (devDep) to rasterize SVG.
 * Visual: bg #0a0a0c, stacked-bar icon, FLOW, WORK IN MOTION.
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
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

async function generateSplash(w, h) {
  const iconSize = Math.round(w * 0.25);
  const barW = Math.round(iconSize * 0.74);
  const barH = Math.round(iconSize * 0.138);
  const barGap = Math.round(iconSize * 0.063);
  const barR = Math.round(barH / 2);
  const startX = Math.round((iconSize - barW) / 2);
  const bar1W = Math.round(barW * 0.73);
  const bar2W = barW;
  const bar3W = Math.round(barW * 0.51);
  const startY = Math.round((iconSize - (3 * barH + 2 * barGap)) / 2);

  const iconSvg = `
  <svg width="${iconSize}" height="${iconSize}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${iconSize}" height="${iconSize}" rx="${Math.round(iconSize * 0.175)}" fill="#1a2744"/>
    <!-- track 1 -->
    <rect x="${startX}" y="${startY}" width="${barW}" height="${barH}" rx="${barR}" fill="#3a2e35"/>
    <rect x="${startX}" y="${startY}" width="${bar1W}" height="${barH}" rx="${barR}" fill="#ff9900"/>
    <!-- track 2 -->
    <rect x="${startX}" y="${startY + barH + barGap}" width="${barW}" height="${barH}" rx="${barR}" fill="#3a2e35"/>
    <rect x="${startX}" y="${startY + barH + barGap}" width="${bar2W}" height="${barH}" rx="${barR}" fill="#ffaa00"/>
    <!-- track 3 -->
    <rect x="${startX}" y="${startY + 2 * (barH + barGap)}" width="${barW}" height="${barH}" rx="${barR}" fill="#3a2e35"/>
    <rect x="${startX}" y="${startY + 2 * (barH + barGap)}" width="${bar3W}" height="${barH}" rx="${barR}" fill="#ff9900"/>
    <!-- gloss -->
    <rect width="${iconSize}" height="${Math.round(iconSize * 0.52)}" rx="${Math.round(iconSize * 0.175)}" fill="rgba(255,255,255,0.10)"/>
  </svg>`;

  const fontSize = Math.round(w * 0.065);
  const subSize = Math.round(w * 0.022);
  const iconY = Math.round(h * 0.38);
  const textY = Math.round(iconY + iconSize + fontSize * 1.4);
  const subY = Math.round(textY + subSize * 2.2);

  const svg = `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#0a0a0c"/>
    <image href="data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}"
      x="${Math.round((w - iconSize) / 2)}" y="${iconY}"
      width="${iconSize}" height="${iconSize}"/>
    <text x="${w / 2}" y="${textY}"
      font-family="system-ui, sans-serif" font-weight="900"
      font-size="${fontSize}" fill="#ffffff"
      text-anchor="middle" letter-spacing="${Math.round(fontSize * 0.15)}">FLOW</text>
    <text x="${w / 2}" y="${subY}"
      font-family="system-ui, sans-serif" font-weight="500"
      font-size="${subSize}" fill="#7a8fad"
      text-anchor="middle" letter-spacing="${Math.round(subSize * 0.2)}">WORK IN MOTION</text>
  </svg>`;

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const filename = `splash-${w}x${h}.png`;
  writeFileSync(join(outDir, filename), buffer);
  console.log(`✓ ${filename}`);
}

for (const [w, h] of sizes) {
  await generateSplash(w, h);
}
console.log('\nTutti gli splash generati in public/splash/');
