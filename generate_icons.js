const { createCanvas } = require('canvas');
const fs = require('fs');

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function generateIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const radius = size * 0.2;
  roundRect(ctx, 0, 0, size, size, radius);
  ctx.fillStyle = '#00A86B';
  ctx.fill();

  const fontSize = Math.floor(size * 0.35);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('OB', size / 2, size / 2);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, buffer);
  console.log(`Generated ${filename}`);
}

// Generate icons
generateIcon(192, './public/icon-192.png');
generateIcon(512, './public/icon-512.png');
generateIcon(180, './public/apple-touch-icon.png');
