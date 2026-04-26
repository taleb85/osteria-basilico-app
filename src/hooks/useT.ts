/**
 * useT — wrapper unificato per le traduzioni Flow.
 *
 * Legge la lingua corrente da `useApp()` e restituisce l'oggetto `t` (Record)
 * come `getTranslations(effectiveLanguage)`.
 *
 * Uso:
 *   const t = useT();
 *   t.home
 *   t[dynamicKey as keyof typeof t]
 */
import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getTranslations } from '../utils/translations';

type Translations = ReturnType<typeof getTranslations>;

export function useT(): Translations {
  const { effectiveLanguage } = useApp();
  return useMemo(() => getTranslations(effectiveLanguage), [effectiveLanguage]);
}
