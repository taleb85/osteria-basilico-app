import type { Language } from '../types';
import { translations, FORCE_ITALIAN } from './translations';

/**
 * Traduzione centralizzata dei ruoli nella lingua selezionata.
 * Usare per Menu, Liste, Profilo.
 */
export function translateRole(role: string, lang: Language = 'it'): string {
  const r = role?.toLowerCase().trim();
  const effectiveLang = FORCE_ITALIAN ? 'it' : lang;
  const t = translations[effectiveLang] ?? translations.it;
  switch (r) {
    case 'admin':
      return t.role_admin;
    case 'proprietario':
      return t.role_manager;
    case 'manager':
      return t.role_manager;
    case 'assistant_manager':
      return t.role_assistant_manager;
    case 'waiter':
    case 'server':
      return t.role_waiter;
    case 'cook':
    case 'chef':
      return t.role_cook;
    case 'bartender':
      return t.role_bartender;
    case 'dishwasher':
      return t.role_dishwasher;
    default:
      return role || '';
  }
}

/** @deprecated Usa translateRole(role, lang) per supporto multilingua */
export function getRoleLabel(role: string): string {
  return translateRole(role, 'it');
}
