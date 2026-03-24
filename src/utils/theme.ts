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

/** Logout, kiosk, schermata login: sempre chiaro e senza preferenza persistita. */
export function forceLightTheme(): void {
  document.documentElement.classList.remove('dark');
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('theme');
  } catch {
    /* ignore */
  }
}
