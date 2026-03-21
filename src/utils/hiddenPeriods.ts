const KEY = 'osteria_hidden_periods';

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function save(dates: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(dates)]));
  } catch { /* ignore */ }
}

/** Restituisce l'insieme delle date nascoste (formato yyyy-MM-dd). */
export function getHiddenDates(): Set<string> {
  return new Set(load());
}

/** Aggiunge o rimuove la data dall'insieme. Restituisce il nuovo insieme. */
export function toggleHiddenDate(date: string): Set<string> {
  const current = load();
  const idx = current.indexOf(date);
  const next = idx >= 0 ? current.filter((d) => d !== date) : [...current, date];
  save(next);
  return new Set(next);
}

export function isDateHidden(date: string): boolean {
  return load().includes(date);
}

export function clearHiddenDates() {
  localStorage.removeItem(KEY);
}
