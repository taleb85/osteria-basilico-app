import { motion } from 'framer-motion';
import { Lock, ShieldCheck, Delete, Fingerprint, Loader2 } from 'lucide-react';
import React, { ReactNode, useEffect } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface PinPadModalProps {
  title: string;
  subtitle: string;
  pinLabel: string;
  pin: string;
  onPinChange: (pin: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  error?: string;
  isLoading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  leftActionButton?: ReactNode;
  /** Sovrascrive le classi dell'overlay (default: 'bg-black/30 backdrop-blur-[3px]') */
  backdropClass?: string;
}

export function PinPadModal({
  title,
  subtitle,
  pinLabel,
  pin,
  onPinChange,
  onConfirm,
  onCancel,
  error,
  isLoading = false,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  leftActionButton,
  backdropClass,
}: PinPadModalProps) {
  useBodyScrollLock(true);

  const handleKey = (n: number | 'del') => {
    if (isLoading) return;
    if (n === 'del') {
      onPinChange(pin.slice(0, -1));
    } else if (pin.length < 4) {
      onPinChange(pin + String(n));
    }
  };

  // Supporto tastiera fisica
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isLoading) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKey(parseInt(e.key, 10));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleKey('del');
      } else if (e.key === 'Enter' && pin.length === 4) {
        e.preventDefault();
        onConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, isLoading]);

  const filledCount = pin.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className={`fixed inset-0 z-[10070] flex flex-col items-center justify-center overflow-hidden backdrop-blur-[2px] ${backdropClass ?? 'bg-black/8'}`}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.9 }}
        className="relative flex flex-col items-center justify-center px-4 py-6 w-full max-w-[300px] mx-4 rounded-2xl"
        style={{ background: 'radial-gradient(ellipse at 50% 20%, #1e4d1a 0%, #0d2409 55%, #050f04 100%)' }}
      >
        {/* Inner glass overlay */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{ border: '1px solid rgba(74,222,128,0.18)', boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)' }} />

        {/* Header */}
        <div className="relative flex flex-col items-center text-center mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl mb-3 shadow-lg shadow-accent/30"
            style={{ background: 'linear-gradient(135deg, var(--brand) 0%, #1a3818 100%)', border: '1px solid rgba(74,222,128,0.25)' }}>
            <Lock className="w-4 h-4 text-brand-300" strokeWidth={2.5} />
          </div>
          <h2 className="text-white font-bold uppercase tracking-widest text-sm mb-1">{title}</h2>
          <p className="text-white/50 text-xs font-medium leading-tight px-2">{subtitle}</p>
        </div>

        {/* PIN label + display */}
        <div className="relative flex flex-col items-center gap-1.5 mb-5 w-full">
          <div className="flex items-center gap-1.5 text-brand-400/80">
            <ShieldCheck className="w-4 h-4" strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{pinLabel}</span>
          </div>

          <div className="w-full h-12 rounded-xl flex items-center justify-center relative overflow-hidden"
            style={{ background: 'rgba(45,90,39,0.2)', border: '2px solid rgba(74,222,128,0.3)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="relative flex items-center justify-center">
                  {filledCount === i && (
                    <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}
                      className="absolute -left-2.5 h-8 w-[2px] rounded-full bg-brand-400" />
                  )}
                  <motion.div
                    animate={filledCount > i ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                    transition={{ duration: 0.18 }}
                    className="w-3.5 h-3.5 rounded-full transition-colors duration-200"
                    style={filledCount > i
                      ? { background: '#4ade80', boxShadow: '0 0 10px 3px rgba(74,222,128,0.55)' }
                      : { background: 'rgba(255,255,255,0.18)' }}
                  />
                  {filledCount === 4 && i === 3 && (
                    <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}
                      className="absolute -right-2.5 h-8 w-[2px] rounded-full bg-brand-400" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-xs font-bold text-center animate-shake">{error}</p>}
        </div>

        {/* Number Pad */}
        <div className="relative grid grid-cols-3 gap-2 w-full mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} type="button" onClick={() => handleKey(n)}
              className="h-12 rounded-xl font-bold text-xl text-white active:scale-95 transition-all"
              style={{ background: 'linear-gradient(160deg, rgba(45,90,39,0.55) 0%, rgba(20,50,18,0.7) 100%)', border: '1px solid rgba(74,222,128,0.22)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.5)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.22)')}
            >
              {n}
            </button>
          ))}

          {/* Bottom row */}
          <button type="button"
            onClick={() => leftActionButton && typeof leftActionButton === 'object' && (leftActionButton as React.ReactElement<{ onClick?: () => void }>).props?.onClick?.()}
            className="h-12 rounded-xl flex items-center justify-center text-white/40 hover:text-white/70 active:scale-95 transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Fingerprint className="w-5 h-5" />
          </button>

          <button type="button" onClick={() => handleKey(0)}
            className="h-12 rounded-xl font-bold text-xl text-white active:scale-95 transition-all"
            style={{ background: 'linear-gradient(160deg, rgba(45,90,39,0.55) 0%, rgba(20,50,18,0.7) 100%)', border: '1px solid rgba(74,222,128,0.22)', boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.22)')}>
            0
          </button>

          <button type="button" onClick={() => handleKey('del')}
            className="h-12 rounded-xl flex items-center justify-center text-white/40 hover:text-white/75 active:scale-95 transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="relative flex gap-2 w-full">
          <button type="button" onClick={onCancel}
            className="flex-1 h-11 rounded-xl font-bold text-sm text-white/70 hover:text-white active:scale-95 transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
            {cancelLabel}
          </button>
          <button type="button" disabled={pin.length !== 4 || isLoading} onClick={onConfirm}
            className="flex-1 h-11 rounded-xl text-white font-bold text-sm disabled:opacity-35 disabled:grayscale active:scale-95 transition-all flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, var(--brand) 0%, #1e3d1a 100%)', border: '1px solid rgba(74,222,128,0.35)', boxShadow: '0 4px 20px rgba(45,90,39,0.5)' }}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
