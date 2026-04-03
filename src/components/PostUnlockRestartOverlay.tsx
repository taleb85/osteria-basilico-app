import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import type { Language } from '../types';
import { getTranslations } from '../utils/translations';

/** Tempo minimo messaggio visibile prima del reload (ms). */
const RELOAD_DELAY_MS = 3200;

const STEPS = [
  { label: 'Dati profilo salvati',        doneAt: 0    },
  { label: 'Configurazione aggiornata',   doneAt: 900  },
  { label: 'Cache sincronizzata',         doneAt: 1800 },
  { label: 'Riavvio in corso…',          doneAt: null  },
];

/**
 * Forza un vero reload anche in contesti PWA/service-worker dove
 * `location.href = location.href` viene ignorato (stesso URL).
 */
function hardReload() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_r', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    try {
      window.location.reload();
    } catch {
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
  const [visibleCount, setVisibleCount] = useState(1);
  const [doneCount, setDoneCount]       = useState(1);

  useEffect(() => {
    if (scheduled.current) return;
    scheduled.current = true;

    // Mostra e completa i passaggi progressivamente
    const stepTimers: number[] = [];

    // Step 2 visibile a 400ms, completato a 900ms
    stepTimers.push(window.setTimeout(() => setVisibleCount(2), 400));
    stepTimers.push(window.setTimeout(() => setDoneCount(2),    900));

    // Step 3 visibile a 1200ms, completato a 1800ms
    stepTimers.push(window.setTimeout(() => setVisibleCount(3), 1200));
    stepTimers.push(window.setTimeout(() => setDoneCount(3),    1800));

    // Step 4 (spinner "Riavvio in corso…") visibile a 2200ms
    stepTimers.push(window.setTimeout(() => setVisibleCount(4), 2200));

    // Reload principale
    const reloadId = window.setTimeout(hardReload, RELOAD_DELAY_MS);

    // Fallback sicuro
    const fallbackId = window.setTimeout(hardReload, 5000);

    return () => {
      stepTimers.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(reloadId);
      window.clearTimeout(fallbackId);
      scheduled.current = false;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-gradient-to-br from-[#f8fafc] via-white to-[rgba(0,82,255,0.10)] px-6 text-center font-sans backdrop-blur-md dark:from-[#0a0a0a] dark:via-[#171717] dark:to-[rgba(0,82,255,0.10)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={tv.post_unlock_restart_title ?? 'Aggiornamento'}
    >
      {/* Logo con bordo di progresso animato */}
      <div className="relative mb-5 flex aspect-square w-[min(44vw,7.5rem)] max-w-[132px]" aria-hidden>
        {/* SVG bordo progress — traccia il contorno del contenitore */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Traccia di sfondo */}
          <rect x="2" y="2" width="116" height="116" rx="26" className="stroke-accent/20 dark:stroke-accent/25" strokeWidth="3" />
          {/* Traccia animata */}
          <motion.rect
            x="2" y="2" width="116" height="116" rx="26"
            className="stroke-accent dark:stroke-[#d0dece]"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: RELOAD_DELAY_MS / 1000, ease: 'easeInOut' }}
          />
        </svg>

        {/* Contenitore logo */}
        <div className="flex h-full w-full items-center justify-center rounded-[1.75rem] bg-accent/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:bg-accent/15 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <img
            src="/logo-ob.svg"
            width={512}
            height={512}
            alt=""
            decoding="async"
            className="h-auto w-[52%] max-h-[58%] object-contain opacity-95"
          />
        </div>
      </div>

      <h2 className="mb-5 text-lg font-bold tracking-tight text-accent sm:text-xl dark:text-[#d0dece]">
        {tv.post_unlock_restart_title ?? 'Aggiornamento in corso'}
      </h2>

      {/* Passaggi */}
      <ul className="mb-6 flex w-full max-w-[220px] flex-col gap-2.5 text-left" aria-hidden>
        <AnimatePresence initial={false}>
          {STEPS.slice(0, visibleCount).map((step, i) => {
            const isDone  = i < doneCount;
            const isLast  = step.doneAt === null;
            return (
              <motion.li
                key={step.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex items-center gap-2.5"
              >
                {/* Icona */}
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                    isDone
                      ? 'bg-accent text-white dark:bg-[#d0dece] dark:text-[#0a0a0a]'
                      : isLast
                      ? 'bg-accent/15 text-accent dark:bg-accent/25 dark:text-[#d0dece]'
                      : 'bg-slate-200 dark:bg-neutral-700'
                  }`}
                >
                  {isDone ? (
                    <Check className="h-3 w-3" strokeWidth={3} />
                  ) : (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                </span>

                {/* Testo */}
                <span
                  className={`text-xs font-medium transition-colors duration-300 ${
                    isDone
                      ? 'text-slate-700 dark:text-neutral-200'
                      : 'text-slate-400 dark:text-neutral-400'
                  }`}
                >
                  {step.label}
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

    </motion.div>
  );
}
