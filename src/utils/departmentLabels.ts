import type { Language } from '../types';
import { getDepartments } from './departments';
import { getTranslations } from './translations';

const BUILTIN_DEPT_TR_KEYS: Record<string, string> = {
  sala_bar: 'department_sala_bar',
  sala: 'department_sala',
  kitchen: 'department_kitchen',
  bar: 'department_bar',
};

/** Etichetta reparto per lingua UI: built-in tradotti; reparti personalizzati = `label` da anagrafica. */
export function translateDepartmentValue(value: string, lang: Language): string {
  const v = value.trim();
  const keyLc = v.toLowerCase();
  const tv = getTranslations(lang) as Record<string, string>;
  const trKey = BUILTIN_DEPT_TR_KEYS[keyLc];
  if (trKey && tv[trKey]) return tv[trKey];
  const hit = getDepartments().find((d) => d.value === v || d.value.toLowerCase() === keyLc);
  return hit?.label ?? v;
}

/** Campo profilo reparto vuoto o con etichetta (nessuno tradotto). */
export function formatDepartmentDisplayForProfile(value: string | undefined | null, lang: Language): string {
  const t = getTranslations(lang);
  const v = value?.trim();
  if (!v) return `— ${t.department_none} —`;
  return translateDepartmentValue(v, lang);
}
