import { useLayoutEffect, useRef } from 'react';
import { Home, Calendar, Coffee, User } from 'lucide-react';
import type { AppNavTab } from '../../utils/enabledModules';

export interface MobileBottomNavProps {
  activeTab: AppNavTab;
  onNavigate: (tab: AppNavTab) => void;
  /** Tab visibili nell’app principale: nasconde le voci non abilitate. */
  visibleTabs: AppNavTab[];
  labels: { home: string; calendar: string; coffee: string; profile: string };
}

export default function MobileBottomNav({ activeTab, onNavigate, visibleTabs, labels }: MobileBottomNavProps) {
  const navRef = useRef<HTMLElement>(null);

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

  const vis = new Set(visibleTabs);

  const items: { tab: AppNavTab; icon: typeof Home; label: string }[] = [
    { tab: 'home', icon: Home, label: labels.home },
    { tab: 'turni', icon: Calendar, label: labels.calendar },
    { tab: 'ferie', icon: Coffee, label: labels.coffee },
    { tab: 'profile', icon: User, label: labels.profile },
  ];

  const shown = items.filter((i) => vis.has(i.tab));
  if (shown.length === 0) return null;

  return (
    <nav
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/80 bg-white/95 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-neutral-950/95 dark:shadow-[0_-8px_24px_-6px_rgba(0,0,0,0.4)] md:hidden"
      style={{
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
      }}
      aria-label="Navigazione rapida"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1 pt-2">
        {shown.map(({ tab, icon: Icon, label }) => {
          const on = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onNavigate(tab)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors ${
                on
                  ? 'text-accent dark:text-accent-light'
                  : 'text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              <Icon className="h-6 w-6 shrink-0" strokeWidth={on ? 2.5 : 2} aria-hidden />
              <span className="max-w-full truncate px-0.5 text-[10px] font-bold">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
