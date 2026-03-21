import { useState, useEffect, lazy, Suspense, useMemo, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useApp } from './context/AppContext';
import { forceLightTheme } from './utils/theme';
import { getTranslations } from './utils/translations';
import BottomNav from './components/BottomNav';
import MobileProfileHeader from './components/MobileProfileHeader';
import RefreshLockOverlay from './components/RefreshLockOverlay';
import BodyPullToRefresh from './components/BodyPullToRefresh';
import HomePage from './components/HomePage';
import PunchInKiosk from './components/PunchInKiosk';
import LoginPage from './components/LoginPage';
import StaffPersonalDashboard from './components/StaffPersonalDashboard';
import { Wrench, MonitorOff } from 'lucide-react';
import { persistStoredUiLanguage } from './utils/uiLanguagePreference';
import { PATH_TIMBRATURA, PATH_PROFILO } from './config/appPaths';
import { APP_SESSION_STORAGE_KEY } from './constants/appSession';
import { getUnifiedNavTabs, getVisibleManagementTabs, type AppNavTab } from './utils/enabledModules';
import { isAdminOnly } from './utils/permissions';
import AdminGate from './components/AdminGate';
import AdminLayout from './components/AdminLayout';

const WeeklyShiftsTable = lazy(() => import('./components/WeeklyShiftsTable'));
const HolidayRequests = lazy(() => import('./components/HolidayRequests'));
const Statistics = lazy(() => import('./components/Statistics'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const Timesheets = lazy(() => import('./components/Timesheets'));

const MANAGEMENT_ROLES = ['admin', 'proprietario', 'manager', 'assistant_manager'];

// ─── Maintenance Page ─────────────────────────────────────────────────────────
function MaintenancePage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 px-6 text-center font-sans antialiased">
      <div className="w-20 h-20 rounded-2xl bg-amber-100 flex items-center justify-center mb-6 shadow-sm">
        <Wrench className="w-10 h-10 text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">In Manutenzione</h1>
      <p className="text-slate-500 text-base max-w-xs leading-relaxed mb-1">
        L'app è temporaneamente in manutenzione.
      </p>
      <p className="text-slate-400 text-sm mb-8">Torneremo attivi tra poco. 👨‍🍳</p>
      <div className="text-[11px] text-slate-300 bg-white border border-slate-100 rounded-xl px-4 py-2 shadow-xs">
        Per assistenza contatta il responsabile.
      </div>
    </div>
  );
}

// ─── Kiosk Disabled Page ──────────────────────────────────────────────────────
function KioskOffPage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-900 px-6 text-center font-sans antialiased">
      <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center mb-6 shadow-inner">
        <MonitorOff className="w-10 h-10 text-slate-400" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Terminale Disattivato</h1>
      <p className="text-slate-400 text-base max-w-xs leading-relaxed">
        Il terminale di timbratura è momentaneamente disattivato.
      </p>
      <p className="text-slate-500 text-sm mt-2">Contatta il responsabile per informazioni.</p>
    </div>
  );
}

// ─── Kiosk Route ──────────────────────────────────────────────────────────────
function KioskRoute() {
  const navigate = useNavigate();
  const { currentUser, featureFlags } = useApp();

  useEffect(() => {
    if (currentUser) navigate('/app', { replace: true });
  }, [currentUser, navigate]);

  if (featureFlags['kiosk_active'] === false) {
    return <KioskOffPage />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col safe-area-pad bg-surface font-sans antialiased">
      <PunchInKiosk onGoToLogin={() => navigate(PATH_PROFILO)} />
    </div>
  );
}

// ─── Login Route ───────────────────────────────────────────────────────────────
function LoginRoute() {
  const navigate = useNavigate();
  const { currentUser } = useApp();

  useEffect(() => {
    if (currentUser) navigate('/app', { replace: true });
  }, [currentUser, navigate]);

  const handleLogin = () => navigate('/app', { replace: true });
  const handleBack = () => navigate(PATH_TIMBRATURA, { replace: true });

  return (
    <AnimatePresence mode="wait">
      <LoginPage key="login" onLogin={handleLogin} onBack={handleBack} />
    </AnimatePresence>
  );
}

// ─── App principale (gestione + staff): niente sidebar, bottom bar unificata ─
function MainApp({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const {
    currentUser,
    effectiveLanguage,
    isGlobalRefreshing,
    postRefreshLocked,
    silentRefreshData,
    featureFlags,
  } = useApp();

  const isManagement = currentUser ? MANAGEMENT_ROLES.includes(currentUser.role) : false;

  const visibleNavTabs = useMemo((): AppNavTab[] => {
    if (!currentUser) return ['home'];
    return getUnifiedNavTabs(currentUser, isManagement, featureFlags);
  }, [currentUser, isManagement, featureFlags]);

  const [activeTab, setActiveTab] = useState<AppNavTab>('home');

  const handleTabChange = useCallback(
    (id: AppNavTab) => {
      if (isManagement && id === 'settings' && currentUser && isAdminOnly(currentUser)) {
        silentRefreshData();
        navigate('/admin');
        return;
      }
      setActiveTab(id);
      silentRefreshData();
    },
    [currentUser, isManagement, navigate, silentRefreshData]
  );

  useEffect(() => {
    silentRefreshData();
  }, [silentRefreshData]);

  useEffect(() => {
    if (!currentUser) return;
    // Ferie: solo gestione, accessibile dalla Home ma non in bottom bar
    if (isManagement && activeTab === 'ferie') {
      const v = getVisibleManagementTabs(currentUser, featureFlags);
      if (v.includes('ferie')) return;
    }
    if (!visibleNavTabs.includes(activeTab)) {
      setActiveTab(visibleNavTabs[0] ?? 'home');
    }
  }, [currentUser, isManagement, featureFlags, visibleNavTabs, activeTab]);

  const renderManagementContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomePage
            onNavigateToHolidays={() => setActiveTab('ferie')}
            onNavigateToShifts={() => setActiveTab('turni')}
            onNavigateToReports={() => setActiveTab('timesheet')}
          />
        );
      case 'turni':
        return <WeeklyShiftsTable />;
      case 'ferie':
        return <HolidayRequests />;
      case 'reports':
        return <Statistics />;
      case 'timesheet':
        return <Timesheets />;
      case 'settings':
        return <SettingsPage />;
      default:
        return null;
    }
  };

  const appHeaderCardClass =
    'w-full rounded-2xl border border-slate-100 bg-white/95 shadow-[0_4px_16px_-4px_rgba(45,90,39,0.14),0_2px_8px_-4px_rgba(15,23,42,0.08)] overflow-hidden supports-[backdrop-filter]:backdrop-blur-md';

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-[#f8fafc] text-[#1a1a1a] font-sans antialiased overflow-x-clip safe-area-pad pt-0 flex flex-col">
      <BodyPullToRefresh onRefresh={silentRefreshData} disabled={!!(isGlobalRefreshing || postRefreshLocked)} />

      {/*
        Sticky: solo safe-area + padding come il main (px-4 sm:px-6). Un’unica card definisce i bordi visibili.
      */}
      <header className="sticky top-0 z-40 shrink-0 pt-[max(6px,env(safe-area-inset-top,0px))] px-4 sm:px-6 pb-2">
        <div className={appHeaderCardClass}>
          <MobileProfileHeader
            onLogout={onLogout}
            activeTab={activeTab}
            showOnDesktop
            parentProvidesCardShell
          />
        </div>
      </header>

      <main
        className={`flex-1 flex flex-col w-full min-h-0 ${isGlobalRefreshing || postRefreshLocked ? 'blur-md pointer-events-none' : ''}`}
      >
        <div className="w-full flex-1 pt-3 sm:pt-4 pb-content px-4 sm:px-6">
          {isManagement ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                className="w-full"
              >
                <Suspense
                  fallback={
                    <div className="flex items-center justify-center min-h-[200px]">
                      <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                  }
                >
                  {renderManagementContent()}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          ) : currentUser ? (
            <StaffPersonalDashboard
              user={currentUser}
              onLogout={onLogout}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          ) : null}
        </div>
      </main>

      {isGlobalRefreshing && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-accent font-sans text-center px-4">
          <div className="w-14 h-14 border-4 border-white border-t-transparent rounded-xl animate-spin mb-4" />
          <p className="text-white text-lg font-medium max-w-xs">
            {getTranslations(effectiveLanguage).sync_total_in_progress}
          </p>
        </div>
      )}

      <AnimatePresence mode="wait">{postRefreshLocked && <RefreshLockOverlay key="refresh-lock" />}</AnimatePresence>

      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} visibleTabs={visibleNavTabs} />
    </div>
  );
}

// ─── Protected App Route ───────────────────────────────────────────────────────
function ProtectedApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, setCurrentUser, forceLogoutRequested, clearForceLogoutRequest, featureFlags, showError } = useApp();

  useEffect(() => {
    const state = location.state as { accessDenied?: boolean } | null;
    if (state?.accessDenied) {
      showError?.('Accesso Negato');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, showError]);

  const handleLogout = () => {
    forceLightTheme();
    try {
      localStorage.removeItem(APP_SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (currentUser?.language && ['it', 'en', 'es', 'fr'].includes(currentUser.language)) {
      persistStoredUiLanguage(currentUser.language);
    }
    setCurrentUser(null);
    navigate(PATH_TIMBRATURA, { replace: true });
  };

  useEffect(() => {
    if (forceLogoutRequested) {
      forceLightTheme();
      try {
        localStorage.removeItem(APP_SESSION_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      if (currentUser?.language && ['it', 'en', 'es', 'fr'].includes(currentUser.language)) {
        persistStoredUiLanguage(currentUser.language);
      }
      setCurrentUser(null);
      clearForceLogoutRequest();
      navigate(PATH_TIMBRATURA, { replace: true });
    }
  }, [forceLogoutRequested, clearForceLogoutRequest, currentUser?.language, setCurrentUser, navigate]);

  if (!currentUser) {
    return <Navigate to={PATH_PROFILO} replace />;
  }

  if (featureFlags['maintenance_mode'] === true && currentUser.role !== 'admin') {
    return <MaintenancePage />;
  }

  return <MainApp onLogout={handleLogout} />;
}

// ─── Root App ─────────────────────────────────────────────────────────────────
function AppContent() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={PATH_TIMBRATURA} replace />} />
      <Route path={PATH_TIMBRATURA} element={<KioskRoute />} />
      <Route path="/kiosk" element={<Navigate to={PATH_TIMBRATURA} replace />} />
      <Route path={PATH_PROFILO} element={<LoginRoute />} />
      <Route path="/login" element={<Navigate to={PATH_PROFILO} replace />} />
      <Route path="/app" element={<ProtectedApp />} />
      <Route path="/app/*" element={<ProtectedApp />} />
      <Route path="/admin" element={<AdminGate><AdminLayout /></AdminGate>} />
      <Route path="/admin/*" element={<AdminGate><AdminLayout /></AdminGate>} />
      <Route path="*" element={<Navigate to={PATH_TIMBRATURA} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
