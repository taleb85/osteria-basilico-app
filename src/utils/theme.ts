import type { Theme } from '../types';

const STORAGE_KEY = 'userTheme';

/** Applica la classe `dark` su `<html>` per Tailwind `darkMode: 'class'`. */
export function applyDocumentTheme(theme: Theme | null | undefined): void {
  const resolved: Theme = theme === 'dark' ? 'dark' : 'light';
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function persistThemePreference(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function readStoredThemePreference(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Login, kiosk, dopo logout: applica il tema da preferenza salvata (`userTheme`) o,
 * se assente, da `prefers-color-scheme`. Non cancella la scelta utente in localStorage.
 */
export function applyUnauthenticatedDocumentTheme(): void {
  const stored = readStoredThemePreference();
  if (stored === 'dark' || stored === 'light') {
    applyDocumentTheme(stored);
    return;
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    applyDocumentTheme('dark');
    return;
  }
  applyDocumentTheme('light');
}

/** Alias storico: non forza più il tema chiaro né rimuove le preferenze. */
export function forceLightTheme(): void {
  applyUnauthenticatedDocumentTheme();
}
