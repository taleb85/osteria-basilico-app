/**
 * Script di build: genera icon.svg, favicon.svg e tutti i PNG PWA.
 * Usa sempre l'icona FLOW ufficiale indipendentemente dal tenant/slug.
 * Lo slug identifica solo i dati da caricare, non il branding.
 */

import { readFileSync, copyFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

async function svgToPng(svgBuffer, outPath, size = 180) {
  await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
}

// Sempre FLOW — lo slug non influisce sul branding
copyFileSync(join(publicDir, 'flow-app-icon.svg'), join(publicDir, 'icon.svg'));
copyFileSync(join(publicDir, 'flow-app-icon.svg'), join(publicDir, 'favicon.svg'));

const flowSvg = readFileSync(join(publicDir, 'flow-app-icon.svg'));
await Promise.all([
  svgToPng(flowSvg, join(publicDir, 'apple-touch-icon.png'), 180),
  svgToPng(flowSvg, join(publicDir, 'icon-192.png'), 192),
  svgToPng(flowSvg, join(publicDir, 'icon-512.png'), 512),
]);

console.log('[favicon] FLOW — icone generate (slug ignorato per il branding)');
