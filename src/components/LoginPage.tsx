import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User as UserIcon, Lock, Loader2, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { User as UserType, Language as LangType, Theme } from '../types';
import { userRowToSessionUser } from '../utils/staffPermissionDefaults';
import { getTranslations } from '../utils/translations';
import { applyUnauthenticatedDocumentTheme } from '../utils/theme';
import { PATH_TIMBRATURA } from '../config/appPaths';
import { APP_SESSION_STORAGE_KEY } from '../constants/appSession';
import { getDeviceUiLanguage } from '../utils/uiLanguagePreference';
import {
  findUserByNameAndPinAnyStatus,
  findUserByNameAndSecondaryPin,
  findUsersMatchingName,
  getLoginNamePinFailureKind,
  pinMatchesStored,
} from '../utils/loginIdentifier';
import { useTenant, generateTenantLogoSvg } from '../context/TenantContext';
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
  const { users, setCurrentUser, setLanguage, setIsSessionElevated } = useApp();
  const { tenant } = useTenant();
  const tenantName = tenant?.name ?? 'Osteria Basilico';
  const tenantAccent = tenant?.accent_color ?? 'var(--brand)';
  const logoSrc = tenant?.logo_url ?? generateTenantLogoSvg(tenantName, tenantAccent);
  const [searchParams] = useSearchParams();
  const inviteUserId = searchParams.get('u')?.trim() ?? '';
  const inviteNameFromUrl = (searchParams.get('n') ?? '').trim();
  const invitePinFromUrl = useMemo(() => {
    const raw = searchParams.get('p') ?? '';
    const d = raw.replace(/\D/g, '').slice(0, 4);
    return d.length === 4 ? d : '';
  }, [searchParams]);
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
  const [isLoading, setIsLoading] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [linkDeviceLoading, setLinkDeviceLoading] = useState(false);

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
    [loginLang, setLanguage, setCurrentUser, onLogin]
  );

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
      }, 600);
      return;
    }
    if (user.status !== 'active') {
      setTimeout(() => {
        setIsLoading(false);
        setError(t.login_account_not_active);
      }, 600);
      return;
    }
    finalizeSession(user, () => setIsLoading(false));
  }, [staffName, password, isLoading, users, finalizeSession, t]);

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
      className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-accent/5 dark:from-[#0a0a0a] dark:via-neutral-950 dark:to-accent/[0.07] flex flex-col items-center justify-center p-6 safe-area-pad font-sans antialiased text-slate-900 dark:text-neutral-100"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-lg"
      >
        {/* Logo — protagonista visivo: più spazio e tipografia grande */}
        <div className="flex flex-col items-center mb-5 sm:mb-6 min-h-[min(260px,46vh)] sm:min-h-[min(300px,50vh)] justify-center py-8 sm:py-10">
          <div className="w-[7.25rem] h-[7.25rem] sm:w-32 sm:h-32 mb-7 sm:mb-8 drop-shadow-2xl">
            <img src={logoSrc} alt={tenantName} className="w-full h-full" />
          </div>
          <h1 className="font-logo-snell text-[49px] leading-none text-accent dark:text-white tracking-tight mb-3 sm:mb-4 text-center px-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.12)] dark:drop-shadow-none dark:[text-shadow:none]">
            {tenantName}
          </h1>
          <p className="text-slate-500 dark:text-neutral-200 text-xs font-medium text-center px-3 max-w-md">
            {t.header_tagline ?? 'Staff Management'}
          </p>
        </div>

        {/* Scheda login — compatta e più stretta del blocco superiore */}
        <div className="surface-glass-sm mx-auto w-full max-w-[17.5rem] space-y-2.5 p-3 sm:max-w-xs sm:p-3.5">

          <div className="mb-0">
            <h2 className="text-sm font-bold text-slate-800 dark:text-neutral-100 leading-tight">
              {t.login_welcome ?? 'Bentornato'}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-neutral-200 mt-0.5 leading-snug">
              {t.login_subtitle ?? 'Accedi con le tue credenziali'}
            </p>
          </div>

          {isInviteLink && (
            <div className="rounded-lg border border-accent/25 dark:border-accent/35 bg-accent/5 dark:bg-accent/10 px-2.5 py-2 text-xs text-slate-700 dark:text-neutral-200 space-y-1">
              <p className="font-semibold text-slate-800 dark:text-neutral-100">{t.login_invite_banner}</p>
              {inviteUserId && !linkedUser && users.length > 0 && (
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {(t as { login_invite_user_unknown?: string }).login_invite_user_unknown}
                </p>
              )}
              {linkedUser && linkedUser.status !== 'active' && (
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {(t as { admin_employee_access_link_inactive?: string }).admin_employee_access_link_inactive}
                </p>
              )}
            </div>
          )}

          {/* Nome */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-600 dark:text-neutral-400 uppercase tracking-wide">
              {t.login_name_label}
            </label>
            <div className="relative">
              <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-neutral-400" aria-hidden />
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
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-neutral-900 text-slate-800 dark:text-neutral-100 text-xs uppercase placeholder:text-[11px] placeholder:normal-case placeholder:text-slate-500 dark:placeholder:text-neutral-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/35 focus:shadow-[0_0_0_3px_rgba(45,90,39,0.2)] dark:focus:border-accent-light dark:focus:ring-accent-light/40 dark:focus:shadow-[0_0_0_3px_rgba(208,222,206,0.22),0_0_14px_rgba(208,222,206,0.15)] transition-all"
              />
            </div>
          </div>

          {/* PIN */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-600 dark:text-neutral-400 uppercase tracking-wide">
              {t.login_password_label ?? 'Password'}
            </label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-neutral-400" />
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
                style={!showPassword ? ({ WebkitTextSecurity: 'disc' } as CSSProperties) : undefined}
                className="w-full pl-9 pr-9 py-2 rounded-lg border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-neutral-900 text-slate-800 dark:text-neutral-100 text-xs placeholder-slate-500 dark:placeholder:text-neutral-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/35 focus:shadow-[0_0_0_3px_rgba(45,90,39,0.2)] dark:focus:border-accent-light dark:focus:ring-accent-light/40 dark:focus:shadow-[0_0_0_3px_rgba(208,222,206,0.22),0_0_14px_rgba(208,222,206,0.15)] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-400 hover:text-slate-600 dark:hover:text-neutral-200 transition-colors p-0.5"
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
              className="text-red-600 dark:text-red-400 text-[11px] font-medium text-center bg-red-50 dark:bg-red-950/40 rounded-lg px-2 py-1.5 leading-snug"
            >
              {error}
            </motion.p>
          )}

          {deviceSuccess && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-accent text-[11px] font-medium text-center bg-accent/10 dark:bg-accent/15 rounded-lg px-2 py-1.5 border border-accent/20 dark:border-accent/30 leading-snug"
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
            className="w-full py-2 rounded-lg bg-accent text-white font-semibold text-xs hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t.login_btn ?? 'Accedi'
            )}
          </button>

          {showDeviceSection && (
            <div className="space-y-2 pt-0.5">
              <div className="flex items-center gap-2 text-slate-400 dark:text-neutral-400 text-[10px] font-semibold uppercase tracking-wider">
                <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" aria-hidden />
                <span>{t.login_device_or}</span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" aria-hidden />
              </div>

              {hasDeviceLogin && (
                <button
                  type="button"
                  onClick={handleDeviceLogin}
                  disabled={deviceLoading || isLoading || linkDeviceLoading}
                  className="w-full py-2 rounded-lg border-2 border-accent/35 bg-accent/5 text-accent font-semibold text-xs hover:bg-accent/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  className="w-full py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

        {/* Kiosk link */}
        <p className="text-center text-xs text-slate-500 dark:text-neutral-300 mt-4">
          {t.login_kiosk_hint ?? 'Stai timbrando?'}{' '}
          <Link
            to={PATH_TIMBRATURA}
            className="text-accent font-semibold hover:text-accent-hover transition-colors"
          >
            {t.login_kiosk_link ?? 'Vai al Kiosk →'}
          </Link>
        </p>
      </motion.div>
    </motion.div>
  );
}
