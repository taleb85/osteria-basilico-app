import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type { Language } from '../types';
import { getTranslations } from '../utils/translations';

/** Tempo minimo messaggio visibile prima del reload (ms). */
const RELOAD_DELAY_MS = 1200;

/**
 * Dopo PIN corretto su blocco post-sync: messaggio di aggiornamento e reload pagina.
 * Il salvataggio dati avviene già in `runPostUnlockRefreshActions` prima che questo monti.
 */
export default function PostUnlockRestartOverlay({ language }: { language: Language }) {
  const t = getTranslations(language);
  const tv = t as Record<string, string>;
  const scheduled = useRef(false);

  useEffect(() => {
    if (scheduled.current) return;
    scheduled.current = true;
    const id = window.setTimeout(() => {
      window.location.reload();
    }, RELOAD_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-[#0f172a]/85 px-6 text-center font-sans backdrop-blur-md dark:bg-black/80"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={tv.post_unlock_restart_title ?? 'Aggiornamento'}
    >
      <Loader2 className="mb-5 h-12 w-12 animate-spin text-white" strokeWidth={2} aria-hidden />
      <h2 className="mb-2 text-lg font-bold tracking-tight text-white sm:text-xl">
        {tv.post_unlock_restart_title ?? 'Aggiornamento in corso'}
      </h2>
      <p className="max-w-sm text-sm leading-relaxed text-white/90 sm:text-base">
        {tv.post_unlock_restart_body ?? 'I dati sono stati salvati. Riavvio dell’app in corso…'}
      </p>
    </motion.div>
  );
}
