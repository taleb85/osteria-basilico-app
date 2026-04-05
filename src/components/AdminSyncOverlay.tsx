/**
 * AdminSyncOverlay — overlay a schermo intero mostrato quando l'admin ha aggiornato
 * le impostazioni e tutti gli altri dispositivi devono ricaricare i dati.
 * Triggera un pull silenzioso dei dati, mostra il progresso e poi rimuove se stesso.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, RefreshCw, ShieldCheck } from 'lucide-react';

const STEPS = [
  { label: 'Aggiornamento impostazioni rilevato', doneAt: 0 },
  { label: 'Scaricamento nuovi dati', doneAt: 900 },
  { label: 'Applicazione modifiche', doneAt: 1800 },
  { label: 'Completato', doneAt: null },
];

interface Props {
  onDone: () => void;
  onReload: () => Promise<void>;
}

export default function AdminSyncOverlay({ onDone, onReload }: Props) {
  const scheduled = useRef(false);
  const [visibleCount, setVisibleCount] = useState(1);
  const [doneCount, setDoneCount] = useState(1);

  useEffect(() => {
    if (scheduled.current) return;
    scheduled.current = true;

    const timers: number[] = [];

    timers.push(window.setTimeout(() => setVisibleCount(2), 400));
    timers.push(window.setTimeout(() => setDoneCount(2), 900));
    timers.push(window.setTimeout(() => setVisibleCount(3), 1200));
    timers.push(window.setTimeout(() => setDoneCount(3), 1800));
    timers.push(window.setTimeout(() => setVisibleCount(4), 2200));
    timers.push(window.setTimeout(() => setDoneCount(4), 2800));

    // Esegue il reload silenzioso dei dati
    void onReload().catch(() => {});

    // Chiude l'overlay dopo 3.5 s
    const closeId = window.setTimeout(onDone, 3500);

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(closeId);
      scheduled.current = false;
    };
  }, [onDone, onReload]);

  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center px-6 text-center font-sans"
      style={
        dark
          ? { background: 'radial-gradient(circle at 50% 40%, rgba(51,102,204,0.18) 0%, transparent 55%), #000' }
          : { background: 'radial-gradient(circle at 50% 40%, rgba(51,102,204,0.09) 0%, transparent 55%), #f8fafc' }
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Aggiornamento dati in corso"
    >
      {/* Icona animata */}
      <div className="relative mb-8">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 120 120"
          style={{ transform: 'rotate(-90deg)' }}
        >
          <rect x="4" y="4" width="112" height="112" rx="26" ry="26"
            fill="none" stroke="rgba(51,102,204,0.12)" strokeWidth="3"
          />
          <motion.rect
            x="4" y="4" width="112" height="112" rx="26" ry="26"
            fill="none" stroke="#3366CC" strokeWidth="3"
            strokeLinecap="round"
            pathLength={1}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 3.2, ease: 'easeInOut' }}
          />
        </svg>
        <div className="flex aspect-square w-[min(44vw,7.5rem)] max-w-[120px] items-center justify-center rounded-[1.75rem] bg-[#3366CC]/10 dark:bg-[#3366CC]/15">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <ShieldCheck className="w-10 h-10 text-[#3366CC]" strokeWidth={1.5} />
          </motion.div>
        </div>
      </div>

      <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-1 tracking-tight">
        Dati aggiornati dall'admin
      </h1>
      <p className="text-sm text-slate-500 dark:text-neutral-400 mb-8 max-w-xs leading-relaxed">
        L'amministratore ha modificato le impostazioni. Aggiornamento automatico in corso…
      </p>

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
                    ? 'bg-[#3366CC]'
                    : 'border-2 border-slate-300 dark:border-neutral-600'
                }`}>
                  {done && !isLast && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                  {isLast && done && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                  {isLast && !done && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-[#3366CC]"
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
