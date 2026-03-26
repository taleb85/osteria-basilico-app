import { useLayoutEffect, useRef, useState, useCallback, useEffect } from 'react';
import { Home, Calendar, ClipboardList, Clock, ShieldCheck, Palmtree, User } from 'lucide-react';
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
  /** Tab visibili (ordine: dashboard, turni, ferie, presenze, ore, impostazioni). */
  visibleTabs: AppNavTab[];
}

export default function BottomNav({ activeTab, onTabChange, visibleTabs }: BottomNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const { effectiveLanguage, currentUser } = useApp();
  /** Contenuto che scorre sotto la nav fissa → vetro trasparente; altrimenti tinta piena rgb(45,90,39). */
  const [navOverContent, setNavOverContent] = useState(false);

  const updateNavOverlapMode = useCallback(() => {
    const scrollY = window.scrollY;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const docH = document.documentElement.scrollHeight;
    const epsilon = 16;
    const scrollBottom = scrollY + vh;
    const notScrollable = docH <= vh + epsilon;
    const atDocumentBottom = scrollBottom >= docH - epsilon;
    setNavOverContent(!notScrollable && !atDocumentBottom);
  }, []);

  /** Altezza barra → `--app-bottom-nav-offset` per toast / overlay sopra la bottom nav. */
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--app-bottom-nav-offset', `${h}px`);
      requestAnimationFrame(() => updateNavOverlapMode());
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
      document.documentElement.style.removeProperty('--app-bottom-nav-offset');
    };
  }, [updateNavOverlapMode]);

  useEffect(() => {
    updateNavOverlapMode();
    const onScroll = () => updateNavOverlapMode();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.visualViewport?.addEventListener('resize', updateNavOverlapMode);
    const docRo = new ResizeObserver(() => updateNavOverlapMode());
    docRo.observe(document.documentElement);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.visualViewport?.removeEventListener('resize', updateNavOverlapMode);
      docRo.disconnect();
    };
  }, [updateNavOverlapMode, activeTab, visibleTabs]);
  const t = getTranslations(effectiveLanguage);
  const profileThumb =
    currentUser &&
    (readProfileAvatarFromStorage(currentUser.id) ?? currentUser.avatar_url ?? null);
  const profileThumbFocus = currentUser ? readAvatarFocus(currentUser.id) : { x: 50, y: 50 };

  const visible = new Set(visibleTabs);
  const tv = t as Record<string, string>;
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

  const profileDisplayName =
    (currentUser?.first_name?.trim() || currentUser?.email?.split('@')[0] || 'Utente').trim() || 'Utente';
  const profileInitialNav = (profileDisplayName.charAt(0) || '?').toUpperCase();

  const defs: { id: AppNavTab; icon: typeof Home; label: string }[] = [
    { id: 'home', icon: Home, label: t.sidebar_dashboard },
    { id: 'turni', icon: Calendar, label: t.sidebar_shifts },
    { id: 'ferie', icon: Palmtree, label: t.sidebar_holidays },
    { id: 'timesheet', icon: ClipboardList, label: t.sidebar_attendance },
    { id: 'reports', icon: Clock, label: t.sidebar_statistics },
    { id: 'profile', icon: User, label: tv.bottom_nav_profile_short ?? t.sidebar_profile },
    { id: 'settings', icon: ShieldCheck, label: t.sidebar_admin },
  ];

  const tabs = defs.filter((d) => visible.has(d.id));
  const settingsShort = (t as { bottom_nav_settings_short?: string }).bottom_nav_settings_short;

  return (
    <nav
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
      }}
      aria-label="Navigazione principale"
    >
      <div className="w-full max-w-screen-xl mx-auto pointer-events-auto">
        {/* Barra flottante vetro sul brand — `.bottom-nav-glass` in index.css */}
        <div
          className={`bottom-nav-glass w-full rounded-[1.35rem] sm:rounded-[1.75rem] px-1 py-1.5 sm:px-2.5 sm:py-2${
            navOverContent ? ' bottom-nav-glass--over-content' : ''
          }`}
        >
          <div className="flex min-h-[44px] items-stretch justify-between gap-0.5 sm:min-h-[48px]">
            {tabs.map(({ id, icon: Icon, label }) => {
              const isActive = activeTab === id;
              const displayLabel =
                id === 'settings' && settingsShort
                  ? settingsShort
                  : id === 'profile' && profileNavLabel
                    ? profileNavLabel
                    : label;
              const showProfilePic = id === 'profile' && profileThumb;
              const showProfileInitial = id === 'profile' && currentUser && !profileThumb;
              const buttonTitle =
                id === 'profile' && profileTabTitle ? profileTabTitle : displayLabel;
              const ariaLabel =
                id === 'profile' && profileNavLabel
                  ? `${t.sidebar_profile}, ${profileNavLabel}`
                  : displayLabel;
              const isProfileTab = id === 'profile' && currentUser;
              const over = navOverContent;
              const profileNameLine =
                isProfileTab && profileNavLabel ? (
                  <span
                    className={`max-w-[4.25rem] sm:max-w-[7.5rem] truncate text-center text-[9px] sm:text-[11px] font-bold uppercase leading-tight tracking-tight ${
                      over
                        ? isActive
                          ? 'text-accent'
                          : 'text-accent/80'
                        : isActive
                          ? 'text-white'
                          : 'text-white/85'
                    }`}
                  >
                    {profileNavLabel}
                  </span>
                ) : null;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTabChange(id)}
                  title={buttonTitle}
                  aria-label={ariaLabel}
                  className={`keep-white-glass flex flex-1 min-w-0 min-h-[44px] sm:min-h-[48px] rounded-xl sm:rounded-2xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97] ${
                    over
                      ? 'text-accent/70 hover:bg-accent/12 hover:text-accent focus-visible:ring-accent/45 focus-visible:ring-offset-transparent'
                      : 'text-white/[0.78] hover:bg-white/10 hover:text-white/95 focus-visible:ring-white/35 focus-visible:ring-offset-[rgb(45,90,39)]'
                  } ${
                    isProfileTab
                      ? 'flex-col items-center justify-center gap-0.5 px-0.5 py-1 sm:flex-row sm:gap-1.5 sm:px-1.5 sm:py-1.5'
                      : 'items-center justify-center px-0.5 py-1.5'
                  }`}
                >
                  {showProfilePic ? (
                    <span
                      className={`flex h-[22px] w-[22px] sm:h-6 sm:w-6 shrink-0 items-center justify-center overflow-hidden rounded-md transition-transform duration-200 ${
                        over
                          ? isActive
                            ? 'scale-110 ring-2 ring-accent ring-offset-1 ring-offset-transparent'
                            : 'opacity-95 ring-1 ring-accent/35'
                          : isActive
                            ? 'scale-110 ring-2 ring-white ring-offset-1 ring-offset-[rgb(45,90,39)]'
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
                  ) : showProfileInitial ? (
                    <span
                      className={`flex h-[22px] w-[22px] sm:h-6 sm:w-6 shrink-0 items-center justify-center overflow-hidden rounded-md text-[11px] sm:text-xs font-bold transition-transform duration-200 ${
                        over
                          ? isActive
                            ? 'scale-110 border border-accent/50 bg-accent/15 text-accent ring-2 ring-accent ring-offset-1 ring-offset-transparent'
                            : 'border border-accent/30 bg-accent/10 text-accent/90 ring-1 ring-accent/25'
                          : isActive
                            ? 'border border-white/35 bg-white/10 text-white scale-110 ring-2 ring-white ring-offset-1 ring-offset-[rgb(45,90,39)]'
                            : 'border border-white/35 bg-white/10 text-white opacity-95 ring-1 ring-white/25'
                      }`}
                      aria-hidden
                    >
                      {profileInitialNav}
                    </span>
                  ) : (
                    <Icon
                      className={`h-[22px] w-[22px] sm:h-6 sm:w-6 flex-shrink-0 transition-[transform,color] duration-200 ${
                        over
                          ? isActive
                            ? 'scale-110 text-accent drop-shadow-[0_0_14px_rgba(45,90,39,0.55)]'
                            : 'text-accent/60'
                          : isActive
                            ? 'scale-110 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.35)]'
                            : 'text-white/55'
                      }`}
                      strokeWidth={isActive ? 2.45 : 1.45}
                      aria-hidden
                    />
                  )}
                  {profileNameLine}
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
