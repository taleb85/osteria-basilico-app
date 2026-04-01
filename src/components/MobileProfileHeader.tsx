import { useWallAlignedMinuteClock } from '../hooks/useWallAlignedMinuteClock';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useTenant } from '../context/TenantContext';
import { LogOut, Cloud, CloudOff, RotateCw, Lock, Unlock, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations, getDateLocale } from '../utils/translations';
import { getRoleScopeHint } from '../utils/roleScopeHint';
import { getAppNavTabTitle, type AppNavTab } from '../utils/enabledModules';
import { persistThemePreference } from '../utils/theme';
import { UnifiedBellButton } from './UnifiedBellButton';
import { useState, useEffect, useRef } from 'react';
import { isUiWidgetVisible } from '../utils/uiScreenWidgets';
import { useMessages } from '../hooks/useMessages';
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { findFreezeVerifierByPin, isManagementRole } from '../utils/permissions';
import { PinPadModal } from './ui/PinPadModal';
/**
 * Icona tema: due grafiche come riferimento foto — grigio/bianco in chiaro, nero/bianco in scuro.
 * Transizione: dissolvenza + leggera rotazione/scala al cambio tema.
 */
function ThemeContrastIcon({ mode, className }: { mode: 'light' | 'dark'; className?: string }) {
  const activeLight = mode === 'light';
  const svgTransition =
    'absolute inset-0 h-full w-full transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.34,1.2,0.64,1)]';

  return (
    <span className={`relative inline-block shrink-0 ${className ?? ''}`} aria-hidden>
      {/* Modalità chiara: bordo bianco spesso, interno grigio a sinistra / bianco a destra, centro invertito */}
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={svgTransition} style={{
        opacity: activeLight ? 1 : 0,
        transform: activeLight ? 'rotate(0deg) scale(1)' : 'rotate(-100deg) scale(0.82)',
      }}>
        <circle cx="12" cy="12" r="9.15" fill="#cbd5e1" />
        <path d="M12 3.35C16.7773 3.35 20.65 7.22274 20.65 12C20.65 16.7773 16.7773 20.65 12 20.65V3.35Z" fill="white" />
        <circle cx="12" cy="12" r="3.95" fill="white" />
        <path d="M12 8.05C14.1815 8.05 15.95 9.81848 15.95 12C15.95 14.1815 14.1815 15.95 12 15.95V8.05Z" fill="#94a3b8" />
        <circle cx="12" cy="12" r="9.15" fill="none" stroke="#ffffff" strokeWidth="2.35" />
      </svg>

      {/* Modalità scura: disco bianco, anello medio e centro nero/bianco invertiti */}
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={svgTransition} style={{
        opacity: activeLight ? 0 : 1,
        transform: activeLight ? 'rotate(100deg) scale(0.82)' : 'rotate(0deg) scale(1)',
      }}>
        <circle cx="12" cy="12" r="9.85" fill="#ffffff" />
        <path d="M12 5.45C15.6175 5.45 18.55 8.38254 18.55 12C18.55 15.6175 15.6175 18.55 12 18.55V5.45Z" fill="white" />
        <path d="M12 5.45C8.38254 5.45 5.45 8.38254 5.45 12C5.45 15.6175 8.38254 18.55 12 18.55V5.45Z" fill="#0a0a0a" />
        <path d="M12 8.25C14.0711 8.25 15.75 9.92893 15.75 12C15.75 14.0711 14.0711 15.75 12 15.75V8.25Z" fill="#0a0a0a" />
        <path d="M12 8.25C9.92893 8.25 8.25 9.92893 8.25 12C8.25 14.0711 9.92893 15.75 12 15.75V8.25Z" fill="white" />
      </svg>
    </span>
  );
}

interface MobileProfileHeaderProps {
  onLogout?: () => void;
  /** Tab attiva: titolo come la dashboard (h1) in base alla scheda. */
  activeTab?: AppNavTab;
  /** Se true, mostra anche su desktop (layout unificato con bottom bar) */
  showOnDesktop?: boolean;
  /** Se true, mostra solo titolo e data (senza righe tipo scheda Profilo) */
  compact?: boolean;
  /** In MainApp sticky header: stessa card senza mb-2 (margine gestito da main). */
  embeddedInAppHeader?: boolean;
  /** Il genitore (es. MainApp) avvolge già la card con bordo/ombra — solo contenuto interno. */
  parentProvidesCardShell?: boolean;
  /** Se true, nasconde il pulsante Esci nell’header e lo lascia solo nel modale avatar (override raro). */
  hideHeaderLogout?: boolean;
  /** Se true, nasconde il pulsante profilo (es. non-admin: profilo solo in bottom bar). */
  hideToolbarAvatar?: boolean;
}

export default function MobileProfileHeader({
  onLogout,
  activeTab = 'home',
  showOnDesktop = false,
  compact = false,
  embeddedInAppHeader = false,
  parentProvidesCardShell = false,
  hideHeaderLogout = false,
  hideToolbarAvatar: _hideToolbarAvatar = false,
}: MobileProfileHeaderProps) {
  const {
    currentUser,
    effectiveLanguage,
    users,
    updateUserPreferences,
    featureFlags,
    hardReloadFromDatabase,
    dataSyncInProgress,
    globalPinSessionId,
    setGlobalPinSessionId,
  } = useApp();
  const { tenant } = useTenant();
  const { sendMessage } = useMessages(currentUser?.id);
  const { triggerHapticFeedback, playNotificationSound } = useMultisensorialFeedback();

  const [isStaffComposerOpen, setIsStaffComposerOpen] = useState(false);
  const [staffSubject, setStaffSubject] = useState('');
  const [staffBody, setStaffBody] = useState('');
  const [isStaffSending, setIsStaffSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPinMenu, setShowPinMenu] = useState(false);
  const [globalPinValue, setGlobalPinValue] = useState('');
  const [globalPinError, setGlobalPinError] = useState('');
  const globalPinAutoSubmitted = useRef('');
  const isSynced = !!featureFlags && Object.keys(featureFlags).length > 0;

  const handleHardRefresh = async () => {
    if (isRefreshing || dataSyncInProgress) return;
    setIsRefreshing(true);
    try {
      // 1. Sincronizzazione forzata dal database
      await hardReloadFromDatabase();
      
      // 2. Hard Refresh del browser (svuota cache e ricarica)
      // Nota: window.location.reload(true) è deprecato in alcuni browser, 
      // ma forzare il ricaricamento dopo la sync garantisce l'ultima versione.
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error('Errore durante l\'hard refresh:', err);
      setIsRefreshing(false);
    }
  };
  const closePinMenu = () => {
    setShowPinMenu(false);
    setGlobalPinValue('');
    setGlobalPinError('');
    globalPinAutoSubmitted.current = '';
  };

  const handleGlobalPinSubmit = (pin: string) => {
    const verifier = findFreezeVerifierByPin(users, pin);
    if (!verifier) {
      setGlobalPinError('PIN non valido');
      setGlobalPinValue('');
      globalPinAutoSubmitted.current = '';
      return;
    }
    setGlobalPinSessionId(Date.now().toString());
    closePinMenu();
  };

  useEffect(() => {
    if (!showPinMenu || !!globalPinSessionId) return;
    if (globalPinValue.length < 4) { globalPinAutoSubmitted.current = ''; return; }
    if (globalPinAutoSubmitted.current === globalPinValue) return;
    globalPinAutoSubmitted.current = globalPinValue;
    handleGlobalPinSubmit(globalPinValue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPinMenu, globalPinValue, globalPinSessionId]);

  const t = getTranslations(effectiveLanguage);
  const tr = t as Record<string, string>;
  const locale = getDateLocale(effectiveLanguage) ?? it;
  const now = useWallAlignedMinuteClock();

  if (!currentUser) return null;

  // Se l'utente non ha un tema esplicito, segui il sistema operativo per l'icona
  const systemDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const uiTheme = (currentUser.theme ?? (systemDark ? 'dark' : 'light')) as 'light' | 'dark';

  const toggleUiTheme = () => {
    const nextTheme = uiTheme === 'light' ? 'dark' : 'light';
    updateUserPreferences({ theme: nextTheme });
    // Salva la preferenza esplicita in localStorage per "staccarsi" dal sistema
    persistThemePreference(nextTheme);
  };
  const themeToggleTitle =
    uiTheme === 'light' ? `${t.theme}: ${t.light} → ${t.dark}` : `${t.theme}: ${t.dark} → ${t.light}`;

  const pageTitle = getAppNavTabTitle(t, activeTab);
  const timeStr = format(now, 'HH:mm', { locale });
  const dateStr = format(now, 'EEE d MMM', { locale });
  const dateLong = format(now, 'EEEE d MMMM', { locale });

  const shellClass = parentProvidesCardShell
    ? `w-full ${compact ? 'p-2' : ''}`
    : `relative surface-glass overflow-hidden shadow-[0_4px_16px_-4px_rgba(45,90,39,0.14),0_2px_8px_-4px_rgba(15,23,42,0.08)] dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.35)] ${embeddedInAppHeader ? 'mb-0' : 'mb-2'} ${showOnDesktop ? '' : 'md:hidden'} ${compact ? 'p-2' : ''} flex`;

  const body = (
    <>
      <div className="px-3 sm:px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-logo-snell text-[clamp(1.05rem,4.2vw,1.4375rem)] sm:text-[23px] text-accent dark:text-white tracking-tight leading-none break-words hyphens-auto font-normal">
              {tenant?.name ?? 'Osteria Basilico'}
            </h1>
            <h2 className="text-[11px] sm:text-[12px] font-extrabold text-slate-900 dark:text-neutral-100 tracking-tight leading-tight mt-0.5 truncate uppercase">
              {pageTitle}
            </h2>
          </div>

          {/* Toolbar: sempre visibile con orologio, avatar e azioni. */}
          <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-1.5 min-w-0">
            <div className="mr-1 shrink-0 text-right min-w-0">
              <p className="text-[12px] sm:text-[13px] font-semibold tabular-nums leading-none text-slate-800 dark:text-neutral-200">{timeStr}</p>
              <p
                className="mt-0.5 text-[9px] sm:text-[10px] leading-tight text-slate-600 dark:text-neutral-400 whitespace-nowrap truncate"
                title={dateLong}
              >
                {dateStr}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleUiTheme}
              title={themeToggleTitle}
              aria-label={themeToggleTitle}
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border-0 bg-gradient-to-b from-white/75 to-white/55 dark:from-neutral-800/70 dark:to-neutral-900/60 shadow-[0_1px_0_0_rgba(255,255,255,0.85)_inset,0_-1px_0_0_rgba(0,0,0,0.05)_inset,0_4px_10px_-2px_rgba(45,90,39,0.14),0_2px_5px_-1px_rgba(15,23,42,0.09)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset,0_-1px_0_0_rgba(0,0,0,0.4)_inset,0_4px_12px_-2px_rgba(0,0,0,0.45)] supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-[2] transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation text-slate-700 hover:text-slate-900 dark:text-neutral-200 dark:hover:text-white"
            >
              <ThemeContrastIcon mode={uiTheme} className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            {/* Campanella unificata: notifiche + mute audio */}
            <UnifiedBellButton
              userId={currentUser?.id}
              effectiveLanguage={effectiveLanguage}
              onMessageClick={(messageId) => {
                console.log('Navigating to message:', messageId);
              }}
            />
            <button
              type="button"
              onClick={handleHardRefresh}
              disabled={isRefreshing || dataSyncInProgress}
              title={isRefreshing || dataSyncInProgress ? 'Sincronizzazione in corso...' : 'Hard Refresh & Sincronizzazione'}
              className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border-0 bg-gradient-to-b from-white/75 to-white/55 dark:from-neutral-800/70 dark:to-neutral-900/60 shadow-[0_1px_0_0_rgba(255,255,255,0.85)_inset,0_-1px_0_0_rgba(0,0,0,0.05)_inset,0_4px_10px_-2px_rgba(45,90,39,0.14),0_2px_5px_-1px_rgba(15,23,42,0.09)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset,0_-1px_0_0_rgba(0,0,0,0.4)_inset,0_4px_12px_-2px_rgba(0,0,0,0.45)] supports-[backdrop-filter]:backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-[2] transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation ${
                isRefreshing || dataSyncInProgress
                  ? 'text-amber-500'
                  : isSynced ? 'text-brand-600' : 'text-slate-400'
              }`}
            >
              {isRefreshing || dataSyncInProgress ? (
                <RotateCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" strokeWidth={2.5} />
              ) : isSynced ? (
                <Cloud className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
              ) : (
                <CloudOff className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
              )}
              <span className="text-[7px] sm:text-[8px] font-bold tracking-tight uppercase">
                {isRefreshing || dataSyncInProgress ? 'SYNC' : isSynced ? 'OK' : 'OFF'}
              </span>
            </button>
            {featureFlags['unlock_with_pin'] !== false && currentUser && isManagementRole(currentUser.role) && (
              <button
                type="button"
                onClick={() => setShowPinMenu(true)}
                title={globalPinSessionId ? 'Sessione PIN attiva' : 'Sblocca sessione PIN'}
                aria-label={globalPinSessionId ? 'Gestisci sessione PIN' : 'Sblocca sessione PIN'}
                className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation ${
                  globalPinSessionId
                    ? 'bg-accent border-accent/40 text-white hover:bg-accent-hover'
                    : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-50 dark:hover:bg-neutral-800'
                }`}
              >
                {globalPinSessionId
                  ? <Unlock size={16} strokeWidth={2.5} aria-hidden />
                  : <Lock size={16} strokeWidth={2.5} aria-hidden />
                }
              </button>
            )}
            {onLogout && !hideHeaderLogout ? (
              <button
                type="button"
                onClick={onLogout}
                title={t.header_logout}
                aria-label={t.header_logout}
                className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-white/10 shadow-sm transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <LogOut size={16} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      </div>



      {activeTab === 'home' &&
        currentUser.role !== 'admin' &&
        (() => {
          const scope = getRoleScopeHint(currentUser.role, tr);
          return scope ? (
            <div className="px-3 sm:px-4 pb-2">
              <p className="text-[9px] sm:text-[10px] !text-slate-600 leading-snug line-clamp-1 italic opacity-80">
                {scope}
              </p>
            </div>
          ) : null;
        })()}
      {/* Locked: usa direttamente PinPadModal — zero duplicazione */}
      {createPortal(
        <AnimatePresence>
          {showPinMenu && !globalPinSessionId && (
            <PinPadModal
              key="global-pin-lock"
              title="Sblocco sessione"
              subtitle="Inserisci il PIN per sbloccare tutte le operazioni protette"
              pinLabel="PIN"
              pin={globalPinValue}
              onPinChange={setGlobalPinValue}
              error={globalPinError}
              onConfirm={() => handleGlobalPinSubmit(globalPinValue)}
              onCancel={closePinMenu}
              confirmLabel="Sblocca"
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Unlocked: pannello di stato + blocca */}
      {createPortal(
        <AnimatePresence>
          {showPinMenu && !!globalPinSessionId && (
            <motion.div
              key="global-pin-unlock"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[10080] bg-black/75 backdrop-blur-md flex flex-col items-center justify-center"
            >
              <button
                type="button"
                onClick={closePinMenu}
                className="absolute top-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Chiudi"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.9 }}
                className="flex flex-col items-center w-full max-w-[320px] px-6"
              >
                <div className="flex flex-col items-center text-center mb-10">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/20 border-2 border-accent/40 mb-5">
                    <ShieldCheck className="w-9 h-9 text-accent" strokeWidth={2} />
                  </div>
                  <h2 className="text-white font-bold uppercase tracking-widest text-base mb-2">Sessione sbloccata</h2>
                  <p className="text-white/60 text-sm font-medium leading-tight px-4">
                    Tutte le operazioni protette da PIN sono accessibili in questa sessione.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setGlobalPinSessionId(null); closePinMenu(); }}
                  className="w-full h-14 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold flex items-center justify-center gap-2.5 transition-all active:scale-95 mb-3"
                >
                  <ShieldOff className="w-5 h-5" strokeWidth={2} />
                  Blocca sessione
                </button>
                <button
                  type="button"
                  onClick={closePinMenu}
                  className="w-full h-14 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white/70 font-bold transition-all active:scale-95"
                >
                  Annulla
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );

  return <div className={shellClass}>{body}</div>;
}
