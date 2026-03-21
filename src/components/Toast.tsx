import { useEffect } from 'react';
import { motion } from 'framer-motion';

interface ToastProps {
  message: string;
  type?: 'error' | 'success' | 'info';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'error', onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  const glassStyles = type === 'error'
    ? 'bg-red-500/20 dark:bg-red-500/30 text-red-700 dark:text-red-300 border-red-200/50 dark:border-red-500/30'
    : type === 'success'
      ? 'bg-accent/12 dark:bg-accent/22 text-slate-800 dark:text-accent-light/95 border-accent/28 dark:border-accent/40'
      : 'bg-slate-500/20 dark:bg-slate-500/30 text-slate-800 dark:text-slate-200 border-slate-300/50 dark:border-slate-500/30';

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
      className={`fixed left-1/2 -translate-x-1/2 z-[200] w-[min(calc(100vw-2rem),28rem)] backdrop-blur-xl border px-5 py-3 rounded-2xl shadow-[0_4px_24px_-4px_rgba(45,90,39,0.12),0_8px_24px_-8px_rgba(15,23,42,0.1)] font-medium text-sm text-center ${glassStyles} bottom-[max(1.25rem,env(safe-area-inset-bottom,0px)+0.75rem)]`}
    >
      {message}
    </motion.div>
  );
}
