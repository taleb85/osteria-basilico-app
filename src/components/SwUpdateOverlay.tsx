/**
 * SwUpdateOverlay — mostrato quando il Service Worker viene aggiornato (nuovo deploy).
 * Scollega la sessione corrente, mostra il progresso dell'aggiornamento e
 * reindirizza a /app per forzare la reinstallazione della PWA.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, RefreshCw } from 'lucide-react';

const STEPS = [
  { label: 'Nuova versione rilevata',   doneAt: 0    },
  { label: 'Download aggiornamento',    doneAt: 800  },
  { label: 'Pulizia cache precedente',  doneAt: 1600 },
  { label: 'Riavvio in corso…',         doneAt: null },
];

/** Reindirizza a /app (PWA gate) cancellando la sessione corrente. */
function redirectToApp() {
  try {
    // Cancella la sessione attiva (il profilo selezionato)
    sessionStorage.removeItem('app_session');
    // Forza reload a /app con cache-bust per scaricare i nuovi asset
    const url = new URL(window.location.origin + '/app');
    url.searchParams.set('_r', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.replace(window.location.origin + '/app');
  }
}

export default function SwUpdateOverlay() {
  const scheduled = useRef(false);
  const [visibleCount, setVisibleCount] = useState(1);
  const [doneCount, setDoneCount]       = useState(1);

  useEffect(() => {
    if (scheduled.current) return;
    scheduled.current = true;

    const timers: number[] = [];

    timers.push(window.setTimeout(() => setVisibleCount(2), 350));
    timers.push(window.setTimeout(() => setDoneCount(2),    800));
    timers.push(window.setTimeout(() => setVisibleCount(3), 1100));
    timers.push(window.setTimeout(() => setDoneCount(3),    1600));
    timers.push(window.setTimeout(() => setVisibleCount(4), 2000));

    // Redirect principale dopo 3 secondi
    const mainId   = window.setTimeout(redirectToApp, 3000);
    // Fallback sicuro dopo 5 secondi
    const safeId   = window.setTimeout(redirectToApp, 5000);

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(mainId);
      window.clearTimeout(safeId);
      scheduled.current = false;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-br from-[#f8fafc] via-white to-[rgba(0,26,128,0.08)] px-6 text-center font-sans"
      style={document.documentElement.classList.contains('dark') ? { background: 'radial-gradient(circle at 50% 50%, rgba(180,210,255,0.22) 0%, transparent 18%), radial-gradient(circle at 50% 50%, #1e3a8a 0%, #0e1e60 15%, #060f30 32%, #01050f 52%, #000 72%)' } : undefined}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Aggiornamento app"
    >
      {/* Logo con bordo animato */}
      <div className="relative mb-8">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 120 120"
        >
          <circle cx="60" cy="60" r="54"
            fill="none" stroke="rgba(0,26,128,0.08)" strokeWidth="3"
          />
          <motion.circle
            cx="60" cy="60" r="54"
            fill="none" stroke="#001A80" strokeWidth="3"
            strokeLinecap="round"
            pathLength={1}
            initial={{ pathLength: 0, rotate: -90, originX: '60px', originY: '60px' }}
            animate={{ pathLength: 1 }}
            style={{ rotate: -90, originX: '60px', originY: '60px' }}
            transition={{ duration: 2.8, ease: 'easeInOut' }}
          />
        </svg>
        <div className="flex aspect-square w-[min(44vw,7.5rem)] max-w-[120px] items-center justify-center rounded-[1.75rem] bg-accent/10 dark:bg-accent/15">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <RefreshCw className="w-10 h-10 text-accent" strokeWidth={1.8} />
          </motion.div>
        </div>
      </div>

      {/* Titolo */}
      <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-1 tracking-tight">
        Aggiornamento disponibile
      </h1>
      <p className="text-sm text-slate-500 dark:text-neutral-400 mb-8 max-w-xs leading-relaxed">
        È stata rilasciata una nuova versione dell'app. Riavvio automatico in corso…
      </p>

      {/* Passi */}
      <ul className="w-full max-w-xs space-y-2.5 text-left">
        <AnimatePresence initial={false}>
          {STEPS.slice(0, visibleCount).map((step, i) => {
            const done = doneCount > i;
            const isLast = i === STEPS.length - 1;
            return (
              <motion.li
                key={step.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3"
              >
                <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-300 ${
                  done
                    ? 'bg-[#00D1FF]'
                    : 'border-2 border-slate-300 dark:border-neutral-600'
                }`}>
                  {done && !isLast && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                  {isLast && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-accent"
                    />
                  )}
                </div>
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  done
                    ? 'text-slate-700 dark:text-neutral-200'
                    : 'text-slate-400 dark:text-neutral-500'
                }`}>
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
