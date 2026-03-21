/** Forza tema unico (Verde Bosco): rimuove dark mode. Usato per Logout. */
export function forceLightTheme(): void {
  document.documentElement.classList.remove('dark');
  localStorage.removeItem('userTheme');
  localStorage.removeItem('theme');
}
