import { useState, useEffect } from 'react';

const QUERY = '(min-width: 768px)';

/**
 * true se la viewport è ≥ 768px (breakpoint Tailwind `md:`).
 * Usato per abilitare creazione/gestione turni su tablet e PC, non su telefono.
 */
export function useMinViewportMd(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return matches;
}
