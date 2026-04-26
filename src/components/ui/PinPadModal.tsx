import { motion } from 'framer-motion';
import { Lock, ShieldCheck, Delete, Fingerprint, Loader2, Smartphone } from 'lucide-react';
import React, { ReactNode, useEffect, useState, useCallback } from 'react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useT } from '../../hooks/useT';
import {
  supportsPinUnlockWebAuthn,
  hasPinUnlockCredential,
  authenticatePinUnlockCredential,
  registerPinUnlockCredential,
  hasPlatformBiometricAuthenticator,
} from '../../utils/pinUnlockWebAuthn';

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
  /** ID utente per biometrica interna (usato solo se leftActionButton non è fornito) */
  userId?: string;
  /** Nome visualizzato per la registrazione biometrica */
  userDisplayName?: string;
  /** Email per la registrazione biometrica */
  userEmail?: string;
  /** Chiamato quando l'autenticazione biometrica riesce. Se assente, viene chiamato onConfirm() direttamente. */
  onBiometricSuccess?: () => void | Promise<void>;
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
  confirmLabel,
  cancelLabel,
  leftActionButton,
  backdropClass,
  userId,
  userDisplayName,
  userEmail,
  onBiometricSuccess,
}: PinPadModalProps) {
  const t = useT();
  const confirmText = confirmLabel ?? t.confirm;
  const cancelText = cancelLabel ?? t.cancel;
  useBodyScrollLock(true);

  // ── Biometrica interna (solo se leftActionButton non è fornito) ─────────────
  const [hasBiometric, setHasBiometric] = useState(false);
  useEffect(() => {
    if (!leftActionButton && !!userId && supportsPinUnlockWebAuthn()) {
      hasPlatformBiometricAuthenticator().then(setHasBiometric);
    }
  }, [leftActionButton, userId]);
  const webAuthnOk = !leftActionButton && !!userId && hasBiometric;
  const credRegistered = webAuthnOk && hasPinUnlockCredential(userId!);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioRegLoading, setBioRegLoading] = useState(false);

  const handleBiometric = useCallback(async () => {
    if (!userId || bioLoading || isLoading) return;
    setBioLoading(true);
    try {
      const ok = await authenticatePinUnlockCredential(userId);
      if (ok) {
        if (onBiometricSuccess) await onBiometricSuccess();
        else onConfirm();
      }
    } finally {
      setBioLoading(false);
    }
  }, [userId, bioLoading, isLoading, onBiometricSuccess, onConfirm]);

  const handleBioRegister = useCallback(async () => {
    if (!userId || bioRegLoading) return;
    setBioRegLoading(true);
    try {
      await registerPinUnlockCredential(
        userId,
        userDisplayName ?? userId,
        userEmail ?? '',
      );
    } finally {
      setBioRegLoading(false);
    }
  }, [userId, bioRegLoading, userDisplayName, userEmail]);

  // Auto-trigger biometrica al mount se credenziale già registrata
  useEffect(() => {
    if (credRegistered && !bioLoading) void handleBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ────────────────────────────────────────────────────────────────────────────

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

  const BG = 'transparent';
  const border = '1px solid rgba(255,255,255,0.30)';
  const btnBase = { background: 'transparent', border } as React.CSSProperties;

  /* ── Contenuto condiviso mobile/desktop ─────────────────────────── */
  const content = (
    <>
      {/* Header */}
      <div className="flex flex-col items-center text-center pt-12 sm:pt-6 pb-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4" style={btnBase}>
          <Lock className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
        <h2 className="text-white font-bold uppercase tracking-widest text-base mb-1">{title}</h2>
        <p className="text-white/40 text-sm font-medium leading-tight px-4">{subtitle}</p>
      </div>

      {/* PIN display */}
      <div className="flex flex-col items-center gap-2 px-8 mt-4">
        <div className="flex items-center gap-1.5 text-white/50 mb-1">
          <ShieldCheck className="w-4 h-4" strokeWidth={2.5} />
          <span className="text-[11px] font-bold uppercase tracking-widest">{pinLabel}</span>
        </div>
        <div className="w-full h-14 rounded-2xl flex items-center justify-center relative"
          style={{ background: 'transparent', border: '1.5px solid rgba(255,255,255,0.30)' }}>
          <div className="flex items-center gap-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="relative flex items-center justify-center">
                {filledCount === i && (
                  <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}
                    className="absolute -left-3 h-8 w-[2px] rounded-full bg-white/60" />
                )}
                <motion.div
                  animate={filledCount > i ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                  transition={{ duration: 0.18 }}
                  className="w-4 h-4 rounded-full transition-colors duration-200"
                  style={filledCount > i
                    ? { background: 'rgba(255,255,255,0.90)', boxShadow: '0 0 8px 2px rgba(255,255,255,0.50)' }
                    : { background: 'rgba(255,255,255,0.25)' }}
                />
                {filledCount === 4 && i === 3 && (
                  <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}
                    className="absolute -right-3 h-8 w-[2px] rounded-full bg-white/60" />
                )}
              </div>
            ))}
          </div>
        </div>
        {error && <p className="text-red-400 text-xs font-bold text-center animate-shake">{error}</p>}
      </div>

      {/* Numpad */}
      <div className="flex-1 flex flex-col justify-center px-8 mt-4 sm:flex-none">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button key={n} type="button" onClick={() => handleKey(n)}
              className="h-14 rounded-2xl font-bold text-2xl text-white active:scale-95 transition-all"
              style={btnBase}>{n}</button>
          ))}
          {leftActionButton ? (
            <div className="h-14 rounded-2xl flex items-center justify-center" style={btnBase}>{leftActionButton}</div>
          ) : webAuthnOk ? (
            credRegistered ? (
              <button type="button" onClick={handleBiometric} disabled={bioLoading || isLoading}
                className="h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-white/70 active:scale-95 transition-all disabled:opacity-50"
                style={btnBase} title="Usa impronta digitale">
                {bioLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Fingerprint className="w-6 h-6" />}
              </button>
            ) : (
              <button type="button" onClick={handleBioRegister} disabled={bioRegLoading || isLoading}
                className="h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-white/40 hover:text-white/70 active:scale-95 transition-all"
                style={btnBase} title="Collega impronta digitale">
                {bioRegLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Smartphone style={{ width: '1.25rem', height: '1.25rem' }} />}
                <span className="text-[7px] font-black uppercase tracking-tighter leading-none">Collega</span>
              </button>
            )
          ) : (
            <div className="h-14 rounded-2xl flex items-center justify-center opacity-30" style={btnBase}>
              <Fingerprint className="w-6 h-6 text-white/40" />
            </div>
          )}
          <button type="button" onClick={() => handleKey(0)}
            className="h-14 rounded-2xl font-bold text-2xl text-white active:scale-95 transition-all"
            style={btnBase}>0</button>
          <button type="button" onClick={() => handleKey('del')}
            className="h-14 rounded-2xl flex items-center justify-center text-white/50 hover:text-white active:scale-95 transition-all"
            style={btnBase}>
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 px-8 pb-10 sm:pb-6 mt-4">
        <button type="button" onClick={onCancel}
          className="flex-1 h-14 rounded-2xl font-bold text-sm text-white/60 hover:text-white active:scale-95 transition-all"
          style={btnBase}>{cancelText}</button>
        <button type="button" disabled={pin.length !== 4 || isLoading} onClick={onConfirm}
          className="flex-1 h-14 rounded-2xl text-white font-bold text-sm disabled:opacity-35 active:scale-95 transition-all flex items-center justify-center gap-2"
          style={btnBase}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmText}
        </button>
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-[500] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: BG, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Card centrata — mobile e desktop */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.9 }}
        className="flex flex-col w-full max-w-[340px] mx-4 rounded-3xl overflow-hidden"
        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.28)', boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(11,53,115,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        {content}
      </motion.div>
    </motion.div>
  );
}
