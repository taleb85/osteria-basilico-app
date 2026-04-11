import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
  /** ms visibili (default 3.5s) */
  duration?: number;
}


/**
 * Banner globale in basso al centro: successo blu FLOW, errore rosso.
 * Posizione ~bottom-6 + safe area (sopra home indicator iOS).
 */
export default function Toast({ message, type = 'error', onClose, duration = 6000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  const isSuccess = type === 'success';
  const isError = type === 'error';

  const accentColor = isSuccess ? '#22c55e' : isError ? '#ef4444' : '#94a3b8';

  const el = (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ y: -16, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -10, opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed left-1/2 z-[2147483647] flex max-w-[min(88vw,26rem)] -translate-x-1/2 items-center gap-2.5 rounded-full px-4 py-2.5"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        background: 'rgba(24,24,30,0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${accentColor}66`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.06)`,
      }}
    >
      <span
        className="shrink-0 h-2 w-2 rounded-full"
        style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}cc` }}
      />
      <p className="min-w-0 flex-1 text-left text-[13px] font-semibold leading-snug text-white break-words">{message}</p>
    </motion.div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(el, document.body);
}
