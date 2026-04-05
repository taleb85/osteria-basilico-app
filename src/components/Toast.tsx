import React, { useEffect } from 'react';
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
 * Banner globale in basso al centro: successo blu FLOW, errore rosso.
 * Posizione ~bottom-6 + safe area (sopra home indicator iOS).
 */
export default function Toast({ message, type = 'error', onClose, duration = 3500 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  const isSuccess = type === 'success';
  const isError = type === 'error';

  const barStyle: React.CSSProperties = isSuccess
    ? {
        background: 'linear-gradient(110deg, #3366CC, #001A80)',
        backdropFilter: 'blur(28px) saturate(2.2) brightness(1.08)',
        WebkitBackdropFilter: 'blur(28px) saturate(2.2) brightness(1.08)',
        border: '1px solid rgba(255,255,255,0.28)',
        boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.15), 0 8px 32px rgba(0,26,128,0.40), 0 2px 8px rgba(0,0,0,0.20)',
      }
    : isError
      ? {
          background: 'linear-gradient(135deg, rgba(239,68,68,0.85), rgba(185,28,28,0.90))',
          backdropFilter: 'blur(28px) saturate(2.2) brightness(1.08)',
          WebkitBackdropFilter: 'blur(28px) saturate(2.2) brightness(1.08)',
          border: '1px solid rgba(255,255,255,0.22)',
          boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.15), 0 8px 32px rgba(220,38,38,0.40), 0 2px 8px rgba(0,0,0,0.20)',
        }
      : {
          background: 'rgba(30,41,59,0.82)',
          backdropFilter: 'blur(28px) saturate(2.0)',
          WebkitBackdropFilter: 'blur(28px) saturate(2.0)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.20), 0 8px 32px rgba(0,0,0,0.45)',
        };
  const barClass = 'text-white';

  const el = (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -24, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
      className={`fixed left-1/2 z-[9999] flex max-w-[min(90vw,28rem)] -translate-x-1/2 items-center gap-3 rounded-[16px] px-4 py-3 sm:max-w-md ${barClass}`}
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 80px)',
        ...barStyle,
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
