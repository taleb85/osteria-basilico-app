import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Language } from '../types';
import { getTranslations } from '../utils/translations';

/** Tempo minimo messaggio visibile prima del reload (ms). */
const RELOAD_DELAY_MS = 900;

/**
 * Forza un vero reload anche in contesti PWA/service-worker dove
 * `location.href = location.href` viene ignorato (stesso URL).
 */
function hardReload() {
  try {
    // Aggiunge un timestamp per forzare una navigazione vera anche in PWA standalone
    const url = new URL(window.location.href);
    url.searchParams.set('_r', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    try {
      window.location.reload();
    } catch {
      // ultimo tentativo
      window.location.assign(window.location.origin + window.location.pathname);
    }
  }
}

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

    const id = window.setTimeout(hardReload, RELOAD_DELAY_MS);

    // Fallback: se dopo 4 secondi il componente è ancora montato, forziamo comunque
    const fallbackId = window.setTimeout(hardReload, 4000);

    return () => {
      window.clearTimeout(id);
      window.clearTimeout(fallbackId);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-gradient-to-br from-[#f8fafc] via-white to-[rgba(45,90,39,0.12)] px-6 text-center font-sans backdrop-blur-md dark:from-[#0a0a0a] dark:via-[#171717] dark:to-[rgba(45,90,39,0.14)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={tv.post_unlock_restart_title ?? 'Aggiornamento'}
    >
      {/* Stesso linguaggio dello splash PWA: guscio quadrato arrotondato + logo */}
      <div
        className="mb-5 flex aspect-square w-[min(44vw,7.5rem)] max-w-[132px] items-center justify-center rounded-[1.75rem] bg-accent/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:bg-accent/15 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        aria-hidden
      >
        <img
          src="/logo-ob.svg"
          width={512}
          height={512}
          alt=""
          decoding="async"
          className="h-auto w-[52%] max-h-[58%] object-contain opacity-95"
        />
      </div>
      <h2 className="mb-2 text-lg font-bold tracking-tight text-accent sm:text-xl dark:text-[#d0dece]">
        {tv.post_unlock_restart_title ?? 'Aggiornamento in corso'}
      </h2>
      <p className="max-w-sm text-sm leading-relaxed text-slate-600 sm:text-base dark:text-neutral-300">
        {tv.post_unlock_restart_body ?? 'I dati sono stati salvati. Riavvio dell’app in corso…'}
      </p>
    </motion.div>
  );
}
