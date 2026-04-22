/**
 * Tema fisso: Smart Pair dark.
 */

export function applyDocumentTheme(): void {
  document.documentElement.classList.remove('light');
}

export function persistThemePreference(): void {
  try {
    localStorage.removeItem('userTheme');
    localStorage.removeItem('theme');
  } catch { /* ignore */ }
}

export function readStoredThemePreference(): 'dark' {
  return 'dark';
}

export function applyUnauthenticatedDocumentTheme(): void {
  applyDocumentTheme();
}

export function forceLightTheme(): void {
  applyDocumentTheme();
}
