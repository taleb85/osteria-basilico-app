import { LogOut, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations, getDateLocale } from '../utils/translations';
// import { getRoleScopeHint } from '../utils/roleScopeHint'; // unused
import { getAppNavTabTitle, type AppNavTab } from '../utils/enabledModules';
import { UnifiedBellButton } from './UnifiedBellButton';
import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';
// import { isUiWidgetVisible } from '../utils/uiScreenWidgets'; // unused
// import { useMessages } from '../hooks/useMessages'; // unused
import { useMultisensorialFeedback } from '../hooks/useMultisensorialFeedback';
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
  compact: _compact = false,
  embeddedInAppHeader: _embeddedInAppHeader = false,
  parentProvidesCardShell: _parentProvidesCardShell = false,
  hideHeaderLogout = false,
  hideToolbarAvatar: _hideToolbarAvatar = false,
}: MobileProfileHeaderProps) {
  const {
    currentUser,
    effectiveLanguage,
    isSessionElevated,
  } = useApp();

  // Animazioni on/off — persiste in localStorage
  const [animationsOn, _setAnimationsOn] = useState<boolean>(() => {
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

  const { triggerHapticFeedback } = useMultisensorialFeedback();

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Orologio live
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const dateLabel = format(now, 'EEE d MMM · HH:mm', { locale: getDateLocale(effectiveLanguage) ?? itLocale });

  const t = getTranslations(effectiveLanguage);
  if (!currentUser) return null;

  const _pageTitle = getAppNavTabTitle(t, activeTab);

  const shellClass = `w-full ${showOnDesktop ? '' : 'md:hidden'}`;

  const body = (
    <div className="relative" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }} ref={wrapperRef}>
    <div
      className="flow-brand-header px-4 flex items-center justify-between gap-3"
      style={{ height: 50 }}
    >
      {/* Sinistra: icona F + testo */}
      <div
        className="flex items-center gap-2.5 min-w-0"
      >
        <div
          role="button"
          tabIndex={0}
          style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: 'rgba(26,86,219,0.4)', border: '1px solid rgba(59,130,246,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => {
            if ('caches' in window) {
              caches.keys().then(names => Promise.all(names.map(n => caches.delete(n)))).finally(() => {
                globalThis.location.reload();
              });
            } else {
              globalThis.location.reload();
            }
          }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click(); }}
        >
          <img
            src="/icon-flow-final.png"
            alt="FLOW"
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
        <div className="flex flex-col leading-none select-none">
          <span
            style={{ color: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 15, fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1 }}
          >
            FLOW
          </span>
          <span
            style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 8, fontWeight: 500, letterSpacing: '0.20em', textTransform: 'uppercase', marginTop: 3, lineHeight: 1 }}
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

      {/* Destra: data + campanella + logout */}
      <div className="flex shrink-0 items-center gap-3">
        <span
          className="hidden sm:inline text-[12px] font-medium whitespace-nowrap capitalize tabular-nums"
          style={{ color: 'rgba(255,255,255,0.60)', letterSpacing: '0.01em' }}
        >
          {dateLabel}
        </span>
        <UnifiedBellButton
          userId={currentUser?.id}
          effectiveLanguage={effectiveLanguage}
          onMessageClick={(messageId) => { void messageId; }}
        />
        {onLogout && !hideHeaderLogout && (
          <button
            type="button"
            onClick={() => { triggerHapticFeedback('click'); onLogout?.(); }}
            title={t.header_logout}
            aria-label={t.header_logout}
            className="flex h-8 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200 hover:bg-red-500/20 active:scale-95 touch-manipulation text-red-400 hover:text-red-300"
          >
            <LogOut className="w-[16px] h-[16px]" strokeWidth={2.5} aria-hidden />
          </button>
        )}
      </div>
    </div>
    </div>
  );

  return <div className={shellClass}>{body}</div>;
}
