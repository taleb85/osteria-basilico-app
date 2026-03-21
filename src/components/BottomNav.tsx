import { useState, useEffect, useRef } from 'react';
import { Home, Calendar, ClipboardList, BarChart3, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations } from '../utils/translations';
import type { AppNavTab } from '../utils/enabledModules';

const SCROLL_THRESHOLD = 40;

interface BottomNavProps {
  activeTab: AppNavTab;
  onTabChange: (tab: AppNavTab) => void;
  /** Tab visibili (ordine fisso: dashboard, turni, presenze, statistiche, impostazioni). */
  visibleTabs: AppNavTab[];
}

export default function BottomNav({ activeTab, onTabChange, visibleTabs }: BottomNavProps) {
  const { effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);
  const [scrollCompact, setScrollCompact] = useState(false);
  const lastScrollTop = useRef(0);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const st = window.scrollY ?? document.documentElement.scrollTop;
          const scrollingDown = st > lastScrollTop.current;
          if (scrollingDown && st > SCROLL_THRESHOLD) {
            setScrollCompact(true);
          } else if (!scrollingDown) {
            setScrollCompact(false);
          }
          lastScrollTop.current = st;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const visible = new Set(visibleTabs);
  const defs: { id: AppNavTab; icon: typeof Home; label: string }[] = [
    { id: 'home', icon: Home, label: t.sidebar_dashboard },
    { id: 'turni', icon: Calendar, label: t.sidebar_shifts },
    { id: 'timesheet', icon: ClipboardList, label: t.sidebar_attendance },
    { id: 'reports', icon: BarChart3, label: t.sidebar_statistics },
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
      <div
        className="w-full max-w-screen-xl mx-auto pointer-events-auto transition-all duration-300 ease-out"
        style={{
          transform: scrollCompact ? 'translateY(calc(100% + 1.25rem))' : 'translateY(0)',
          opacity: scrollCompact ? 0 : 1,
          pointerEvents: scrollCompact ? 'none' : 'auto',
        }}
      >
        {/* Barra flottante: #2D5A27, angoli arrotondati ovunque, ombra sotto (come mock PWA) */}
        <div
          className="w-full rounded-[1.35rem] sm:rounded-[1.75rem] border border-white/12 py-2 px-2 sm:px-3 shadow-[0_12px_40px_-4px_rgba(0,0,0,0.28),0_4px_16px_-4px_rgba(0,0,0,0.15)]"
          style={{ backgroundColor: '#2D5A27' }}
        >
          <div className="flex justify-between items-stretch gap-0 min-h-[52px] sm:min-h-[56px]">
            {tabs.map(({ id, icon: Icon, label }) => {
              const isActive = activeTab === id;
              const displayLabel = id === 'settings' && settingsShort ? settingsShort : label;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTabChange(id)}
                  title={label}
                  className={`flex-1 min-w-0 min-h-[48px] rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D5A27] active:scale-[0.97] px-1 py-1.5 ${
                    isActive
                      ? 'bg-white/[0.22] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                      : 'text-white/[0.88] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon
                    className="w-[19px] h-[19px] sm:w-5 sm:h-5 flex-shrink-0"
                    strokeWidth={isActive ? 2.1 : 1.45}
                    aria-hidden
                  />
                  <span className="text-[9px] sm:text-[10px] font-semibold tracking-tight leading-tight text-center normal-case max-w-full truncate px-0.5">
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
