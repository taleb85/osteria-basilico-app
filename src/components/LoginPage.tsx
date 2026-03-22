import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User as UserIcon, Lock, Loader2, Eye, EyeOff, Clock, Fingerprint } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { User as UserType, Language as LangType, Theme } from '../types';
import { userRowToSessionUser } from '../utils/staffPermissionDefaults';
import { getTranslations } from '../utils/translations';
import { forceLightTheme } from '../utils/theme';
import { PATH_TIMBRATURA } from '../config/appPaths';
import { APP_SESSION_STORAGE_KEY } from '../constants/appSession';
import { getDeviceUiLanguage } from '../utils/uiLanguagePreference';
import { findUserByNameAndPin, findUsersMatchingName, pinMatchesStored } from '../utils/loginIdentifier';
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
  const { users, setCurrentUser, setLanguage } = useApp();
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

  useEffect(() => {
    forceLightTheme();
  }, []);

  useEffect(() => {
    if (!inviteUserId && !inviteNameFromUrl && !invitePinFromUrl) {
      return;
    }
    if (inviteNameFromUrl) setStaffName(inviteNameFromUrl);
    else if (inviteUserId && linkedUser) {
      const nameForLogin = `${linkedUser.first_name} ${linkedUser.last_name ?? ''}`.trim();
      if (nameForLogin) setStaffName(nameForLogin);
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
        localStorage.setItem(APP_SESSION_STORAGE_KEY, JSON.stringify({ userId: user.id }));
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

    const user = findUserByNameAndPin(users, staffName, password);

    if (user) {
      finalizeSession(user, () => setIsLoading(false));
    } else {
      setTimeout(() => {
        setIsLoading(false);
        setError(t.login_invalid_credentials ?? 'Nome o PIN non corretti. Riprova.');
      }, 600);
    }
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
      className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-accent/5 flex flex-col items-center justify-center p-6 safe-area-pad font-sans antialiased"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4 shadow-sm">
            <Clock className="w-8 h-8 text-accent" strokeWidth={1.75} />
          </div>
          <h1 className="font-logo-snell text-3xl text-accent tracking-tight leading-tight mb-1">
            Osteria Basilico
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            {t.header_tagline ?? 'Staff Management'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-7 space-y-4">

          <div className="mb-1">
            <h2 className="text-lg font-bold text-slate-800">
              {t.login_welcome ?? 'Bentornato'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {t.login_subtitle ?? 'Accedi con le tue credenziali'}
            </p>
          </div>

          {isInviteLink && (
            <div className="rounded-xl border border-accent/25 bg-accent/5 px-3 py-2.5 text-sm text-slate-700 space-y-1">
              <p className="font-semibold text-slate-800">{t.login_invite_banner}</p>
              {inviteUserId && !linkedUser && users.length > 0 && (
                <p className="text-xs text-amber-800">
                  {(t as { login_invite_user_unknown?: string }).login_invite_user_unknown}
                </p>
              )}
              {linkedUser && linkedUser.status !== 'active' && (
                <p className="text-xs text-amber-800">
                  {(t as { admin_employee_access_link_inactive?: string }).admin_employee_access_link_inactive}
                </p>
              )}
            </div>
          )}

          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              {t.login_name_label}
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60 transition-all"
              />
            </div>
          </div>

          {/* PIN */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              {t.login_password_label ?? 'Password'}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/60 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-sm font-medium text-center bg-red-50 rounded-xl px-3 py-2"
            >
              {error}
            </motion.p>
          )}

          {deviceSuccess && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-accent text-sm font-medium text-center bg-accent/10 rounded-xl px-3 py-2 border border-accent/20"
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
            className="w-full py-3 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t.login_btn ?? 'Accedi'
            )}
          </button>

          {showDeviceSection && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span className="h-px flex-1 bg-slate-200" aria-hidden />
                <span>{t.login_device_or}</span>
                <span className="h-px flex-1 bg-slate-200" aria-hidden />
              </div>

              {hasDeviceLogin && (
                <button
                  type="button"
                  onClick={handleDeviceLogin}
                  disabled={deviceLoading || isLoading || linkDeviceLoading}
                  className="w-full py-3 rounded-xl border-2 border-accent/35 bg-accent/5 text-accent font-semibold text-sm hover:bg-accent/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  className="w-full py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
        <p className="text-center text-sm text-slate-500 mt-5">
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
