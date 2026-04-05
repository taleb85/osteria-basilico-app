import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Settings, LayoutList, Menu, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isAdminOnly, canEditRoleFeatureTemplates } from '../utils/permissions';
import { getTranslations } from '../utils/translations';
import SettingsPage from './SettingsPage';
import ImpostazioniPage from './ImpostazioniPage';

import BottomNav from './BottomNav';
import { getBottomNavTabsForMainApp } from '../utils/enabledModules';

type AdminTab = 'profili' | 'impostazioni';

/** `overflow-visible` così il pannello del menu hamburger non viene tagliato dal bordo arrotondato. */
const adminHeaderCardClass =
  'w-full rounded-2xl border border-slate-100 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 shadow-[0_4px_16px_-4px_rgba(0,26,128,0.10),0_2px_8px_-4px_rgba(15,23,42,0.08)] dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.35)] overflow-visible supports-[backdrop-filter]:backdrop-blur-lg supports-[backdrop-filter]:backdrop-saturate-150';

export default function AdminLayout() {
  const navigate = useNavigate();
  const { currentUser, silentRefreshData, effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);
  const [activeTab, setActiveTab] = useState<AdminTab>('profili');
  const [adminNavOpen, setAdminNavOpen] = useState(false);
  const fullAdminNav = currentUser && isAdminOnly(currentUser);
  const showAdminNav = fullAdminNav || (currentUser && canEditRoleFeatureTemplates(currentUser));

  const handleTabChange = useCallback((tab: AdminTab) => {
    setActiveTab(tab);
    /** Storage (template ruoli, moduli admin, flag): altrimenti telefono resta su localStorage vecchio ≠ PC. */
    void silentRefreshData({ pullRemoteConfig: true });
  }, [silentRefreshData]);

  const selectAdminTab = useCallback(
    (tab: AdminTab) => {
      handleTabChange(tab);
      setAdminNavOpen(false);
    },
    [handleTabChange],
  );

  useEffect(() => {
    if (!adminNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAdminNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [adminNavOpen]);

  useEffect(() => {
    void silentRefreshData({ pullRemoteConfig: true });
  }, [silentRefreshData]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void silentRefreshData({ pullRemoteConfig: true });
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pageshow', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pageshow', onVis);
    };
  }, [silentRefreshData]);

  useEffect(() => {
    if (fullAdminNav) return;
    if (activeTab === 'impostazioni') {
      setActiveTab('profili');
    }
  }, [fullAdminNav, activeTab]);

  const bottomNavTabs = useMemo(() => {
    if (!currentUser) return ['home'];
    return getBottomNavTabsForMainApp(currentUser, true, null);
  }, [currentUser]);

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#f8fafc] dark:bg-[#0a0a0a] text-[#1a1a1a] dark:text-neutral-100 font-sans antialiased flex flex-col safe-area-pad overflow-x-clip">
      <header
        className={`sticky top-0 shrink-0 pt-[max(6px,env(safe-area-inset-top,0px))] app-horizontal-pad pb-2 ${adminNavOpen && showAdminNav ? 'z-[150]' : 'z-40'}`}
      >
        {adminNavOpen && showAdminNav && (
          <button
            type="button"
            className="fixed inset-0 z-0 bg-slate-900/25 dark:bg-black/50"
            aria-label={t.close}
            onClick={() => setAdminNavOpen(false)}
          />
        )}
        <div className={`${adminHeaderCardClass} relative z-[1]`}>
          <div className="flex items-center justify-between gap-3 sm:gap-4 px-3 sm:px-4 py-2.5">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="flex items-center gap-2 min-h-[44px] px-2 -ml-1 rounded-xl text-slate-600 hover:text-accent hover:bg-accent/[0.07] font-medium text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4 shrink-0 text-accent/80" />
              {t.admin_back_to_app}
            </button>
            {showAdminNav && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setAdminNavOpen((o) => !o)}
                  aria-expanded={adminNavOpen}
                  aria-controls="admin-layout-nav-menu"
                  aria-label={t.admin_nav_menu_aria}
                  className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border px-3 text-slate-700 transition-colors dark:text-neutral-200 ${
                    adminNavOpen
                      ? 'border-accent/30 bg-accent/[0.08] text-accent dark:bg-accent/15 dark:text-accent-light'
                      : 'border-slate-200/70 bg-slate-100/90 hover:border-slate-200 hover:bg-slate-50/95 dark:border-white/10 dark:bg-neutral-800 dark:hover:border-white/15 dark:hover:bg-neutral-700'
                  }`}
                >
                  {adminNavOpen ? <X className="h-5 w-5 shrink-0" aria-hidden /> : <Menu className="h-5 w-5 shrink-0" aria-hidden />}
                </button>
                {adminNavOpen && (
                    <nav
                      id="admin-layout-nav-menu"
                      role="menu"
                      aria-label={t.admin_nav_menu_aria}
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-[2] flex max-h-[min(70vh,32rem)] w-[min(calc(100vw-2rem),22rem)] flex-col gap-1 overflow-y-auto surface-glass-sm bg-slate-50/95 p-2 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] backdrop-blur-md dark:bg-neutral-900/95 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)]"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => selectAdminTab('profili')}
                        className={`flex w-full min-h-[44px] items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold transition-colors ${
                          activeTab === 'profili'
                            ? 'bg-accent/[0.08] text-accent ring-1 ring-accent/20 dark:bg-accent/15 dark:text-accent-light'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-50'
                        }`}
                      >
                        <Users className={`h-3.5 w-3.5 shrink-0 ${activeTab === 'profili' ? 'text-accent' : ''}`} />
                        {t.admin_nav_profiles}
                      </button>
                      {fullAdminNav && (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => selectAdminTab('impostazioni')}
                            className={`flex w-full min-h-[44px] items-center gap-2 rounded-lg px-3 text-left text-xs font-semibold transition-colors ${
                              activeTab === 'impostazioni'
                                ? 'bg-accent/[0.08] text-accent ring-1 ring-accent/20 dark:bg-accent/15 dark:text-accent-light'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-50'
                            }`}
                          >
                            <Settings className={`h-3.5 h-3.5 shrink-0 ${activeTab === 'impostazioni' ? 'text-accent' : ''}`} />
                            {t.admin_nav_settings}
                          </button>
                        </>
                      )}
                    </nav>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {/* Montate tutte e due: evita reset di stato non salvato cambiando tab o uscendo/entrando dalla stessa scheda */}
        <div className={activeTab === 'profili' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'profili'}>
          <SettingsPage />
        </div>
        <div className={activeTab === 'impostazioni' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'impostazioni'}>
          <ImpostazioniPage onOpenProfilesTab={() => handleTabChange('profili')} />
        </div>
      </main>

      <BottomNav
        activeTab="settings"
        onTabChange={(tab) => {
          if (tab !== 'settings') navigate('/app');
        }}
        visibleTabs={bottomNavTabs as any}
      />
    </div>
  );
}
