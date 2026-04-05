import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { User as UserIcon, Lock, Loader2, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { User as UserType, Language as LangType, Theme } from '../types';
import { userRowToSessionUser } from '../utils/staffPermissionDefaults';
import { getTranslations } from '../utils/translations';
import { applyUnauthenticatedDocumentTheme } from '../utils/theme';
import { PATH_TIMBRATURA, decodeProfiloAccessToken } from '../config/appPaths';
import { APP_SESSION_STORAGE_KEY } from '../constants/appSession';
import { getDeviceUiLanguage } from '../utils/uiLanguagePreference';
import {
  findUserByNameAndPinAnyStatus,
  findUserByNameAndSecondaryPin,
  findUsersMatchingName,
  getLoginNamePinFailureKind,
  pinMatchesStored,
} from '../utils/loginIdentifier';
import { useTenant } from '../context/TenantContext';
import FlowLogo from './FlowLogo';
import {
  supportsPinUnlockWebAuthn,
  registerPinUnlockCredential,
  hasAnyPinUnlockCredentialOnDevice,
  authenticatePinUnlockAndResolveUserId,
  hasPinUnlockCredential,
} from '../utils/pinUnlockWebAuthn';

interface LoginPageProps {
  onLogin: () => void;
  onBack: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const { users, setCurrentUser, setLanguage, setIsSessionElevated, featureFlags } = useApp();
  const kioskEnabled = featureFlags['kiosk_active'] !== false;
  const { tenant, loadTenantBySlug } = useTenant();
  const [searchParams] = useSearchParams();

  // Nuovo formato: ?t=<base64 JSON> con tenantSlug — retrocompatibile con vecchi ?u=&n=&p=
  const { inviteUserId, inviteNameFromUrl, invitePinFromUrl, inviteTenantSlug } = useMemo(() => {
    const tokenParam = searchParams.get('t');
    if (tokenParam) {
      const { userId, pin, tenantSlug } = decodeProfiloAccessToken(tokenParam);
      return {
        inviteUserId: userId,
        inviteNameFromUrl: '',
        invitePinFromUrl: pin,
        inviteTenantSlug: tenantSlug,
      };
    }
    const u = searchParams.get('u')?.trim() ?? '';
    const n = (searchParams.get('n') ?? '').trim();
    const rawP = searchParams.get('p') ?? '';
    const p = rawP.replace(/\D/g, '').slice(0, 4);
    return {
      inviteUserId: u,
      inviteNameFromUrl: n,
      invitePinFromUrl: p.length === 4 ? p : '',
      inviteTenantSlug: '',
    };
  }, [searchParams]);

  // Option B — carica il tenant dal token se non già caricato
  useEffect(() => {
    if (inviteTenantSlug) loadTenantBySlug(inviteTenantSlug);
  }, [inviteTenantSlug, loadTenantBySlug]);

  const linkedUser = useMemo(
    () => (inviteUserId ? users.find((u) => u.id === inviteUserId) : undefined),
    [inviteUserId, users]
  );
  const isInviteLink = Boolean(inviteUserId || inviteNameFromUrl || invitePinFromUrl);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const staffNameInputRef = useRef<HTMLInputElement>(null);
  const loginBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusedInviteRef = useRef<string | null>(null);
  /** /profilo: lingua da browser/OS (navigator.languages), non ultimo profilo in localStorage */
  const [loginLang, setLoginLang] = useState<LangType>(() => getDeviceUiLanguage());
  const t = getTranslations(loginLang);

  const [staffName, setStaffName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [deviceSuccess, setDeviceSuccess] = useState('');
  const shakeControls = useAnimation();
  useEffect(() => {
    if (!error) return;
    void shakeControls.start({
      x: [0, -11, 11, -8, 8, -5, 5, -2, 2, 0],
      transition: { duration: 0.45, ease: 'easeInOut' },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);
  const [isLoading, setIsLoading] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [linkDeviceLoading, setLinkDeviceLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  // Credenziali in attesa che il tenant carichi (fallback Option B)
  const [pendingCreds, setPendingCreds] = useState<{ name: string; pin: string } | null>(null);

  const webAuthnOk = supportsPinUnlockWebAuthn();
  const hasDeviceLogin = hasAnyPinUnlockCredentialOnDevice();

  const resolvedUser = useMemo(() => {
    const matches = findUsersMatchingName(users, staffName);
    return matches.length === 1 ? matches[0] : undefined;
  }, [users, staffName]);
  const pinMatches = !!(resolvedUser && pinMatchesStored(resolvedUser, password));
  const canShowLinkDevice = webAuthnOk && pinMatches && resolvedUser && !hasPinUnlockCredential(resolvedUser.id);
  const showDeviceSection = webAuthnOk && (hasDeviceLogin || canShowLinkDevice);

  // Auto-trigger biometric login if device has credentials
  useEffect(() => {
    if (hasDeviceLogin && !deviceLoading && !isLoading && !linkDeviceLoading && !isInviteLink) {
      void handleDeviceLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDeviceLogin]);

  useEffect(() => {
    applyUnauthenticatedDocumentTheme();
  }, []);

  useEffect(() => {
    if (!inviteUserId && !inviteNameFromUrl && !invitePinFromUrl) {
      return;
    }
    if (inviteNameFromUrl) setStaffName(inviteNameFromUrl.toUpperCase());
    else if (inviteUserId && linkedUser) {
      const nameForLogin = `${linkedUser.first_name} ${linkedUser.last_name ?? ''}`.trim();
      if (nameForLogin) setStaffName(nameForLogin.toUpperCase());
    }
    if (invitePinFromUrl) setPassword(invitePinFromUrl);
  }, [inviteUserId, inviteNameFromUrl, invitePinFromUrl, linkedUser]);

  useEffect(() => {
    if (!inviteUserId && !inviteNameFromUrl && !invitePinFromUrl) {
      lastFocusedInviteRef.current = null;
      return;
    }
    const hasNameHint =
      Boolean(inviteNameFromUrl) ||
      Boolean(
        inviteUserId &&
          linkedUser &&
          `${linkedUser.first_name} ${linkedUser.last_name ?? ''}`.trim()
      );
    const sig = `${inviteUserId}|${invitePinFromUrl}|${inviteNameFromUrl}|${linkedUser?.id ?? ''}`;
    if (lastFocusedInviteRef.current === sig) return;
    lastFocusedInviteRef.current = sig;
    requestAnimationFrame(() => {
      if (invitePinFromUrl && hasNameHint) loginBtnRef.current?.focus();
      else if (invitePinFromUrl) pinInputRef.current?.focus();
      else staffNameInputRef.current?.focus();
    });
  }, [inviteUserId, inviteNameFromUrl, invitePinFromUrl, linkedUser]);

  useEffect(() => {
    const sync = () => setLoginLang(getDeviceUiLanguage());
    window.addEventListener('languagechange', sync);
    return () => window.removeEventListener('languagechange', sync);
  }, []);

  useEffect(() => {
    document.documentElement.lang = loginLang === 'en' ? 'en' : loginLang === 'es' ? 'es' : loginLang === 'fr' ? 'fr' : 'it';
  }, [loginLang]);

  const finalizeSession = useCallback(
    (user: UserType, clearLoading: () => void) => {
      const userLang = (user.language || loginLang) as LangType;
      setLanguage(userLang);
      try {
        localStorage.setItem(
          APP_SESSION_STORAGE_KEY,
          JSON.stringify({
            userId: user.id,
            email: (user.email || '').trim().toLowerCase() || undefined,
            ...(tenant?.slug ? { tenantSlug: tenant.slug } : {}),
          })
        );
      } catch {
        /* ignore */
      }
      const safeUser = userRowToSessionUser({
        ...user,
        language: userLang,
        theme: (user.theme ?? 'light') as Theme,
      } as UserType);
      setCurrentUser(safeUser);
      setTimeout(() => {
        clearLoading();
        onLogin();
      }, 300);
    },
    [loginLang, setLanguage, setCurrentUser, onLogin, tenant?.slug]
  );

  // Retry automatico dopo caricamento tenant (fallback Option B)
  // NOTA: deve stare DOPO la dichiarazione di finalizeSession per evitare TDZ
  useEffect(() => {
    if (!pendingCreds || users.length === 0) return;
    const user = findUserByNameAndPinAnyStatus(users, pendingCreds.name, pendingCreds.pin);
    setPendingCreds(null);
    setIsLoading(false);
    if (user && user.status === 'active') {
      setError('');
      finalizeSession(user, () => {});
    } else {
      setError('PIN non corretto. Riprova.');
    }
  }, [users, pendingCreds, finalizeSession]);

  const handleLogin = useCallback(async () => {
    if (!staffName.trim() || !password.trim() || isLoading) return;
    setError('');
    setDeviceSuccess('');
    setIsLoading(true);

    const user = findUserByNameAndPinAnyStatus(users, staffName, password);

    if (!user) {
      // Controlla PIN secondario (elevazione sessione temporanea)
      const elevatedUser = findUserByNameAndSecondaryPin(users, staffName, password);
      if (elevatedUser?.elevated_role) {
        const asElevated = { ...elevatedUser, role: elevatedUser.elevated_role };
        setIsSessionElevated(true);
        finalizeSession(asElevated as UserType, () => setIsLoading(false));
        return;
      }

      // Fallback Option B: se users è vuota (nessun tenant caricato),
      // cerca globalmente per nome+PIN → carica tenant → retry automatico via useEffect
      if (users.length === 0) {
        const { supabase } = await import('../lib/supabase');
        if (!supabase) {
          setIsLoading(false);
          setError('Nessun dipendente trovato. Controlla nome e PIN.');
          setPassword('');
          requestAnimationFrame(() => pinInputRef.current?.focus());
          return;
        }
        try {
          const firstName = staffName.trim().split(/\s+/)[0];
          const { data: globalUsers } = await supabase
            .from('users')
            .select('id, first_name, last_name, pin, status, tenant_id')
            .ilike('first_name', `%${firstName}%`)
            .eq('status', 'active');

          if (globalUsers && globalUsers.length > 0) {
            // Cerca per nome completo prima, poi solo per PIN
            const nameNorm = staffName.trim().toLowerCase();
            const matched =
              globalUsers.find((u) =>
                `${u.first_name} ${u.last_name ?? ''}`.trim().toLowerCase() === nameNorm &&
                u.pin === password
              ) ??
              globalUsers.find((u) =>
                u.first_name.toLowerCase() === nameNorm &&
                u.pin === password
              ) ??
              globalUsers.find((u) => u.pin === password);

            if (matched?.tenant_id) {
              const { data: tenantData } = await supabase
                .from('tenants')
                .select('slug')
                .eq('id', matched.tenant_id)
                .maybeSingle();
              if (tenantData?.slug) {
                // Salva credenziali e carica tenant — l'useEffect farà il retry
                setPendingCreds({ name: staffName, pin: password });
                setError('');
                await loadTenantBySlug(tenantData.slug);
                // isLoading rimane true finché l'effect non completa
                return;
              }
            }
          }
        } catch {
          // ignora errori nella ricerca globale
        }
        setIsLoading(false);
        setError('Nessun dipendente trovato. Controlla nome e PIN o usa il tuo link personale.');
        setPassword('');
        requestAnimationFrame(() => pinInputRef.current?.focus());
        return;
      }

      const kind = getLoginNamePinFailureKind(users, staffName, password);
      const msg =
        kind === 'no_name_match'
          ? t.login_error_name_not_found
          : kind === 'wrong_pin'
            ? t.login_error_wrong_pin
            : kind === 'homonym_or_ambiguous'
              ? t.login_error_homonym_login
              : (t.login_invalid_credentials ?? 'Nome o PIN non corretti. Riprova.');
      setTimeout(() => {
        setIsLoading(false);
        setError(msg);
        setPassword('');
        requestAnimationFrame(() => pinInputRef.current?.focus());
      }, 600);
      return;
    }
    if (user.status !== 'active') {
      setTimeout(() => {
        setIsLoading(false);
        setError(t.login_account_not_active);
        setPassword('');
        requestAnimationFrame(() => pinInputRef.current?.focus());
      }, 600);
      return;
    }
    finalizeSession(user, () => setIsLoading(false));
  }, [staffName, password, isLoading, users, finalizeSession, t, loadTenantBySlug]);

  const handleDeviceLogin = useCallback(async () => {
    if (!webAuthnOk || deviceLoading || isLoading || linkDeviceLoading) return;
    setError('');
    setDeviceSuccess('');
    setDeviceLoading(true);
    try {
      const userId = await authenticatePinUnlockAndResolveUserId();
      if (!userId) {
        setError(t.login_device_failed);
        setDeviceLoading(false);
        return;
      }
      const user = users.find((u) => u.id === userId && u.status === 'active');
      if (!user) {
        setError(t.login_device_no_user);
        setDeviceLoading(false);
        return;
      }
      finalizeSession(user, () => setDeviceLoading(false));
    } catch {
      setError(t.login_device_failed);
      setDeviceLoading(false);
    }
  }, [webAuthnOk, deviceLoading, isLoading, linkDeviceLoading, users, finalizeSession, t]);

  const handleLinkDevice = useCallback(async () => {
    if (!webAuthnOk || !resolvedUser || !pinMatches || linkDeviceLoading || isLoading || deviceLoading) return;
    setError('');
    setDeviceSuccess('');
    setLinkDeviceLoading(true);
    try {
      const displayName =
        `${resolvedUser.first_name} ${resolvedUser.last_name ?? ''}`.trim() || resolvedUser.email;
      const ok = await registerPinUnlockCredential(resolvedUser.id, displayName, resolvedUser.email);
      if (ok) setDeviceSuccess(t.login_device_linked_ok);
      else setError(t.login_device_register_failed);
    } catch {
      setError(t.login_device_register_failed);
    } finally {
      setLinkDeviceLoading(false);
    }
  }, [webAuthnOk, resolvedUser, pinMatches, linkDeviceLoading, isLoading, deviceLoading, t]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleLogin();
    },
    [handleLogin]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="relative min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-[#0052FF]/5 flex flex-col items-center justify-center p-6 safe-area-pad font-sans antialiased text-slate-900 dark:text-neutral-100 overflow-hidden"
      style={document.documentElement.classList.contains('dark') ? { background: 'radial-gradient(circle at 50% 50%, rgba(180,210,255,0.22) 0%, transparent 18%), radial-gradient(circle at 50% 50%, #1e3a8a 0%, #0e1e60 15%, #060f30 32%, #01050f 52%, #000 72%)' } : undefined}
    >
      {/* F watermark di sfondo */}
      <div
        aria-hidden
        className="pointer-events-none select-none absolute inset-0 flex items-center justify-center"
      >
        <img
          src="/flow-f-mark.png"
          alt=""
          draggable={false}
          style={{
            width: '110vw',
            maxWidth: 860,
            minWidth: 320,
            opacity: 0.055,
            filter: 'saturate(0) brightness(0) blur(6px)',
          }}
          className="dark:opacity-[0.07] dark:[filter:saturate(0)_brightness(10)_blur(6px)]"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-lg"
      >
        <>
        {/* Logo FLOW — nascosto quando il popup è aperto */}
        <AnimatePresence>
        {!showForm && (
        <motion.div
          key="logoblock"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col items-center mb-5 sm:mb-6 min-h-[min(260px,46vh)] sm:min-h-[min(300px,50vh)] justify-center py-8 sm:py-10 gap-4"
        >
          {/* Icona grande centrata — float + illuminazione rotante + click apre form */}
          <motion.button
            type="button"
            aria-label="Apri form di accesso"
            onClick={() => setShowForm(true)}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
            whileTap={{ scale: 0.95 }}
            className="relative focus:outline-none"
            style={{ width: 220, height: 220 }}
          >
            {/* Alone diffuso pulsante */}
            <motion.div
              aria-hidden
              animate={{ opacity: [0.4, 0.75, 0.4], scale: [1, 1.15, 1] }}
              transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
              style={{
                position: 'absolute',
                inset: -28,
                borderRadius: 80,
                background: 'radial-gradient(ellipse at 50% 60%, rgba(0,82,255,0.32) 0%, rgba(0,82,255,0.10) 55%, transparent 75%)',
                filter: 'blur(16px)',
                zIndex: 0,
              }}
            />
            {/* Logo */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <FlowLogo size={220} showText={false} />
            </div>
          </motion.button>

          {/* Hint "Tocca per accedere" — sparisce quando il form è aperto */}
          <AnimatePresence>
            {!showForm && (
              <motion.p
                key="hint"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="text-[13px] font-semibold text-slate-500 dark:text-neutral-300 tracking-widest uppercase select-none"
              >
                Tocca per accedere
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
        )}
        </AnimatePresence>

        {/* Popup login — overlay centrato */}
        <AnimatePresence>
        {showForm && (
        <motion.div
          key="loginoverlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
          style={{ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', background: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
        <motion.div
          key="loginform"
          initial={{ opacity: 0, y: 32, scale: 0.93 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
        >
        <motion.div animate={shakeControls}>
        <div
          className="w-full max-w-xs space-y-2.5 p-5 relative rounded-2xl overflow-hidden"
          style={{
            minWidth: 300,
            background: 'radial-gradient(ellipse at 50% 10%, #0e5f75 0%, #003380 38%, #001055 75%, #000820 100%)',
            border: '1px solid rgba(51,102,204,0.32)',
            boxShadow: 'inset 0 2.5px 0 rgba(255,255,255,0.28), inset 0 -1.5px 0 rgba(0,0,0,0.25), inset 1px 0 0 rgba(255,255,255,0.12), inset -1px 0 0 rgba(255,255,255,0.12), 0 24px 60px rgba(0,0,0,0.6), 0 8px 24px rgba(0,26,128,0.35)',
          }}
        >
          {/* Shimmer speculare */}
          <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 28%, rgba(255,255,255,0.00) 55%, rgba(51,102,204,0.04) 100%)',
            zIndex: 0,
          }} />
          {/* Tasto chiudi */}
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="absolute top-2.5 right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors text-base leading-none"
            aria-label="Chiudi"
          >✕</button>

          <div className="mb-0 relative z-10">
            <h2 className="text-sm font-bold text-white leading-tight">
              {t.login_welcome ?? 'Bentornato'}
            </h2>
            <p className="text-[11px] text-white/55 mt-0.5 leading-snug">
              {t.login_subtitle ?? 'Accedi con le tue credenziali'}
            </p>
          </div>

          {isInviteLink && (
            <div className="relative z-10 rounded-lg px-2.5 py-2 text-xs text-white/80 space-y-1" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
              <p className="font-semibold text-white">{t.login_invite_banner}</p>
              {inviteUserId && !linkedUser && users.length > 0 && (
                <p className="text-xs text-amber-300">
                  {(t as { login_invite_user_unknown?: string }).login_invite_user_unknown}
                </p>
              )}
              {linkedUser && linkedUser.status !== 'active' && (
                <p className="text-xs text-amber-300">
                  {(t as { admin_employee_access_link_inactive?: string }).admin_employee_access_link_inactive}
                </p>
              )}
            </div>
          )}

          {/* Nome */}
          <div className="space-y-1 relative z-10">
            <label className="text-[10px] font-semibold text-white/60 uppercase tracking-wide">
              {t.login_name_label}
            </label>
            <div className="relative">
              <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" aria-hidden />
              <input
                ref={staffNameInputRef}
                type="text"
                inputMode="text"
                autoCapitalize="words"
                value={staffName}
                onChange={(e) => { setStaffName(e.target.value); setError(''); setDeviceSuccess(''); }}
                onKeyDown={handleKeyDown}
                placeholder={t.login_name_ph}
                autoComplete="name"
                autoFocus={!isInviteLink}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-white text-xs uppercase placeholder:text-[11px] placeholder:normal-case placeholder:text-white/30 focus:outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
              />
            </div>
          </div>

          {/* PIN */}
          <div className="space-y-1 relative z-10">
            <label className="text-[10px] font-semibold text-white/60 uppercase tracking-wide">
              {t.login_password_label ?? 'PIN'}
            </label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint="done"
                autoComplete="current-password"
                autoCorrect="off"
                spellCheck={false}
                value={password}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setPassword(digits);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                ref={pinInputRef}
                placeholder="••••"
                style={!showPassword ? ({ WebkitTextSecurity: 'disc', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' } as CSSProperties) : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                className="w-full pl-9 pr-9 py-2 rounded-lg text-white text-xs placeholder-white/30 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors p-0.5"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 text-red-300 text-[11px] font-medium text-center rounded-lg px-2 py-1.5 leading-snug"
              style={{ background: 'rgba(255,80,80,0.18)', border: '1px solid rgba(255,100,100,0.25)' }}
            >
              {error}
            </motion.p>
          )}

          {deviceSuccess && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 text-emerald-300 text-[11px] font-medium text-center rounded-lg px-2 py-1.5 leading-snug"
              style={{ background: 'rgba(0,200,120,0.12)', border: '1px solid rgba(0,200,120,0.22)' }}
            >
              {deviceSuccess}
            </motion.p>
          )}

          {/* Login button */}
          <button
            ref={loginBtnRef}
            type="button"
            onClick={handleLogin}
            disabled={!staffName.trim() || !password.trim() || isLoading || deviceLoading || linkDeviceLoading}
            className="relative z-10 w-full py-2 rounded-lg text-white font-semibold text-xs active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            style={{ background: 'rgba(0,82,255,0.80)', border: '1px solid rgba(100,150,255,0.35)' }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t.login_btn ?? 'Accedi'
            )}
          </button>

          {showDeviceSection && (
            <div className="space-y-2 pt-0.5 relative z-10">
              <div className="flex items-center gap-2 text-white/35 text-[10px] font-semibold uppercase tracking-wider">
                <span className="h-px flex-1 bg-white/15" aria-hidden />
                <span>{t.login_device_or}</span>
                <span className="h-px flex-1 bg-white/15" aria-hidden />
              </div>

              {hasDeviceLogin && (
                <button
                  type="button"
                  onClick={handleDeviceLogin}
                  disabled={deviceLoading || isLoading || linkDeviceLoading}
                  className="w-full py-2 rounded-lg text-white/80 font-semibold text-xs active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}
                >
                  {deviceLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Fingerprint className="w-5 h-5 shrink-0" strokeWidth={2} aria-hidden />
                  )}
                  <span className="text-center leading-tight">{t.login_device_btn}</span>
                </button>
              )}

              {canShowLinkDevice && (
                <button
                  type="button"
                  onClick={handleLinkDevice}
                  disabled={linkDeviceLoading || isLoading || deviceLoading}
                  title={t.login_device_link_title}
                  className="w-full py-2 rounded-lg text-white/60 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  {linkDeviceLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  {t.login_device_link_btn}
                </button>
              )}
            </div>
          )}
        </div>
        </motion.div>
        </motion.div>
        </motion.div>
        )}
        </AnimatePresence>

        {/* Kiosk link — nascosto se kiosk_active è false */}
        {kioskEnabled && (
          <p className="text-center text-xs text-slate-500 dark:text-neutral-300 mt-4">
            {t.login_kiosk_hint ?? 'Stai timbrando?'}{' '}
            <Link
              to={PATH_TIMBRATURA}
              className="text-[#001A80] font-semibold hover:text-[#003ACC] transition-colors"
            >
              {t.login_kiosk_link ?? 'Vai al Kiosk →'}
            </Link>
          </p>
        )}
        </>
      </motion.div>
    </motion.div>
  );
}
