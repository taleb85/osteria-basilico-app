import { useLayoutEffect, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Home, Calendar, ClipboardList, Clock, ShieldCheck, Palmtree, User, Search, X, Delete } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations } from '../utils/translations';
import type { AppNavTab } from '../utils/enabledModules';
import {
  readProfileAvatarFromStorage,
  readAvatarFocus,
  avatarFocusToObjectPosition,
} from '../utils/profilePhotoStorage';
import { isAdminOnly } from '../utils/permissions';
import { CenteredModalPortal } from './ui/CenteredModalPortal';

interface BottomNavProps {
  activeTab: AppNavTab;
  onTabChange: (tab: AppNavTab) => void;
  /** Tab visibili (ordine: dashboard, turni, ferie, presenze, ore, impostazioni). */
  visibleTabs: AppNavTab[];
  /** Classi aggiuntive sul `<nav>` (es. `max-md:hidden` per sostituire con nav dedicata). */
  navClassName?: string;
}

export default function BottomNav({ activeTab, onTabChange, visibleTabs, navClassName }: BottomNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const { effectiveLanguage, currentUser, users, setCurrentUser } = useApp();
  /** Contenuto che scorre sotto la nav fissa → vetro trasparente; altrimenti tinta piena rgb(45,90,39). */
  const [navOverContent, setNavOverContent] = useState(false);

  // Stato per il cambio rapido utente
  const [isQuickSwitchOpen, setIsQuickSwitchOpen] = useState(false);
  const [quickSwitchSearch, setQuickSwitchSearch] = useState('');
  const [pendingSwitchUser, setPendingSwitchUser] = useState<any>(null);
  const [switchPin, setSwitchPin] = useState('');
  const [switchError, setSwitchError] = useState('');
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const t = getTranslations(effectiveLanguage);

  const handleLongPressStart = useCallback((id: AppNavTab) => {
    if (id !== 'profile' || !currentUser) return;
    
    longPressTimerRef.current = setTimeout(() => {
      setIsQuickSwitchOpen(true);
      setQuickSwitchSearch('');
      setPendingSwitchUser(null);
      setSwitchPin('');
      setSwitchError('');
      // Feedback aptico se supportato
      if ('vibrate' in navigator) navigator.vibrate(10);
    }, 600);
  }, [currentUser]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleSelectUserForSwitch = (user: any) => {
    setPendingSwitchUser(user);
    setSwitchPin('');
    setSwitchError('');
  };

  const handleVerifyPinAndSwitch = useCallback(() => {
    if (!pendingSwitchUser) return;
    if (switchPin === pendingSwitchUser.pin) {
      setCurrentUser(pendingSwitchUser);
      setIsQuickSwitchOpen(false);
      setPendingSwitchUser(null);
      setSwitchPin('');
    } else {
      setSwitchError(t.pin_invalid || 'PIN non valido');
      setSwitchPin('');
      setTimeout(() => setSwitchError(''), 2000);
    }
  }, [pendingSwitchUser, switchPin, setCurrentUser, t.pin_invalid]);

  useEffect(() => {
    if (switchPin.length === 4 && pendingSwitchUser) {
      handleVerifyPinAndSwitch();
    }
  }, [switchPin, pendingSwitchUser, handleVerifyPinAndSwitch]);

  const filteredUsers = useMemo(() => {
    const q = quickSwitchSearch.toLowerCase().trim();
    return users
      .filter(u => u.status === 'active')
      .filter(u => {
        if (!q) return true;
        const fullName = `${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase();
        return fullName.includes(q) || (u.email ?? '').toLowerCase().includes(q);
      })
      .sort((a, b) => (a.first_name ?? '').localeCompare(b.first_name ?? ''));
  }, [users, quickSwitchSearch]);

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
      // Con `max-md:hidden` l’altezza è 0: non sovrascrivere — altra barra (es. mobile home staff) imposta l’offset.
      if (h < 8) return;
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
  }, [updateNavOverlapMode, navClassName]);

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
    { id: 'reports', icon: Clock, label: t.sidebar_statistics },
    { id: 'timesheet', icon: ClipboardList, label: t.sidebar_attendance },
    { id: 'profile', icon: User, label: tv.bottom_nav_profile_short ?? t.sidebar_profile },
    { id: 'settings', icon: ShieldCheck, label: t.sidebar_admin },
  ];

  const tabs = defs.filter((d) => visible.has(d.id));
  const settingsShort = (t as { bottom_nav_settings_short?: string }).bottom_nav_settings_short;

  return (
    <nav
      ref={navRef}
      className={`fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none font-sans ${navClassName ?? ''}`}
      style={{
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
      }}
      aria-label="Navigazione principale"
    >
      <div className="w-full max-w-screen-xl mx-auto pointer-events-auto pb-safe">
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
              const over = navOverContent;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTabChange(id)}
                  onMouseDown={() => handleLongPressStart(id)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  onTouchStart={() => handleLongPressStart(id)}
                  onTouchEnd={handleLongPressEnd}
                  title={buttonTitle}
                  aria-label={ariaLabel}
                  className={`keep-white-glass flex flex-1 min-w-0 min-h-[44px] sm:min-h-[48px] rounded-xl sm:rounded-2xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97] items-center justify-center px-0.5 py-1.5 ${
                    over
                      ? 'text-accent/70 dark:text-neutral-400 hover:bg-accent/12 dark:hover:bg-white/10 hover:text-accent dark:hover:text-white focus-visible:ring-accent/45 focus-visible:ring-offset-transparent'
                      : 'text-white/[0.78] hover:bg-white/10 hover:text-white/95 focus-visible:ring-white/35 focus-visible:ring-offset-[rgb(45,90,39)]'
                  }`}
                >
                  {showProfilePic ? (
                    <span
                      className={`flex h-[22px] w-[22px] sm:h-6 sm:w-6 shrink-0 items-center justify-center overflow-hidden rounded-md transition-transform duration-200 ${
                        over
                          ? isActive
                            ? 'scale-110 ring-2 ring-accent dark:ring-white ring-offset-1 ring-offset-transparent'
                            : 'opacity-95 ring-1 ring-accent/35 dark:ring-white/30'
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
                            ? 'scale-110 border border-accent/50 dark:border-white/50 bg-accent/15 dark:bg-white/15 text-accent dark:text-white ring-2 ring-accent dark:ring-white ring-offset-1 ring-offset-transparent'
                            : 'border border-accent/30 dark:border-white/30 bg-accent/10 dark:bg-white/10 text-accent/90 dark:text-white/90 ring-1 ring-accent/25 dark:ring-white/25'
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
                            ? 'scale-110 text-accent dark:text-white drop-shadow-[0_0_14px_rgba(45,90,39,0.55)] dark:drop-shadow-[0_0_14px_rgba(255,255,255,0.25)]'
                            : 'text-accent/60 dark:text-neutral-400'
                          : isActive
                            ? 'scale-110 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.35)]'
                            : 'text-white/55'
                      }`}
                      strokeWidth={isActive ? 2.45 : 1.45}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <span className="sr-only" title={t.version}>
          v{__APP_VERSION__}
        </span>
      </div>

      <CenteredModalPortal
        open={isQuickSwitchOpen}
        onClose={() => setIsQuickSwitchOpen(false)}
        ariaLabel="Cambio rapido utente"
        maxWidthClass="max-w-md"
        panelClassName="p-0 !bg-white/70 dark:!bg-neutral-900/70 backdrop-blur-2xl border-white/20 dark:border-white/10"
      >
        <div className="flex flex-col h-full max-h-[80vh]">
          <div className="p-4 border-b border-slate-200/30 dark:border-white/10 sticky top-0 bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md z-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-neutral-50 uppercase tracking-tight">
                {pendingSwitchUser ? `Inserisci PIN per ${pendingSwitchUser.first_name}` : 'Cambio rapido utente'}
              </h3>
              <button
                onClick={() => {
                  if (pendingSwitchUser) setPendingSwitchUser(null);
                  else setIsQuickSwitchOpen(false);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {!pendingSwitchUser && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={quickSwitchSearch}
                  onChange={(e) => setQuickSwitchSearch(e.target.value)}
                  placeholder="Cerca dipendente..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-neutral-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-accent/20 outline-none"
                />
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {pendingSwitchUser ? (
              <div className="p-4 space-y-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-xl border-2 border-accent/30 bg-accent/10 text-accent flex items-center justify-center text-2xl font-bold ring-2 ring-accent/20 overflow-hidden">
                    {(() => {
                      const u = pendingSwitchUser;
                      const uThumb = readProfileAvatarFromStorage(u.id) ?? u.avatar_url ?? null;
                      const uThumbFocus = readAvatarFocus(u.id);
                      if (uThumb) {
                        return (
                          <img
                            src={uThumb}
                            alt=""
                            className="h-full w-full object-cover"
                            style={{ objectPosition: avatarFocusToObjectPosition(uThumbFocus) }}
                          />
                        );
                      }
                      return (pendingSwitchUser.first_name?.[0] || '?').toUpperCase();
                    })()}
                  </div>
                  <p className="text-lg font-bold text-slate-900 dark:text-neutral-50">
                    {pendingSwitchUser.first_name} {pendingSwitchUser.last_name}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="flex gap-3 justify-center">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                          switchPin.length > i
                            ? 'bg-accent border-accent scale-110'
                            : 'border-slate-300 dark:border-neutral-600'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-3 w-full max-w-[240px] mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del'].map((n, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (n === 'del') setSwitchPin(p => p.slice(0, -1));
                          else if (typeof n === 'number' && switchPin.length < 4) setSwitchPin(p => p + String(n));
                        }}
                        className={`aspect-square rounded-xl flex items-center justify-center text-xl font-bold transition-all ${
                          n === null ? 'invisible' : 'bg-slate-50 dark:bg-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-700 active:scale-95'
                        }`}
                      >
                        {n === 'del' ? <Delete className="w-6 h-6" /> : n}
                      </button>
                    ))}
                  </div>
                  
                  {switchError && (
                    <p className="text-red-500 text-sm font-bold animate-shake text-center">
                      {switchError}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                {filteredUsers.map((u) => {
                  const uThumb = readProfileAvatarFromStorage(u.id) ?? u.avatar_url ?? null;
                  const uThumbFocus = readAvatarFocus(u.id);
                  const uInitial = (u.first_name?.[0] || '?').toUpperCase();
                  
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUserForSwitch(u)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${
                        currentUser?.id === u.id 
                          ? 'bg-accent/10 text-accent' 
                          : 'hover:bg-slate-50 dark:hover:bg-neutral-800/50 text-slate-700 dark:text-neutral-200'
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-accent/30 bg-accent/10 text-accent/90 ring-1 ring-accent/25 shadow-sm transition-transform duration-200">
                        {uThumb ? (
                          <img
                            src={uThumb}
                            alt=""
                            className="h-full w-full object-cover"
                            style={{ objectPosition: avatarFocusToObjectPosition(uThumbFocus) }}
                          />
                        ) : (
                          <span className="text-sm font-bold">
                            {uInitial}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">
                          {u.first_name} {u.last_name}
                        </p>
                        <p className="text-[11px] opacity-60 truncate">
                          {u.email}
                        </p>
                      </div>
                      {currentUser?.id === u.id && (
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                      )}
                    </button>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Nessun dipendente trovato
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </CenteredModalPortal>
    </nav>
  );
}
