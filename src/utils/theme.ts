/**
 * Tema fisso: l'app usa esclusivamente il tema chiaro (Blu/Light).
 * Il supporto dark mode è stato rimosso per alleggerire il bundle CSS
 * e garantire un'interfaccia immutabile.
 */

/** Rimuove la classe `dark` e blocca il tema chiaro. */
export function applyDocumentTheme(): void {
  document.documentElement.classList.remove('dark');
}

export function applyUnauthenticatedDocumentTheme(): void {
  applyDocumentTheme();
}
