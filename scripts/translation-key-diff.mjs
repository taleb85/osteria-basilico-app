/**
 * Confronta chiavi `baseIt` vs proprietà esplicite in `baseEn` in translations.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const filePath = join(root, 'src/utils/translations.ts');
const content = readFileSync(filePath, 'utf8');
const sf = ts.createSourceFile('translations.ts', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function getObjectLiteral(name) {
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const dec of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(dec.name) || dec.name.text !== name) continue;
      if (dec.initializer && ts.isObjectLiteralExpression(dec.initializer)) {
        return dec.initializer;
      }
    }
  }
  return null;
}

function extractStringValue(init) {
  if (!init) return null;
  if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
    return init.text;
  }
  if (ts.isTemplateExpression(init) && init.head) {
    return init.getText(sf).replace(/^`|`$/g, '');
  }
  return null;
}

function parseKeys(obj) {
  const keys = new Map();
  for (const prop of obj.properties) {
    if (ts.isSpreadElement(prop)) continue;
    if (ts.isPropertyAssignment(prop) && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))) {
      const key = prop.name.text ?? (ts.isStringLiteral(prop.name) ? prop.name.text : prop.name.getText(sf));
      const v = extractStringValue(prop.initializer) ?? (prop.initializer ? prop.initializer.getText(sf) : '');
      keys.set(key, v);
    }
  }
  return keys;
}

const baseIt = getObjectLiteral('baseIt');
const baseEn = getObjectLiteral('baseEn');
if (!baseIt || !baseEn) {
  console.error('Could not find baseIt or baseEn');
  process.exit(1);
}

const itMap = parseKeys(baseIt);
const enMap = parseKeys(baseEn);
const itKeys = new Set(itMap.keys());
const enExplicit = new Set(enMap.keys());

const missingInEn = [...itKeys].filter((k) => !enExplicit.has(k));
const missingInIt = [...enExplicit].filter((k) => !itKeys.has(k));

console.log('(a) IT senza entry esplicita in EN:', missingInEn.length);
if (missingInEn.length <= 50) {
  for (const k of missingInEn) console.log('  ', k);
} else {
  console.log(missingInEn.slice(0, 30).join('\n  '), '\n  ...');
}
console.log('\n(b) EN esplicita senza key in IT:', missingInIt.length);
if (missingInIt.length) console.log(missingInIt.join('\n'));

const out = join(root, 'scripts/translation-missing-in-en.json');
writeFileSync(
  out,
  JSON.stringify(
    {
      missingInEn: missingInEn.map((k) => ({ key: k, itValue: itMap.get(k) })),
      missingInIt: missingInIt,
    },
    null,
    2
  ),
  'utf8'
);
console.log('\nWrote', out);
