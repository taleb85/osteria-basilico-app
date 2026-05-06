/**
 * translations/index.ts — Punto di ingresso unico per le traduzioni.
 * Importa i 4 file lingua ed espone le stesse funzioni di `src/utils/translations.ts`.
 *
 * Mantiene piena retrocompatibilità: chi importava `getTranslations`, `translate`,
 * `formatTrans`, ecc. da `src/utils/translations.ts` continua a funzionare.
 */

import { it, enUS, es, fr } from 'date-fns/locale';
import type { Locale as DateFnsLocale } from 'date-fns/locale';
import type { Language, AdminModuleKey } from '../types';

import baseItRaw from './it';
import baseEnRaw from './en';
import baseEsRaw from './es';
import baseFrRaw from './fr';

export const FORCE_ITALIAN = false;

export type { Language };

/* ── Cast a Record<string, string> ── */
const baseIt: Record<string, string> = baseItRaw as unknown as Record<string, string>;
const baseEn: Record<string, string> = baseEnRaw as unknown as Record<string, string>;
const baseEs: Record<string, string> = baseEsRaw as unknown as Record<string, string>;
const baseFr: Record<string, string> = baseFrRaw as unknown as Record<string, string>;

export const translations: Record<Language, Record<string, string>> = {
  it: baseIt,
  en: baseEn,
  es: baseEs,
  fr: baseFr,
};

const ADMIN_MODULE_TR_KEYS: Record<AdminModuleKey, string> = {
  visibility_management: 'admin_module_visibility_management',
  department_creation: 'admin_module_department_creation',
  violation_rules: 'admin_module_violation_rules',
  master_control_panel: 'admin_module_master_control_panel',
  auto_breaks: 'admin_module_auto_breaks',
};

/** Etichette moduli scheda Impostazioni (globali) dalla lingua attiva. */
export function getAdminModuleLabel(key: AdminModuleKey, t: Record<string, string>): string {
  const trKey = ADMIN_MODULE_TR_KEYS[key];
  return (trKey && t[trKey]) || key;
}

export function translate(key: string, lang?: Language): string {
  const language = (lang ?? 'it') as Language;
  return translations[language]?.[key] || translations.it[key] || key;
}

export function getTranslations(language: Language) {
  const lang = (language ?? 'it') as Language;
  return translations[lang] || translations.it;
}

/** Sostituisce `{chiave}` nella stringa con i valori in `vars` (i18n). */
export function formatTrans(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : `{${key}}`
  );
}

const LOCALE_MAP: Record<Language, DateFnsLocale> = {
  it,
  en: enUS,
  es,
  fr,
};

export function getDateLocale(language: Language) {
  return LOCALE_MAP[language ?? 'it'] ?? it;
}

/** BCP 47 tag for `Intl` (dates, numbers). */
export function getIntlLocale(language: Language): string {
  const lang = (language ?? 'it') as Language;
  if (lang === 'en') return 'en-GB';
  if (lang === 'es') return 'es-ES';
  if (lang === 'fr') return 'fr-FR';
  return 'it-IT';
}

/** Label + description for Master panel / Impostazioni feature toggles. */
export function getFeatureStrings(
  t: Record<string, string>,
  slug: string
): { label: string; description: string; detailLines: string[] } {
  const labelKey = `feature_${slug}_label`;
  const descKey = `feature_${slug}_desc`;
  const detailKey = `feature_${slug}_detail`;
  const rawDetail = t[detailKey] || '';
  const detailLines = rawDetail
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    label: t[labelKey] || slug,
    description: t[descKey] || '',
    detailLines,
  };
}

