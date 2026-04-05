import { motion } from 'framer-motion';
import { LogOut, ShieldCheck, Zap, ZapOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations } from '../utils/translations';
import { getRoleScopeHint } from '../utils/roleScopeHint';
import { getAppNavTabTitle, type AppNavTab } from '../utils/enabledModules';
import { UnifiedBellButton } from './UnifiedBellButton';
import { useState, useEffect, useRef } from 'react';
import { isUiWidgetVisible } from '../utils/uiScreenWidgets';
import { useMessages } from '../hooks/useMessages';
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';
import { persistThemePreference } from '../utils/theme';

function ThemeContrastIcon({ mode, className }: { mode: 'light' | 'dark'; className?: string }) {
  const activeLight = mode === 'light';
  const svgTransition = 'absolute inset-0 h-full w-full transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.34,1.2,0.64,1)]';
  return (
    <span className={`relative inline-block shrink-0 ${className ?? ''}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={svgTransition} style={{ opacity: activeLight ? 1 : 0, transform: activeLight ? 'rotate(0deg) scale(1)' : 'rotate(-100deg) scale(0.82)' }}>
        <circle cx="12" cy="12" r="9.15" fill="#1e293b" />
        <path d="M12 3.35C16.7773 3.35 20.65 7.22274 20.65 12C20.65 16.7773 16.7773 20.65 12 20.65V3.35Z" fill="white" />
        <circle cx="12" cy="12" r="3.95" fill="white" />
        <path d="M12 8.05C14.1815 8.05 15.95 9.81848 15.95 12C15.95 14.1815 14.1815 15.95 12 15.95V8.05Z" fill="#1e293b" />
        <circle cx="12" cy="12" r="9.15" fill="none" stroke="#f1f5f9" strokeWidth="1.5" />
      </svg>
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={svgTransition} style={{ opacity: activeLight ? 0 : 1, transform: activeLight ? 'rotate(100deg) scale(0.82)' : 'rotate(0deg) scale(1)' }}>
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
    featureFlags,
    isSessionElevated,
    updateUserPreferences,
  } = useApp();

  const systemDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const uiTheme = (currentUser?.theme ?? (systemDark ? 'dark' : 'light')) as 'light' | 'dark';
  const toggleUiTheme = () => {
    const nextTheme = uiTheme === 'light' ? 'dark' : 'light';
    updateUserPreferences({ theme: nextTheme });
    persistThemePreference(nextTheme);
  };

  // Animazioni on/off — persiste in localStorage
  const [animationsOn, setAnimationsOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flow-animations') !== 'off';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (animationsOn) {
      document.documentElement.classList.remove('no-motion');
      localStorage.setItem('flow-animations', 'on');
    } else {
      document.documentElement.classList.add('no-motion');
      localStorage.setItem('flow-animations', 'off');
    }
  }, [animationsOn]);
  // Applica anche al primo mount (se salvato come off)
  useEffect(() => {
    if (!animationsOn) document.documentElement.classList.add('no-motion');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { sendMessage } = useMessages(currentUser?.id);
  const { triggerHapticFeedback, playNotificationSound } = useMultisensorialFeedback();

  const [logoAnim, setLogoAnim] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [barSize, setBarSize] = useState({ w: 0, h: 62 });

  const [isStaffComposerOpen, setIsStaffComposerOpen] = useState(false);
  const [staffSubject, setStaffSubject] = useState('');
  const [staffBody, setStaffBody] = useState('');
  const [isStaffSending, setIsStaffSending] = useState(false);

  const t = getTranslations(effectiveLanguage);
  const tr = t as Record<string, string>;
  if (!currentUser) return null;

  const pageTitle = getAppNavTabTitle(t, activeTab);

  const shellClass = `w-full ${showOnDesktop ? '' : 'md:hidden'}`;

  const body = (
    <div className="relative mt-1.5" ref={wrapperRef}>
    <div
      className="flow-header-card rounded-2xl overflow-hidden px-3 py-2 flex items-center justify-between gap-3"
    >
      {/* Sinistra: icona F + testo */}
      <div
        className="flex items-center gap-2.5 min-w-0"
      >
        <img
          src="/flow-f-mark.png"
          alt="F"
          draggable={false}
          style={{ width: 42, height: 46, flexShrink: 0 }}
        />
        <div className="flex flex-col leading-none select-none">
          <span
            style={{ color: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 20, fontWeight: 200, letterSpacing: '0.08em', lineHeight: 1 }}
          >
            FLOW
          </span>
          <span
            style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 9, fontWeight: 500, letterSpacing: '0.20em', textTransform: 'uppercase', marginTop: 4, lineHeight: 1 }}
          >
            Work in Motion
          </span>
        </div>
        {isSessionElevated && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
            <ShieldCheck className="h-3 w-3" />
            Admin
          </span>
        )}
      </div>

      {/* Destra: tema + campanella + logout */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Toggle tema */}
        <button
          type="button"
          onClick={toggleUiTheme}
          title={uiTheme === 'light' ? 'Passa a scuro' : 'Passa a chiaro'}
          aria-label={uiTheme === 'light' ? 'Passa a scuro' : 'Passa a chiaro'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 hover:bg-white/10 active:scale-95 touch-manipulation"
        >
          <ThemeContrastIcon mode={uiTheme} className="h-[22px] w-[22px]" />
        </button>
        <UnifiedBellButton
          userId={currentUser?.id}
          effectiveLanguage={effectiveLanguage}
          onMessageClick={(messageId) => { void messageId; }}
        />
        {onLogout && !hideHeaderLogout && (
          <button
            type="button"
            onClick={onLogout}
            title={t.header_logout}
            aria-label={t.header_logout}
            className="flex h-9 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 hover:bg-red-500/20 active:scale-95 touch-manipulation text-red-400 hover:text-red-300"
          >
            <LogOut className="w-[18px] h-[18px]" strokeWidth={2.5} aria-hidden />
          </button>
        )}
      </div>
    </div>
    </div>
  );

  return <div className={shellClass}>{body}</div>;
}
