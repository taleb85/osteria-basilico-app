import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, AlertCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
  /** ms visibili (default 3.5s) */
  duration?: number;
}

/**
 * Banner globale in basso al centro: successo verde basilico, errore rosso.
 * Posizione ~bottom-6 + safe area (sopra home indicator iOS).
 */
export default function Toast({ message, type = 'error', onClose, duration = 3500 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  const isSuccess = type === 'success';
  const isError = type === 'error';

  const barClass = isSuccess
    ? 'bg-[var(--brand)] text-white border border-white/10 shadow-lg'
    : isError
      ? 'bg-red-600 text-white border border-red-500/80 shadow-lg'
      : 'bg-slate-800 text-white border border-slate-600/80 shadow-lg';

  const el = (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 24, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
      className={`fixed left-1/2 z-[9999] flex max-w-[min(90vw,28rem)] -translate-x-1/2 items-center gap-3 rounded-[12px] px-4 py-3 sm:max-w-md ${barClass}`}
      style={{
        // Sopra la bottom nav quando montata (`--app-bottom-nav-offset` da BottomNav), altrimenti come prima.
        bottom:
          'max(calc(var(--app-bottom-nav-offset, 0px) + 12px), calc(1.5rem + env(safe-area-inset-bottom, 0px)))',
      }}
    >
      {isSuccess ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
          <Check className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden />
        </span>
      ) : isError ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
          <AlertCircle className="h-5 w-5 text-white" strokeWidth={2.25} aria-hidden />
        </span>
      ) : null}
      <p className="min-w-0 flex-1 text-left text-sm font-bold leading-snug break-words">{message}</p>
    </motion.div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(el, document.body);
}
