import { useId } from 'react';
import { useWallAlignedMinuteClock } from '../hooks/useWallAlignedMinuteClock';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { LogOut, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations, getDateLocale } from '../utils/translations';
import { getRoleScopeHint } from '../utils/roleScopeHint';
import { getAppNavTabTitle, type AppNavTab } from '../utils/enabledModules';
import UserAvatarMenu from './UserAvatarMenu';
import NotificationCenter from './NotificationCenter';

/**
 * Icona tema: due grafiche come riferimento foto — grigio/bianco in chiaro, nero/bianco in scuro.
 * Transizione: dissolvenza + leggera rotazione/scala al cambio tema.
 */
function ThemeContrastIcon({ mode, className }: { mode: 'light' | 'dark'; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const lL = `tg-${uid}-ll`;
  const lR = `tg-${uid}-lr`;
  const dL = `tg-${uid}-dl`;
  const dR = `tg-${uid}-dr`;

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
        <defs>
          <clipPath id={lL}>
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
          <clipPath id={lR}>
            <rect x="12" y="0" width="12" height="24" />
          </clipPath>
        </defs>
        <circle cx="12" cy="12" r="9.15" fill="#cbd5e1" />
        <g clipPath={`url(#${lR})`}>
          <circle cx="12" cy="12" r="8.65" fill="#ffffff" />
        </g>
        <g clipPath={`url(#${lL})`}>
          <circle cx="12" cy="12" r="3.95" fill="#ffffff" />
        </g>
        <g clipPath={`url(#${lR})`}>
          <circle cx="12" cy="12" r="3.95" fill="#94a3b8" />
        </g>
        <circle cx="12" cy="12" r="9.15" fill="none" stroke="#ffffff" strokeWidth="2.35" />
      </svg>

      {/* Modalità scura: disco bianco, anello medio e centro nero/bianco invertiti */}
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={svgTransition} style={{
        opacity: activeLight ? 0 : 1,
        transform: activeLight ? 'rotate(100deg) scale(0.82)' : 'rotate(0deg) scale(1)',
      }}>
        <defs>
          <clipPath id={dL}>
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
          <clipPath id={dR}>
            <rect x="12" y="0" width="12" height="24" />
          </clipPath>
        </defs>
        <circle cx="12" cy="12" r="9.85" fill="#ffffff" />
        <g clipPath={`url(#${dL})`}>
          <circle cx="12" cy="12" r="6.55" fill="#0a0a0a" />
        </g>
        <g clipPath={`url(#${dR})`}>
          <circle cx="12" cy="12" r="6.55" fill="#ffffff" />
        </g>
        <g clipPath={`url(#${dL})`}>
          <circle cx="12" cy="12" r="3.75" fill="#ffffff" />
        </g>
        <g clipPath={`url(#${dR})`}>
          <circle cx="12" cy="12" r="3.75" fill="#0a0a0a" />
        </g>
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
  /** Staff: logout solo da Impostazioni — meno pulsanti nell’header. */
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
  hideToolbarAvatar = false,
}: MobileProfileHeaderProps) {
  const {
    currentUser,
    effectiveLanguage,
    dataSyncInProgress,
    isGlobalRefreshing,
    postRefreshLocked,
    updateUserPreferences,
  } = useApp();
  const showDataSyncIndicator =
    dataSyncInProgress && !isGlobalRefreshing && !postRefreshLocked;
  const t = getTranslations(effectiveLanguage);
  const tr = t as Record<string, string>;
  const locale = getDateLocale(effectiveLanguage) ?? it;
  const now = useWallAlignedMinuteClock();

  if (!currentUser) return null;

  const uiTheme = (currentUser.theme ?? 'light') as 'light' | 'dark';
  const toggleUiTheme = () => {
    updateUserPreferences({ theme: uiTheme === 'light' ? 'dark' : 'light' });
  };
  const themeToggleTitle =
    uiTheme === 'light' ? `${t.theme}: ${t.light} → ${t.dark}` : `${t.theme}: ${t.dark} → ${t.light}`;

  const pageTitle = getAppNavTabTitle(t, activeTab);
  const timeStr = format(now, 'HH:mm', { locale });
  const dateStr = format(now, 'EEE d MMM', { locale });
  const dateLong = format(now, 'EEEE d MMMM', { locale });

  const shellClass = parentProvidesCardShell
    ? `w-full ${showOnDesktop ? '' : 'md:hidden'} ${compact ? 'p-2' : ''}`
    : `relative surface-glass overflow-hidden shadow-[0_4px_16px_-4px_rgba(45,90,39,0.14),0_2px_8px_-4px_rgba(15,23,42,0.08)] dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.35)] ${embeddedInAppHeader ? 'mb-0' : 'mb-2'} ${showOnDesktop ? '' : 'md:hidden'} ${compact ? 'p-2' : ''}`;

  const body = compact ? (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 pr-1">
        <h1 className="font-logo-snell text-[19px] sm:text-[22px] text-accent dark:text-white tracking-tight leading-tight truncate">
          Osteria Basilico
        </h1>
        <h2 className="text-[11px] sm:text-[12px] font-bold text-slate-900 dark:text-neutral-100 tracking-tight leading-tight truncate mt-0.5">
          {pageTitle}
        </h2>
        {activeTab === 'home' &&
          currentUser.role !== 'admin' &&
          (() => {
            const scope = getRoleScopeHint(currentUser.role, tr);
            return scope ? (
              <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-neutral-400 leading-snug mt-1 line-clamp-2 pr-1">
                {scope}
              </p>
            ) : null;
          })()}
      </div>
      <p className="flex-shrink-0 text-[10px] text-slate-500 dark:text-neutral-400 tabular-nums text-right leading-tight">
        {timeStr}
        <span className="text-slate-300 dark:text-neutral-600 mx-0.5">·</span>
        {dateStr}
      </p>
    </div>
  ) : (
    <>
      <div className="px-3 sm:px-4 py-2.5">
        {/* Su mobile: brand a tutta larghezza; ora + azioni su una seconda riga (niente competizione orizzontale). */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="min-w-0 w-full md:flex-1">
            <h1 className="font-logo-snell text-[clamp(1.05rem,4.2vw,1.4375rem)] sm:text-[23px] text-accent dark:text-white tracking-tight leading-[1.15] break-words hyphens-auto">
              Osteria Basilico
            </h1>
            <h2 className="text-[11px] sm:text-[12px] font-bold text-slate-900 dark:text-neutral-100 tracking-tight leading-snug mt-0.5 line-clamp-2 md:line-clamp-1 md:truncate">
              {pageTitle}
            </h2>
            {activeTab === 'home' &&
              currentUser.role !== 'admin' &&
              (() => {
                const scope = getRoleScopeHint(currentUser.role, tr);
                return scope ? (
                  <p className="text-[9px] sm:text-[10px] text-slate-600 dark:text-neutral-400 leading-snug mt-1 line-clamp-3">
                    {scope}
                  </p>
                ) : null;
              })()}
          </div>

          <div className="flex w-full min-w-0 items-center justify-between gap-2 border-t border-slate-100/90 pt-2.5 dark:border-white/10 md:w-auto md:flex-shrink-0 md:items-center md:justify-start md:gap-3 md:border-t-0 md:pt-0">
            <div className="min-w-0 text-left md:text-right">
              <p className="text-base font-semibold text-slate-800 dark:text-neutral-200 tabular-nums leading-none">{timeStr}</p>
              <p className="text-[10px] text-slate-600 dark:text-neutral-400 mt-0.5 leading-tight whitespace-nowrap" title={dateLong}>
                {dateStr}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {!hideToolbarAvatar && (
                <UserAvatarMenu variant="toolbar" onLogout={hideHeaderLogout ? onLogout : undefined} />
              )}
              <NotificationCenter denseTrigger />
              {showDataSyncIndicator && (
                <span
                  className="flex shrink-0 items-center justify-center min-h-[40px] min-w-[40px] rounded-lg border border-accent/20 dark:border-accent-light/25 bg-accent/[0.06] dark:bg-accent-light/10 text-accent dark:text-accent-light"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  aria-label={`${t.data_sync_banner_line1}. ${t.data_sync_banner_line2}`}
                  title={`${t.data_sync_banner_line1} — ${t.data_sync_banner_line2}`}
                >
                  <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
                </span>
              )}
              {onLogout && !hideHeaderLogout ? (
                <button
                  type="button"
                  onClick={onLogout}
                  title={t.header_logout}
                  aria-label={t.header_logout}
                  className="relative flex flex-shrink-0 items-center justify-center border transition-colors touch-manipulation min-h-[40px] min-w-[40px] rounded-lg border-red-100 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-200 hover:text-red-700"
                >
                  <LogOut size={15} strokeWidth={2} aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                onClick={toggleUiTheme}
                title={themeToggleTitle}
                aria-label={themeToggleTitle}
                className="relative flex flex-shrink-0 items-center justify-center border transition-colors touch-manipulation min-h-[40px] min-w-[40px] rounded-lg border-slate-200/90 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-white/15 dark:hover:bg-neutral-700 dark:hover:text-white"
              >
                <ThemeContrastIcon mode={uiTheme} className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return <div className={shellClass}>{body}</div>;
}
