import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Settings, LayoutList } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useT } from '../hooks/useT';
import { isAdminOnly, canEditRoleFeatureTemplates } from '../utils/permissions';
import { getTranslations } from '../utils/translations';
import SettingsPage from './SettingsPage';
import ImpostazioniPage from './ImpostazioniPage';

type AdminTab = 'profili' | 'regole' | 'impostazioni';

/** `overflow-visible` così il pannello del menu hamburger non viene tagliato dal bordo arrotondato. */
const adminHeaderCardClass =
  'w-full rounded-2xl border border-white/12 overflow-visible supports-[backdrop-filter]:backdrop-blur-lg supports-[backdrop-filter]:backdrop-saturate-150';

export default function AdminLayout() {
  const navigate = useNavigate();
  const { currentUser, silentRefreshData, effectiveLanguage, isSessionElevated } = useApp();
  const t = useT();
  // Accesso completo: admin puro OPPURE sessione elevata via PIN secondario
  const fullAdminNav = !!(currentUser && (isAdminOnly(currentUser) || isSessionElevated || currentUser.elevated_role));
  const _showAdminNav = fullAdminNav || !!(currentUser && canEditRoleFeatureTemplates(currentUser));
  const [activeTab, setActiveTab] = useState<AdminTab>('profili');

  const handleTabChange = useCallback((tab: AdminTab) => {
    setActiveTab(tab);
    /** Storage (template ruoli, moduli admin, flag): altrimenti telefono resta su localStorage vecchio ≠ PC. */
    void silentRefreshData({ pullRemoteConfig: true });
  }, [silentRefreshData]);

  const selectAdminTab = useCallback(
    (tab: AdminTab) => {
      handleTabChange(tab);
    },
    [handleTabChange],
  );

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
    if (activeTab === 'regole' || activeTab === 'impostazioni') {
      setActiveTab('profili');
    }
  }, [fullAdminNav, activeTab]);

  return (
    <div className="min-h-screen min-h-[100dvh] w-full text-white font-sans antialiased flex flex-col safe-area-pad overflow-x-clip page-depth-bg">
      <header className="sticky top-0 z-40 shrink-0 pt-[max(6px,env(safe-area-inset-top,0px))] app-horizontal-pad pb-2">
        <div className={`${adminHeaderCardClass}`}>
          {/* Riga principale: torna + tab inline */}
          <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2">
            {/* Torna all'app */}
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="flex items-center gap-1.5 min-h-[36px] px-2 -ml-1 rounded-xl text-white/70 hover:text-white hover:bg-white/10 font-medium text-sm transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4 shrink-0 text-accent/70" />
              <span className="hidden sm:inline">{t.admin_back_to_app}</span>
            </button>

            {/* Tab inline — lato destro */}
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar" aria-label="Sezioni pannello admin">
              {/* Tab Gestione Profili — sempre visibile */}
              <button
                type="button"
                onClick={() => selectAdminTab('profili')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'profili'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t.admin_tab_profiles}
              </button>

              {/* Tab Gestione Regole — solo admin/elevati */}
              {fullAdminNav && (
                <button
                  type="button"
                  onClick={() => selectAdminTab('regole')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'regole'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <LayoutList className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.admin_tab_rules}
                </button>
              )}

              {/* Tab Impostazioni — solo admin/elevati */}
              {fullAdminNav && (
                <button
                  type="button"
                  onClick={() => selectAdminTab('impostazioni')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'impostazioni'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.settings_title}
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-6">
        {/* Gestione Profili */}
        <div className={activeTab === 'profili' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'profili'}>
          <SettingsPage view="profili" />
        </div>
        {/* Gestione Regole */}
        <div className={activeTab === 'regole' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'regole'}>
          <SettingsPage view="regole" />
        </div>
        {/* Impostazioni */}
        <div className={activeTab === 'impostazioni' ? 'block' : 'hidden'} aria-hidden={activeTab !== 'impostazioni'}>
          <ImpostazioniPage onOpenProfilesTab={() => handleTabChange('profili')} />
        </div>
      </main>
    </div>
  );
}
