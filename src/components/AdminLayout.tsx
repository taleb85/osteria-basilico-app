import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useT } from '../hooks/useT';
import { isAdminOnly } from '../utils/permissions';
import SettingsPage from './SettingsPage';
import ImpostazioniPage from './ImpostazioniPage';

type AdminTab = 'profili' | 'impostazioni';

const adminHeaderCardClass =
  'w-full rounded-2xl border border-white/12 overflow-visible';

interface TabDef {
  key: AdminTab;
  icon: typeof Users;
  label: string;
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const { currentUser, silentRefreshData, isSessionElevated } = useApp();
  const t = useT();
  const fullAdminNav = !!(currentUser && (isAdminOnly(currentUser) || isSessionElevated || currentUser.elevated_role));
  const [activeTab, setActiveTab] = useState<AdminTab>('profili');

  const handleTabChange = useCallback((tab: AdminTab) => {
    setActiveTab(tab);
    void silentRefreshData({ pullRemoteConfig: true });
  }, [silentRefreshData]);

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
    if (activeTab !== 'profili') {
      setActiveTab('profili');
    }
  }, [fullAdminNav, activeTab]);

  const tabs: TabDef[] = useMemo(() => [
    { key: 'profili', icon: Users, label: t.admin_tab_profiles },
    { key: 'impostazioni', icon: Settings, label: t.settings_title },
  ], [t]);

  return (
    <div className="min-h-screen min-h-[100dvh] w-full text-white font-sans antialiased flex flex-col safe-area-pad overflow-x-clip page-depth-bg">
      <header className="sticky top-0 z-40 shrink-0 pt-[max(6px,env(safe-area-inset-top,0px))] app-horizontal-pad pb-2">
        <div className={`${adminHeaderCardClass}`}>
          <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2">
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="flex items-center gap-1.5 min-h-[36px] px-2 -ml-1 rounded-xl text-white/70 hover:text-white hover:bg-white/10 font-medium text-sm transition-colors shrink-0 active:text-white"
            >
              <ArrowLeft className="w-4 h-4 shrink-0 text-accent/70" />
              <span className="hidden sm:inline">{t.admin_back_to_app}</span>
            </button>

            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar" aria-label="Sezioni pannello admin">
              {tabs.map(({ key, icon: Icon, label }) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTabChange(key)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-accent text-white shadow-sm'
                        : 'text-white/60 hover:bg-white/10 hover:text-white active:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="sm:hidden">{key === 'profili' ? 'Profili' : 'Impost.'}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-6">
        <div className="mx-auto w-full max-w-7xl">
          {activeTab === 'profili' && (
            <SettingsPage view="profili" />
          )}
          {activeTab === 'impostazioni' && (
            <div className="space-y-6">
              {fullAdminNav && (
                <div className="rounded-2xl border border-white/12 overflow-hidden">
                  <div className="px-4 pt-3 pb-1">
                    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/50">
                      {t.admin_tab_rules}
                    </h2>
                  </div>
                  <SettingsPage view="regole" />
                </div>
              )}
              <ImpostazioniPage onOpenProfilesTab={() => handleTabChange('profili')} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
