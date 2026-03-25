import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Delete, Lock, Fingerprint, Smartphone, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations, formatTrans } from '../utils/translations';
import { supportsPinUnlockWebAuthn } from '../utils/pinUnlockWebAuthn';

export default function RefreshLockOverlay() {
  const {
    currentUser,
    unlockAfterRefresh,
    unlockAfterRefreshWithDevice,
    registerPinUnlockDevice,
    pinUnlockDeviceRegistered,
    cancelRefreshLock,
    pendingOrderIds,
    pendingPublishWeekStart,
    effectiveLanguage,
    showSuccess,
  } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceUnlockLoading, setDeviceUnlockLoading] = useState(false);
  const [linkDeviceLoading, setLinkDeviceLoading] = useState(false);
  const t = getTranslations(effectiveLanguage);
  const tv = t as Record<string, string>;
  const webAuthnSupported = supportsPinUnlockWebAuthn();

  const profileDisplayName = useMemo(() => {
    if (!currentUser) return '';
    const fn = (currentUser.first_name ?? '').trim();
    const ln = (currentUser.last_name ?? '').trim();
    const full = [fn, ln].filter(Boolean).join(' ').trim();
    return full || currentUser.email?.split('@')[0] || currentUser.email || '—';
  }, [currentUser]);

  const pinProfileLabel = formatTrans(tv.pin_for_profile_named ?? t.pin_for_profile, {
    name: profileDisplayName,
  });

  const message = pendingPublishWeekStart
    ? t.publish_pin_prompt
    : pendingOrderIds?.length
      ? t.changes_pin_prompt
      : t.sync_complete_pin_prompt;

  const handleUnlock = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    setError('');
    try {
      const ok = await unlockAfterRefresh(pin);
      if (ok) {
        setPin('');
      } else {
        setError(t.sync_lock_wrong_pin);
        setPin('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    cancelRefreshLock();
    setPin('');
    setError('');
  };

  const handleKey = (n: number | 'del' | null) => {
    if (n === null || n === undefined) return;
    if (n === 'del') {
      setPin((p) => p.slice(0, -1));
      setError('');
    } else if (typeof n === 'number' && pin.length < 4) {
      setPin((p) => p + String(n));
      setError('');
    }
  };

  const handleDeviceUnlock = async () => {
    setDeviceUnlockLoading(true);
    setError('');
    try {
      const ok = await unlockAfterRefreshWithDevice();
      if (!ok) setError(t.sync_lock_device_failed);
    } finally {
      setDeviceUnlockLoading(false);
    }
  };

  const handleLinkDevice = async () => {
    if (pin.length !== 4) {
      setError(t.sync_lock_link_need_pin);
      return;
    }
    setLinkDeviceLoading(true);
    setError('');
    try {
      const r = await registerPinUnlockDevice(pin);
      if (r.wrongPin) {
        setError(t.sync_lock_wrong_pin);
        setPin('');
      } else if (r.ok) {
        showSuccess(t.sync_lock_device_linked);
      } else {
        setError(t.sync_lock_device_register_failed);
      }
    } finally {
      setLinkDeviceLoading(false);
    }
  };

  const busy = loading || deviceUnlockLoading || linkDeviceLoading;

  if (!currentUser) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-3 sm:px-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="modal-glass-panel w-full max-w-sm rounded-2xl p-4 sm:p-6"
      >
        <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
          <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-accent flex-shrink-0" strokeWidth={2} />
          <span className="text-slate-900 dark:text-neutral-100 font-semibold uppercase tracking-wider text-xs sm:text-sm">
            {t.sync_lock_title}
          </span>
        </div>

        <p className="text-slate-600 dark:text-neutral-300 text-center text-sm sm:text-base mb-4 sm:mb-6 font-sans px-1 leading-snug">
          {message}
        </p>

        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.length === 4 && !busy) void handleUnlock();
          }}
        >
        <div className="flex flex-col items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="flex max-w-full flex-col items-center gap-1 text-slate-500 dark:text-neutral-300 sm:flex-row sm:gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-accent sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
            <span className="text-center text-xs font-semibold leading-snug tracking-wide sm:text-left">
              {pinProfileLabel}
            </span>
          </div>
          <input
            type="password"
            name="pin"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => (setPin(e.target.value.replace(/\D/g, '').slice(0, 4)), setError(''))}
            autoFocus
            autoComplete="current-password"
            className="w-full px-4 sm:px-5 py-3.5 sm:py-4 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:ring-2 focus:ring-accent/40 focus:border-accent outline-none font-semibold text-2xl sm:text-3xl text-center tracking-[0.35em] sm:tracking-[0.4em] text-slate-900 min-h-[52px] placeholder:text-slate-400"
            placeholder="••••"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mb-3 sm:mb-4 w-full mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((n, idx) =>
            n === null ? (
              webAuthnSupported ? (
                pinUnlockDeviceRegistered ? (
                  <motion.button
                    key={`device-${idx}`}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={handleDeviceUnlock}
                    disabled={busy}
                    title={t.sync_lock_device_unlock_title}
                    aria-label={t.sync_lock_device_aria}
                    className="h-14 sm:h-[3.75rem] min-h-[52px] w-full rounded-xl sm:rounded-2xl flex items-center justify-center border border-accent/40 bg-accent/10 text-accent hover:bg-accent/15 active:bg-accent/20 disabled:opacity-50 transition-colors touch-manipulation"
                  >
                    {deviceUnlockLoading ? (
                      <Loader2 className="w-7 h-7 animate-spin" strokeWidth={2} aria-hidden />
                    ) : (
                      <Fingerprint className="w-7 h-7" strokeWidth={2} aria-hidden />
                    )}
                  </motion.button>
                ) : (
                  <motion.button
                    key={`link-${idx}`}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={handleLinkDevice}
                    disabled={busy}
                    title={t.sync_lock_link_device_title}
                    aria-label={t.sync_lock_link_device_title}
                    className="h-14 sm:h-[3.75rem] min-h-[52px] w-full rounded-xl sm:rounded-2xl flex flex-col items-center justify-center gap-0.5 border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-neutral-800 text-slate-700 dark:text-neutral-100 hover:bg-slate-100 dark:hover:bg-neutral-700 active:bg-slate-200 dark:active:bg-neutral-600 disabled:opacity-50 transition-colors touch-manipulation px-1"
                  >
                    {linkDeviceLoading ? (
                      <Loader2 className="w-6 h-6 animate-spin shrink-0" strokeWidth={2} aria-hidden />
                    ) : (
                      <Smartphone className="w-5 h-5 shrink-0 text-accent" strokeWidth={2} aria-hidden />
                    )}
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight leading-none text-center text-slate-800 dark:text-neutral-100">
                      {t.sync_lock_link_device}
                    </span>
                  </motion.button>
                )
              ) : (
                <div key={`spacer-${idx}`} className="h-14 sm:h-[3.75rem] min-h-[52px]" aria-hidden />
              )
            ) : (
              <motion.button
                key={idx}
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => handleKey(n as number | 'del')}
                disabled={(typeof n === 'number' && pin.length >= 4) || busy}
                className={`h-14 sm:h-[3.75rem] min-h-[52px] w-full rounded-xl sm:rounded-2xl flex items-center justify-center font-semibold text-xl sm:text-2xl tabular-nums transition-colors font-sans border touch-manipulation ${
                  n === 'del'
                    ? 'bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-neutral-100 border-slate-200 dark:border-white/15 hover:bg-slate-200 dark:hover:bg-neutral-700 active:bg-slate-300 dark:active:bg-neutral-600'
                    : 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 border-slate-200 dark:border-white/15 hover:bg-slate-50 dark:hover:bg-neutral-700 active:bg-slate-100 dark:active:bg-neutral-600 disabled:opacity-50'
                }`}
              >
                {n === 'del' ? (
                  <Delete className="w-6 h-6 text-slate-600 dark:text-neutral-200" strokeWidth={2} />
                ) : (
                  n
                )}
              </motion.button>
            )
          )}
        </div>

        {error && (
          <p className="text-red-600 dark:text-red-400 text-xs sm:text-sm font-medium text-center mb-2 sm:mb-3">{error}</p>
        )}

        <div className="flex gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 min-h-[48px] py-3 sm:py-3.5 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-white/15 text-slate-800 dark:text-neutral-100 font-semibold hover:bg-slate-200 dark:hover:bg-neutral-700 active:bg-slate-300 dark:active:bg-neutral-600 transition-colors touch-target"
          >
            {t.sync_lock_cancel}
          </button>
          <button
            type="submit"
            disabled={pin.length !== 4 || busy}
            className="flex-1 min-h-[48px] py-3 sm:py-3.5 rounded-xl bg-accent text-white font-semibold shadow-sm shadow-black/20 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed active:brightness-95 transition-colors touch-target"
          >
            {loading ? '...' : t.confirm}
          </button>
        </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
