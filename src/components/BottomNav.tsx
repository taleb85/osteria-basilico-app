import { Home, Calendar, ClipboardList, BarChart3, ShieldCheck, Palmtree, User } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations } from '../utils/translations';
import type { AppNavTab } from '../utils/enabledModules';
import {
  readProfileAvatarFromStorage,
  readAvatarFocus,
  avatarFocusToObjectPosition,
} from '../utils/profilePhotoStorage';

interface BottomNavProps {
  activeTab: AppNavTab;
  onTabChange: (tab: AppNavTab) => void;
  /** Tab visibili (ordine: dashboard, turni, ferie, presenze, statistiche, impostazioni). */
  visibleTabs: AppNavTab[];
}

export default function BottomNav({ activeTab, onTabChange, visibleTabs }: BottomNavProps) {
  const { effectiveLanguage, currentUser } = useApp();
  const t = getTranslations(effectiveLanguage);
  const profileThumb =
    currentUser &&
    (readProfileAvatarFromStorage(currentUser.id) ?? currentUser.avatar_url ?? null);
  const profileThumbFocus = currentUser ? readAvatarFocus(currentUser.id) : { x: 50, y: 50 };

  const visible = new Set(visibleTabs);
  const tv = t as Record<string, string>;
  /** Solo nome di battesimo sotto l’icona (fallback email se manca il nome). */
  const profileNavLabel = currentUser
    ? (currentUser.first_name ?? '').trim() || currentUser.email
    : '';
  const profileFullName =
    currentUser &&
    [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ').trim();
  const profileTabTitle =
    currentUser && profileNavLabel
      ? profileFullName
        ? `${t.sidebar_profile}: ${profileFullName} (${currentUser.email})`
        : `${t.sidebar_profile}: ${currentUser.email}`
      : '';

  const defs: { id: AppNavTab; icon: typeof Home; label: string }[] = [
    { id: 'home', icon: Home, label: t.sidebar_dashboard },
    { id: 'turni', icon: Calendar, label: t.sidebar_shifts },
    { id: 'ferie', icon: Palmtree, label: t.sidebar_holidays },
    { id: 'timesheet', icon: ClipboardList, label: t.sidebar_attendance },
    { id: 'reports', icon: BarChart3, label: t.sidebar_statistics },
    { id: 'profile', icon: User, label: tv.bottom_nav_profile_short ?? t.sidebar_profile },
    { id: 'settings', icon: ShieldCheck, label: t.sidebar_admin },
  ];

  const tabs = defs.filter((d) => visible.has(d.id));
  const settingsShort = (t as { bottom_nav_settings_short?: string }).bottom_nav_settings_short;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
      }}
      aria-label="Navigazione principale"
    >
      <div className="w-full max-w-screen-xl mx-auto pointer-events-auto">
        {/* Barra flottante: #2D5A27, angoli arrotondati ovunque, ombra sotto (come mock PWA) */}
        <div
          className="w-full rounded-[1.35rem] sm:rounded-[1.75rem] py-1.5 px-1 sm:py-2 sm:px-2.5 shadow-[0_12px_40px_-4px_rgba(0,0,0,0.28),0_4px_16px_-4px_rgba(0,0,0,0.15)]"
          style={{ backgroundColor: '#2D5A27' }}
        >
          <div className="flex justify-between items-stretch gap-0.5 min-h-[48px] sm:min-h-[54px]">
            {tabs.map(({ id, icon: Icon, label }) => {
              const isActive = activeTab === id;
              const displayLabel =
                id === 'settings' && settingsShort
                  ? settingsShort
                  : id === 'profile' && profileNavLabel
                    ? profileNavLabel
                    : label;
              const showProfilePic = id === 'profile' && profileThumb;
              const buttonTitle =
                id === 'profile' && profileTabTitle ? profileTabTitle : label;
              const profileAriaLabel =
                id === 'profile' && profileNavLabel
                  ? `${t.sidebar_profile}, ${profileNavLabel}`
                  : undefined;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTabChange(id)}
                  title={buttonTitle}
                  aria-label={profileAriaLabel}
                  className="keep-white-glass flex-1 min-w-0 min-h-[46px] sm:min-h-[50px] rounded-xl sm:rounded-2xl flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-0.5 py-1 text-white/[0.78] transition-all duration-200 hover:bg-white/10 hover:text-white/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D5A27] active:scale-[0.97]"
                >
                  {showProfilePic ? (
                    <span
                      className={`flex h-[22px] w-[22px] sm:h-6 sm:w-6 shrink-0 items-center justify-center overflow-hidden rounded-md transition-transform duration-200 ${
                        isActive
                          ? 'scale-110 ring-2 ring-white ring-offset-1 ring-offset-[#2D5A27]'
                          : 'opacity-90 ring-1 ring-white/20'
                      }`}
                    >
                      <img
                        src={profileThumb}
                        alt=""
                        className="h-full w-full object-cover"
                        style={{ objectPosition: avatarFocusToObjectPosition(profileThumbFocus) }}
                        draggable={false}
                      />
                    </span>
                  ) : (
                    <Icon
                      className={`h-[22px] w-[22px] sm:h-6 sm:w-6 flex-shrink-0 transition-[transform,color] duration-200 ${
                        isActive ? 'scale-110 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.35)]' : 'text-white/55'
                      }`}
                      strokeWidth={isActive ? 2.45 : 1.45}
                      aria-hidden
                    />
                  )}
                  <span className="text-[7px] sm:text-[10px] font-semibold tracking-tight leading-[1.1] text-center normal-case max-w-full line-clamp-2 break-words hyphens-auto px-0.5 text-white/[0.72]">
                    {displayLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <span className="sr-only" title={t.version}>
          v{__APP_VERSION__}
        </span>
      </div>
    </nav>
  );
}
