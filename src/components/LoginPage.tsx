import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { User as UserIcon, Lock, Loader2, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { User as UserType, Language as LangType, Theme } from '../types';
import { userRowToSessionUser } from '../utils/staffPermissionDefaults';
import { getTranslations } from '../utils/translations';
import { applyUnauthenticatedDocumentTheme } from '../utils/theme';
import { decodeProfiloAccessToken } from '../config/appPaths';
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
import FlowWaveIcon from './ui/FlowWaveIcon';
import {
  supportsPinUnlockWebAuthn,
  registerPinUnlockCredential,
  hasAnyPinUnlockCredentialOnDevice,
  authenticatePinUnlockAndResolveUserId,
  hasPinUnlockCredential,
  hasPlatformBiometricAuthenticator,
} from '../utils/pinUnlockWebAuthn';

interface LoginPageProps {
  onLogin: () => void;
  onBack: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const { users, setCurrentUser, setLanguage, setIsSessionElevated, featureFlags } = useApp();
  const _kioskEnabled = featureFlags['kiosk_active'] !== false;
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

  // true solo se il dispositivo ha biometria integrata (Face ID / Touch ID / Windows Hello)
  const [hasBiometric, setHasBiometric] = useState(false);
  useEffect(() => {
    hasPlatformBiometricAuthenticator().then(setHasBiometric);
  }, []);

  const resolvedUser = useMemo(() => {
    const matches = findUsersMatchingName(users, staffName);
    return matches.length === 1 ? matches[0] : undefined;
  }, [users, staffName]);
  const pinMatches = !!(resolvedUser && pinMatchesStored(resolvedUser, password));
  const canShowLinkDevice = webAuthnOk && hasBiometric && pinMatches && resolvedUser && !hasPinUnlockCredential(resolvedUser.id);
  const showDeviceSection = webAuthnOk && hasBiometric && (hasDeviceLogin || canShowLinkDevice);

  useEffect(() => {
    applyUnauthenticatedDocumentTheme();
    // La pagina di login usa sempre il design dark (come da preview).
    document.documentElement.classList.add('dark');
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
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => { if (!showForm) setShowForm(true); }}
      className="fixed inset-0 z-20 w-full flex flex-col items-center justify-center p-6 safe-area-pad font-sans antialiased text-neutral-100 overflow-hidden"
      style={{
        backgroundColor: '#1a355d',
        backgroundImage: 'linear-gradient(160deg, rgba(5, 14, 60, 0.18) 0%, rgba(5, 14, 60, 0.40) 100%), url(/background-wave.png)',
        backgroundAttachment: 'scroll',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center center',
        backgroundSize: 'cover',
        bottom: '-60px',
      }}
    >
      {/* F watermark di sfondo */}
      <div
        aria-hidden
        className="pointer-events-none select-none absolute inset-0 flex items-center justify-center"
      >
        <img
          src="/icon-flow-final.png"
          alt=""
          draggable={false}
          style={{
            width: '110vw',
            maxWidth: 860,
            minWidth: 320,
            opacity: 0.055,
            filter: 'saturate(0) brightness(0) blur(6px)',
          }}
        />
      </div>

      <div className="w-full max-w-lg flex flex-col items-center">
        <>
        {/* Schermata iniziale — identica al boot screen AppProvider */}
        {!showForm && (
        <div
          className="relative flex flex-col items-center select-none"
          onPointerDown={() => { if (!showForm) setShowForm(true); }}
        >
          <button
            type="button"
            aria-label="Apri form di accesso"
            onClick={() => setShowForm(true)}
            onPointerDown={() => { if (!showForm) setShowForm(true); }}
            className="focus:outline-none cursor-pointer touch-manipulation [-webkit-tap-highlight-color:transparent]"
          >
            {/*
              pointer-events-none sui figli: iOS a volte non sintetizza il click se il target è div/SVG/motion sotto al button
            */}
            <span className="pointer-events-none inline-flex" aria-hidden>
            <motion.div
              animate={{ boxShadow: [
                '0 0 18px rgba(0,82,255,0.55), 0 0 6px rgba(34,211,238,0.35)',
                '0 0 36px rgba(0,82,255,0.90), 0 0 14px rgba(34,211,238,0.60)',
                '0 0 18px rgba(0,82,255,0.55), 0 0 6px rgba(34,211,238,0.35)',
              ]}}
              transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
              style={{ borderRadius: 28 }}
            >
              <FlowWaveIcon size={112} radius={28} />
            </motion.div>
            </span>
          </button>
          <motion.p
            className="mt-8 text-[11px] font-semibold tracking-[0.25em] uppercase select-none pointer-events-none"
            style={{ color: 'rgba(255,255,255,0.75)' }}
            animate={{ opacity: [0.65, 1, 0.65] }}
            transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
          >
            Tap to start
          </motion.p>
        </div>
        )}

        {/* Popup login — overlay centrato */}
        {/* Form stato — schermata intera, stile preview */}
        <AnimatePresence>
        {showForm && (
        <motion.div
          key="loginscreen"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full flex flex-col items-center"
        >
          {/* Logo + brand */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              animate={{ boxShadow: [
                '0 0 14px rgba(0,82,255,0.50), 0 0 5px rgba(34,211,238,0.30)',
                '0 0 28px rgba(0,82,255,0.80), 0 0 12px rgba(34,211,238,0.50)',
                '0 0 14px rgba(0,82,255,0.50), 0 0 5px rgba(34,211,238,0.30)',
              ]}}
              transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
              style={{ borderRadius: 26 }}
            >
              <FlowWaveIcon size={96} radius={26} />
            </motion.div>
          </div>

          {/* Form fields */}
          <motion.div animate={shakeControls} className="w-full max-w-[272px] space-y-3">

            {/* Invite banner */}
            {isInviteLink && (
              <div className="rounded-xl px-3 py-2.5 text-xs text-white/80 space-y-1" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
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

            {/* Nome utente */}
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" aria-hidden />
              <input
                ref={staffNameInputRef}
                type="text"
                inputMode="text"
                autoCapitalize="words"
                value={staffName}
                onChange={(e) => { setStaffName(e.target.value); setError(''); setDeviceSuccess(''); }}
                onKeyDown={handleKeyDown}
                placeholder={t.login_name_ph ?? 'Nome utente'}
                autoComplete="name"
                autoFocus={!isInviteLink}
                className="w-full pl-10 pr-4 py-3.5 rounded-2xl text-white text-sm uppercase placeholder:normal-case placeholder:text-white/35 placeholder:text-sm focus:outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.10)' }}
              />
            </div>

            {/* Password / PIN */}
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" aria-hidden />
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
                placeholder={t.login_password_label ?? 'Password'}
                style={!showPassword
                  ? ({ WebkitTextSecurity: 'disc', background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.10)' } as CSSProperties)
                  : { background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.10)' }}
                className="w-full pl-10 pr-10 py-3.5 rounded-2xl text-white text-sm placeholder:text-white/35 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-300 text-xs font-medium text-center rounded-xl px-3 py-2 leading-snug"
                style={{ background: 'rgba(255,80,80,0.16)', border: '1px solid rgba(255,100,100,0.22)' }}
              >
                {error}
              </motion.p>
            )}

            {deviceSuccess && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-emerald-300 text-xs font-medium text-center rounded-xl px-3 py-2 leading-snug"
                style={{ background: 'rgba(0,200,120,0.12)', border: '1px solid rgba(0,200,120,0.22)' }}
              >
                {deviceSuccess}
              </motion.p>
            )}

            {/* Accedi */}
            <button
              ref={loginBtnRef}
              type="button"
              onClick={handleLogin}
              disabled={!staffName.trim() || !password.trim() || isLoading || deviceLoading || linkDeviceLoading}
              className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40"
              style={{ background: '#0052FF', border: '1px solid rgba(120,170,255,0.28)' }}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span aria-hidden className="text-base leading-none">→</span>
                  <span>{t.login_btn ?? 'Accedi'}</span>
                </>
              )}
            </button>

            {/* Sezione biometrico */}
            {showDeviceSection && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2 text-white/30 text-[11px]">
                  <span className="h-px flex-1 bg-white/12" aria-hidden />
                  <span>{t.login_device_or ?? 'oppure'}</span>
                  <span className="h-px flex-1 bg-white/12" aria-hidden />
                </div>

                {hasDeviceLogin && (
                  <button
                    type="button"
                    onClick={handleDeviceLogin}
                    disabled={deviceLoading || isLoading || linkDeviceLoading}
                    className="w-full py-3.5 rounded-2xl text-white/75 font-medium text-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.11)' }}
                  >
                    {deviceLoading ? (
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    ) : (
                      <Fingerprint className="w-4.5 h-4.5 shrink-0" strokeWidth={1.75} aria-hidden />
                    )}
                    <span>{t.login_device_btn}</span>
                  </button>
                )}

                {canShowLinkDevice && (
                  <button
                    type="button"
                    onClick={handleLinkDevice}
                    disabled={linkDeviceLoading || isLoading || deviceLoading}
                    title={t.login_device_link_title}
                    className="w-full py-2.5 rounded-xl text-white/45 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {linkDeviceLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {t.login_device_link_btn}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
        )}
        </AnimatePresence>

        {/* Kiosk link rimosso — la timbratura avviene via QR Code */}
        </>
      </div>
    </motion.div>
  );
}
