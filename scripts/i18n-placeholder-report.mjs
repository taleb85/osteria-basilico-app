#!/usr/bin/env node
/**
 * Report: chiavi in baseIt con segnaposto […] o TODO nelle stringhe (smoke test i18n).
 * Uso: node scripts/i18n-placeholder-report.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = readFileSync(join(__dirname, '../src/utils/translations.ts'), 'utf8');
const re = /(baseIt|baseEs|baseFr)\s*:\s*Record<[^>]+>\s*=\s*\{/;
const itStart = file.indexOf('const baseIt');
const itEnd = file.indexOf('};\n\nconst baseEn');
const esStart = file.indexOf('const baseEs');
const esEnd = file.indexOf('};\n\nconst baseEnCopy') > 0
  ? file.indexOf('};\n\nconst baseEnCopy')
  : file.indexOf('const baseFr');
const slice = (a, b) => file.slice(a, b);
const itBlock = slice(itStart, itEnd);
const esBlock = esStart > 0 ? slice(esStart, esEnd) : '';
const reVal = /^\s*([a-zA-Z0-9_]+):\s*'([^'\\]*(?:\\.[^'\\]*)*)',?/gm;
const itMap = new Map();
let m;
while ((m = reVal.exec(itBlock)) !== null) {
  itMap.set(m[1], m[2].replace(/\\'/g, "'"));
}
const esMap = new Map();
while (esBlock && (m = reVal.exec(esBlock)) !== null) {
  esMap.set(m[1], m[2].replace(/\\'/g, "'"));
}
let placeholderIt = 0;
for (const v of itMap.values()) {
  if (v.includes('[…]') || v === '…' || v.includes('TODO:')) placeholderIt += 1;
}
let sameAsItInEs = 0;
for (const k of itMap.keys()) {
  if (esMap.has(k) && esMap.get(k) === itMap.get(k)) sameAsItInEs += 1;
}
console.log('I18N report (src/utils/translations.ts)');
console.log('- Chiavi baseIt (approssimativo):', itMap.size);
console.log("- Stringhe con segnaposto […] o TODO in baseIt: ", placeholderIt);
console.log('- Chiavi baseEs con valore identico a baseIt (possibili mancanze):', sameAsItInEs);
