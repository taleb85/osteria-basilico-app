/**
 * Rilevamento lingua al primo avvio.
 * Priorità: 1) Profilo utente (gestito in AppContext), 2) Browser/OS, 3) Italiano (fallback).
 */
import type { Language } from '../types';

const SUPPORTED: Language[] = ['it', 'en', 'es', 'fr'];
const FALLBACK: Language = 'it';

/**
 * Mappa navigator.language (es. en-US, es-ES) al nostro Language.
 */
export function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return FALLBACK;
  const raw = navigator.language || (navigator as { userLanguage?: string }).userLanguage || '';
  const code = raw.split('-')[0].toLowerCase();
  if (code === 'en') return 'en';
  if (code === 'es') return 'es';
  if (code === 'fr') return 'fr';
  if (code === 'it') return 'it';
  return FALLBACK;
}

/**
 * Restituisce la lingua effettiva: salvata se presente, altrimenti browser, altrimenti italiano.
 */
export function getInitialLanguage(storedKey: string): Language {
  if (typeof localStorage === 'undefined') return FALLBACK;
  const stored = localStorage.getItem(storedKey) as Language | null;
  if (stored && SUPPORTED.includes(stored)) return stored;
  return detectBrowserLanguage();
}
