import { useRef, useEffect, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { getTranslations } from '../utils/translations';
import type { AppNavTab } from '../utils/enabledModules';

interface TopTabBarProps {
  activeTab: AppNavTab;
  onTabChange: (tab: AppNavTab) => void;
  visibleTabs: AppNavTab[];
  rightSlot?: ReactNode;
}

export default function TopTabBar({ activeTab, onTabChange, visibleTabs, rightSlot }: TopTabBarProps) {
  const { effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);
  const tv = t as Record<string, string>;
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const tabLabels: Record<AppNavTab, string> = {
    home: tv.home_dashboard_title ?? 'Home',
    turni: tv.sidebar_shifts ?? 'Turni',
    timesheet: tv.timesheet_title ?? 'Presenze',
    ferie: tv.sidebar_holidays ?? 'Ferie',
    profile: tv.bottom_nav_profile ?? tv.sidebar_profile ?? 'Profilo',
    reports: tv.sidebar_statistics ?? 'Report',
    settings: tv.bottom_nav_settings_title ?? 'Impostazioni',
  };

  const visible = new Set(visibleTabs);

  const defs: { id: AppNavTab; label: string }[] = [
    { id: 'home', label: tabLabels.home },
    { id: 'turni', label: tabLabels.turni },
    { id: 'timesheet', label: tabLabels.timesheet },
    { id: 'ferie', label: tabLabels.ferie },
    { id: 'profile', label: tabLabels.profile },
    { id: 'settings', label: tabLabels.settings },
  ];

  const tabs = defs.filter((d) => visible.has(d.id));

  // Scroll active tab into view
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      const containerLeft = container.getBoundingClientRect().left;
      const elLeft = el.getBoundingClientRect().left;
      const elRight = el.getBoundingClientRect().right;
      const containerRight = container.getBoundingClientRect().right;
      if (elLeft < containerLeft + 16 || elRight > containerRight - 16) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  return (
    <div
      ref={scrollRef}
      className="top-tabbar flex items-center overflow-x-auto scrollbar-none"
      style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '0 10px',
      }}
    >
      <div className="flex flex-1 overflow-x-auto scrollbar-none">
        {tabs.map(({ id, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              ref={isActive ? activeRef : null}
              type="button"
              onClick={() => onTabChange(id)}
              className="top-tab shrink-0 whitespace-nowrap"
              style={{
                padding: '13px 18px',
                fontSize: 13,
                fontWeight: 500,
                color: isActive ? 'white' : 'rgba(255,255,255,0.45)',
                background: 'none',
                border: 'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: isActive ? 'white' : 'transparent',
                cursor: 'pointer',
                letterSpacing: '0.3px',
                outline: 'none',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {rightSlot && (
        <div className="shrink-0 flex items-center ml-auto">
          {rightSlot}
        </div>
      )}
    </div>
  );
}
