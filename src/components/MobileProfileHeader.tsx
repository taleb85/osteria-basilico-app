import { useWallAlignedMinuteClock } from '../hooks/useWallAlignedMinuteClock';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useApp } from '../context/AppContext';
import { getTranslations, getDateLocale } from '../utils/translations';
import { getAppNavTabTitle, type AppNavTab } from '../utils/enabledModules';
import UserAvatarMenu from './UserAvatarMenu';
import NotificationCenter from './NotificationCenter';

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
}

export default function MobileProfileHeader({
  onLogout,
  activeTab = 'home',
  showOnDesktop = false,
  compact = false,
  embeddedInAppHeader = false,
  parentProvidesCardShell = false,
}: MobileProfileHeaderProps) {
  const { currentUser, effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);
  const locale = getDateLocale(effectiveLanguage) ?? it;
  const now = useWallAlignedMinuteClock();

  if (!currentUser) return null;

  const pageTitle = getAppNavTabTitle(t, activeTab);
  const timeStr = format(now, 'HH:mm', { locale });
  const dateStr = format(now, 'EEE d MMM', { locale });
  const dateLong = format(now, 'EEEE d MMMM', { locale });

  const shellClass = parentProvidesCardShell
    ? `w-full ${showOnDesktop ? '' : 'md:hidden'} ${compact ? 'p-2' : ''}`
    : `relative rounded-2xl border border-slate-100 bg-white shadow-[0_4px_16px_-4px_rgba(45,90,39,0.14),0_2px_8px_-4px_rgba(15,23,42,0.08)] overflow-hidden ${embeddedInAppHeader ? 'mb-0' : 'mb-2'} ${showOnDesktop ? '' : 'md:hidden'} ${compact ? 'p-2' : ''}`;

  const body = compact ? (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 pr-1">
        <h1 className="font-logo-snell text-[15px] sm:text-[18px] text-accent tracking-tight leading-tight truncate">
          Osteria Basilico
        </h1>
        <h2 className="text-[14px] font-bold text-slate-900 tracking-tight leading-tight truncate mt-0.5">
          {pageTitle}
        </h2>
      </div>
      <p className="flex-shrink-0 text-[10px] text-slate-500 tabular-nums text-right leading-tight">
        {timeStr}
        <span className="text-slate-300 mx-0.5">·</span>
        {dateStr}
      </p>
    </div>
  ) : (
    <>
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 pr-1">
            <h1 className="font-logo-snell text-[16px] sm:text-[18px] text-accent tracking-tight leading-tight truncate">
              Osteria Basilico
            </h1>
            <h2 className="text-[14px] font-bold text-slate-900 tracking-tight leading-tight truncate mt-0.5">
              {pageTitle}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right min-w-0">
              <p className="text-base font-semibold text-slate-800 tabular-nums leading-none">{timeStr}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[6.5rem]" title={dateLong}>
                {dateStr}
              </p>
            </div>
            <UserAvatarMenu variant="toolbar" onLogout={onLogout} />
            <NotificationCenter denseTrigger />
          </div>
        </div>
      </div>
    </>
  );

  return <div className={shellClass}>{body}</div>;
}
