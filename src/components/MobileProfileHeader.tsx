import { useWallAlignedMinuteClock } from '../hooks/useWallAlignedMinuteClock';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { LogOut, Cloud, CloudOff, RotateCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations, getDateLocale } from '../utils/translations';
import { getRoleScopeHint } from '../utils/roleScopeHint';
import { getAppNavTabTitle, type AppNavTab } from '../utils/enabledModules';
import { readStoredThemePreference, persistThemePreference } from '../utils/theme';
import { UnifiedBellButton } from './UnifiedBellButton';
import { useState, useEffect } from 'react';
import { isUiWidgetVisible } from '../utils/uiScreenWidgets';
import { useMessages } from '../hooks/useMessages';
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';

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
  } = useApp();
  const { sendMessage } = useMessages(currentUser?.id);
  const { triggerHapticFeedback, playNotificationSound } = useMultisensorialFeedback();

  const [isStaffComposerOpen, setIsStaffComposerOpen] = useState(false);
  const [staffSubject, setStaffSubject] = useState('');
  const [staffBody, setStaffBody] = useState('');
  const [isStaffSending, setIsStaffSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const t = getTranslations(effectiveLanguage);
  const tr = t as Record<string, string>;
  const locale = getDateLocale(effectiveLanguage) ?? it;
  const now = useWallAlignedMinuteClock();

  if (!currentUser) return null;

  const uiTheme = (currentUser.theme ?? 'light') as 'light' | 'dark';
  
  // Effetto per sincronizzare il tema: esegui UNA SOLA VOLTA al mount
  // Evita loop infinito non includendo currentUser.theme nelle dipendenze
  useEffect(() => {
    const stored = readStoredThemePreference();
    if (stored) {
      // Se c'è una preferenza salvata, assicuriamoci che sia applicata
      if (currentUser.theme !== stored) {
        updateUserPreferences({ theme: stored });
      }
      return;
    }

    // Se nessuna preferenza salvata, sincronizza con il sistema una sola volta
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const systemTheme = mediaQuery.matches ? 'dark' : 'light';
    if (currentUser.theme !== systemTheme) {
      updateUserPreferences({ theme: systemTheme });
    }
  }, [currentUser.id]); // Dipende SOLO dall'ID utente, non dal tema

  const toggleUiTheme = () => {
    const nextTheme = uiTheme === 'light' ? 'dark' : 'light';
    updateUserPreferences({ theme: nextTheme });
    // Salviamo la preferenza esplicita in localStorage per "staccarci" dal sistema
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
              Osteria Basilico
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
              className="relative flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 flex-col items-center justify-center gap-0.5 surface-glass-sm px-1.5 surface-ghost-interactive transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation !text-slate-700 hover:!text-slate-900 bg-white dark:bg-neutral-950 shadow-sm border border-slate-100 dark:border-white/10"
            >
              <ThemeContrastIcon mode={uiTheme} className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
            {/* Campanella unificata: notifiche + mute audio */}
            <UnifiedBellButton
              userId={currentUser?.id}
              effectiveLanguage={effectiveLanguage}
              onMessageClick={(messageId) => {
                // Deep-link a messaggio nel profilo
                console.log('Navigating to message:', messageId);
              }}
            />
            <button
              type="button"
              onClick={handleHardRefresh}
              disabled={isRefreshing || dataSyncInProgress}
              title={isRefreshing || dataSyncInProgress ? 'Sincronizzazione in corso...' : 'Hard Refresh & Sincronizzazione'}
              className={`flex h-9 w-9 sm:h-10 sm:w-10 flex-col items-center justify-center gap-0.5 surface-glass-sm px-1.5 transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation bg-white dark:bg-neutral-950 shadow-sm border border-slate-100 dark:border-white/10 ${
                isRefreshing || dataSyncInProgress 
                  ? 'text-amber-500' 
                  : isSynced ? '!text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950' : '!text-slate-400'
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
            {onLogout && !hideHeaderLogout ? (
              <button
                type="button"
                onClick={onLogout}
                title={t.header_logout}
                aria-label={t.header_logout}
                className="relative flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 flex-col items-center justify-center gap-0.5 surface-glass-sm px-1.5 !text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation bg-white dark:bg-neutral-950 shadow-sm border border-slate-100 dark:border-white/10"
              >
                <LogOut size={14} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* COMUNICAZIONI STAFF (solo ADMIN/MANAGER) - Solo se NON compatto (quindi nel drawer) */}
      {!compact && (currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
        <div className="px-3 sm:px-4 pb-4">
          <div className="mt-1 mb-2">
            <button
              type="button"
              onClick={() => setIsStaffComposerOpen((v) => !v)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-100 dark:border-white/10 py-4 text-sm font-bold text-accent transition-all active:scale-95 shadow-sm"
            >
              <span>✍️</span>
              <span>Invia Comunicazione allo Staff</span>
            </button>
          </div>

          {isStaffComposerOpen && (
            <div className="rounded-[32px] border-2 border-accent/20 bg-accent/5 p-5 sm:p-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-accent">
                  Nuovo Messaggio
                </h3>
                <button 
                  onClick={() => setIsStaffComposerOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <input
                value={staffSubject}
                onChange={(e) => setStaffSubject(e.target.value.toUpperCase())}
                className="w-full mb-3 h-14 rounded-2xl border-2 border-slate-100 bg-white px-5 text-sm font-black tracking-widest text-slate-900 outline-none focus:border-accent shadow-sm"
                placeholder="OGGETTO"
              />

              <textarea
                value={staffBody}
                onChange={(e) => setStaffBody(e.target.value)}
                rows={5}
                className="w-full mb-4 rounded-[24px] border-2 border-slate-100 bg-white px-5 py-4 text-sm font-medium text-slate-900 outline-none focus:border-accent resize-none shadow-sm"
                placeholder="Scrivi qui il tuo messaggio..."
              />

              <button
                type="button"
                disabled={isStaffSending || !staffSubject.trim() || !staffBody.trim()}
                onClick={async () => {
                  if (!currentUser?.id) return;
                  setIsStaffSending(true);
                  try {
                    const ok = await sendMessage(staffSubject.trim(), staffBody.trim());
                    if (ok) {
                      triggerHapticFeedback('success');
                      try {
                        playNotificationSound();
                      } catch {
                        // ignore
                      }
                      setIsStaffComposerOpen(false);
                      setStaffSubject('');
                      setStaffBody('');
                    } else {
                      triggerHapticFeedback('warning');
                    }
                  } finally {
                    setIsStaffSending(false);
                  }
                }}
                className="w-full h-16 rounded-[24px] bg-[#2D5A27] text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-accent/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
              >
                {isStaffSending ? 'INVIO...' : 'INVIA ORA'}
              </button>

              <p className="mt-3 text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest">
                Verrà inviato a tutto lo staff
              </p>
            </div>
          )}
        </div>
      )}

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
    </>
  );

  return <div className={shellClass}>{body}</div>;
}
