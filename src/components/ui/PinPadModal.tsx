import { motion } from 'framer-motion';
import { Lock, ShieldCheck, Delete, Smartphone, Fingerprint, Loader2 } from 'lucide-react';
import { ReactNode } from 'react';

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
}: PinPadModalProps) {
  const handleKey = (n: number | 'del') => {
    if (isLoading) return;
    if (n === 'del') {
      onPinChange(pin.slice(0, -1));
    } else if (pin.length < 4) {
      onPinChange(pin + String(n));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10070] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="modal-glass-panel w-full max-w-[380px] rounded-[40px] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-accent dark:text-accent-light" strokeWidth={2.5} />
            <h2 className="text-slate-900 dark:text-neutral-100 font-bold uppercase tracking-wider text-sm">
              {title}
            </h2>
          </div>
          <p className="text-slate-500 dark:text-neutral-400 text-sm font-medium leading-tight px-4">
            {subtitle}
          </p>
        </div>

        {/* User Context */}
        <div className="flex flex-col items-center gap-1.5 mb-4">
          <div className="flex items-center gap-1.5 text-accent dark:text-accent-light">
            <ShieldCheck className="w-4 h-4" strokeWidth={2.5} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              {pinLabel}
            </span>
          </div>
          
          {/* PIN Input Display */}
          <div className="w-full h-16 rounded-2xl border-2 border-accent dark:border-accent bg-white dark:bg-neutral-900/50 flex items-center justify-center relative overflow-hidden">
            <div className="flex items-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="relative flex items-center justify-center">
                  {/* Vertical cursor line logic */}
                  {pin.length === i && (
                    <motion.div 
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute -left-2 h-8 w-[1.5px] bg-slate-900 dark:bg-white" 
                    />
                  )}
                  <div className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${pin.length > i ? 'bg-accent dark:bg-accent' : 'bg-slate-200 dark:bg-neutral-700'}`} />
                  {/* Special case: cursor at the end */}
                  {pin.length === 4 && i === 3 && (
                    <motion.div 
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute -right-2 h-8 w-[1.5px] bg-slate-900 dark:bg-white" 
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleKey(n)}
              className="h-14 rounded-2xl bg-white dark:bg-neutral-800/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-neutral-100 font-bold text-xl active:scale-95 transition-transform shadow-sm hover:bg-slate-50"
            >
              {n}
            </button>
          ))}
          
          {/* Bottom Row */}
          <button
            type="button"
            onClick={() => leftActionButton && typeof leftActionButton === 'object' && leftActionButton.props?.onClick?.()}
            className="h-14 rounded-2xl bg-accent/10 hover:bg-accent/20 dark:bg-accent/20 border border-accent dark:border-accent flex items-center justify-center text-accent dark:text-accent-light active:scale-95 transition-transform shadow-sm"
          >
            <Fingerprint className="w-6 h-6" />
          </button>
          
          <button
            type="button"
            onClick={() => handleKey(0)}
            className="h-14 rounded-2xl bg-white dark:bg-neutral-800/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-neutral-100 font-bold text-xl active:scale-95 transition-transform shadow-sm hover:bg-slate-50"
          >
            0
          </button>
          
          <button
            type="button"
            onClick={() => handleKey('del')}
            className="h-14 rounded-2xl bg-slate-100 dark:bg-neutral-800/30 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-neutral-400 active:scale-95 transition-transform shadow-sm hover:bg-slate-150"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-xs font-bold text-center mb-4 animate-shake">
            {error}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-14 rounded-2xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-neutral-300 font-bold active:scale-95 transition-all hover:bg-slate-150"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={pin.length !== 4 || isLoading}
            onClick={onConfirm}
            className="flex-1 h-14 rounded-2xl bg-accent hover:bg-accent-hover text-white font-bold shadow-lg shadow-accent/20 disabled:opacity-50 disabled:grayscale active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
