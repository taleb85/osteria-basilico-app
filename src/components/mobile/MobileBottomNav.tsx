import { useLayoutEffect, useRef } from 'react';
import { Home, Calendar, Palmtree, ClipboardList, Clock, User } from 'lucide-react';
import type { AppNavTab } from '../../utils/enabledModules';
import { useApp } from '../../context/AppContext';

export interface MobileBottomNavProps {
  activeTab: AppNavTab;
  onNavigate: (tab: AppNavTab) => void;
  /** Tab visibili nell’app principale: nasconde le voci non abilitate. */
  visibleTabs: AppNavTab[];
  labels: { 
    home: string; 
    calendar: string; 
    coffee: string; 
    profile: string;
    reports?: string;
    timesheet?: string;
  };
  onLogout?: () => void;
}

/**
 * Mobile Bottom Navigation: White PC Style (Solid White, Fixed at Bottom).
 * Design: Foto 2 Style (Full width, white background, border-t).
 * Icons: Home, Turni, Ferie, Ore, Presenze, Profilo.
 */
export default function MobileBottomNav({ activeTab, onNavigate, visibleTabs, labels }: MobileBottomNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const { featureFlags, currentUser } = useApp();

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty('--app-bottom-nav-offset', `${h}px`);
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
  }, [visibleTabs, activeTab]);

  const profileDisplayName = (currentUser?.first_name?.trim() || currentUser?.email?.split('@')[0] || 'Utente').toUpperCase();

  // Ordine rigoroso: Home, Turni, Ferie, Ore, Presenze, Profilo
  const items: { tab: AppNavTab; icon: any; label: string; feature?: string }[] = [
    { tab: 'home', icon: Home, label: labels.home },
    { tab: 'turni', icon: Calendar, label: labels.calendar },
    { tab: 'ferie', icon: Palmtree, label: labels.coffee, feature: 'staff_requests' },
    { tab: 'reports', icon: ClipboardList, label: labels.reports || 'Ore' },
    { tab: 'timesheet', icon: Clock, label: labels.timesheet || 'Presenze' },
    { tab: 'profile', icon: User, label: profileDisplayName },
  ];

  const vis = new Set(visibleTabs);
  const shown = items.filter((i) => {
    if (i.tab === 'profile' || i.tab === 'home') return true;
    if (!vis.has(i.tab)) return false;
    if (i.feature && featureFlags?.[i.feature] === false) return false;
    return true;
  });

  if (shown.length === 0) return null;

  return (
    <nav
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 h-20 border-t border-white/10 flex justify-around items-stretch px-2 z-[100] md:hidden safe-area-pb bg-app-bg/92 backdrop-blur-[20px]"
      aria-label="Navigazione principale mobile"
    >
      {shown.map(({ tab, icon: Icon, label }) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onNavigate(tab)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex h-full min-h-[48px] min-w-[48px] flex-col items-center justify-center flex-1 transition-colors duration-200 gap-1 py-2 ${
              isActive
                ? 'text-accent'
                : 'text-white/50'
            }`}
          >
            <Icon
              className={`h-[26px] w-[26px] shrink-0 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
              strokeWidth={isActive ? 2.5 : 2}
              aria-hidden
            />
            <span className={`text-[11px] font-bold uppercase tracking-tight truncate max-w-full text-center font-sans leading-none ${isActive ? 'opacity-100' : 'opacity-60'}`} title={label}>{label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
