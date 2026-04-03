import { useState, useEffect, useLayoutEffect, lazy, Suspense, useMemo, useCallback, useRef } from 'react';
import SwUpdateOverlay from './components/SwUpdateOverlay';
const SuperAdminPanel = lazy(() => import('./components/SuperAdminPanel'));
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useApp } from './context/AppContext';
import { ProfileLeaveGuardRefContext, type ProfileLeaveGuard } from './context/ProfileLeaveGuardContext';
import { LayoutPresetProvider } from './context/LayoutPresetContext';
import { applyUnauthenticatedDocumentTheme } from './utils/theme';
import { getTranslations } from './utils/translations';
import BottomNav from './components/BottomNav';
import MobileProfileHeader from './components/MobileProfileHeader';
import HeaderTodayCoworkersCard from './components/HeaderTodayCoworkersCard';
import RefreshLockOverlay from './components/RefreshLockOverlay';
import PostUnlockRestartOverlay from './components/PostUnlockRestartOverlay';
import BodyPullToRefresh from './components/BodyPullToRefresh';
import HomePage from './components/HomePage';
import PunchInKiosk from './components/PunchInKiosk';
import LoginPage from './components/LoginPage';
import InviteRedirect from './components/InviteRedirect';
import StaffPersonalDashboard from './components/StaffPersonalDashboard';
import ProfileNavTabPanel from './components/ProfileNavTabPanel';
import { Wrench } from 'lucide-react';
import { persistStoredUiLanguage } from './utils/uiLanguagePreference';
import { PATH_TIMBRATURA, PATH_PROFILO } from './config/appPaths';
import { APP_SESSION_STORAGE_KEY } from './constants/appSession';
import { getUnifiedNavTabs, getBottomNavTabsForMainApp, getAppNavTabTitle, type AppNavTab } from './utils/enabledModules';
import {
  readMainViewState,
  writeMainViewState,
  clearMainViewState,
  applyWindowScrollY,
} from './utils/mainAppViewRestore';
import { useIsMobileViewport } from './hooks/useIsMobileViewport';
import { isAdminOnly, isManagementRole } from './utils/permissions';
import AdminGate from './components/AdminGate';
import AdminLayout from './components/AdminLayout';
import OnboardingSetupModal from './components/OnboardingSetupModal';

const WeeklyShiftsTable = lazy(() => import('./components/WeeklyShiftsTable'));
const HolidayRequests = lazy(() => import('./components/HolidayRequests'));
const Statistics = lazy(() => import('./components/Statistics'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const Timesheets = lazy(() => import('./components/Timesheets'));

// ─── Maintenance Page ─────────────────────────────────────────────────────────
function MaintenancePage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 px-6 text-center font-sans antialiased">
      <div className="w-20 h-20 rounded-2xl bg-amber-100 flex items-center justify-center mb-6 shadow-sm">
        <Wrench className="w-10 h-10 text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">In Manutenzione</h1>
      <p className="text-slate-500 dark:text-neutral-300 text-base max-w-xs leading-relaxed mb-1">
        L'app è temporaneamente in manutenzione.
      </p>
      <p className="text-slate-400 dark:text-neutral-400 text-sm mb-8">Torneremo attivi tra poco. 👨‍🍳</p>
      <div className="surface-glass-sm px-4 py-2 text-[11px] text-slate-500 dark:text-neutral-400">
        Per assistenza contatta il responsabile.
      </div>
    </div>
  );
}

// ─── Kiosk Route ──────────────────────────────────────────────────────────────
function KioskRoute() {
  const navigate = useNavigate();
  const { currentUser, featureFlags } = useApp();

  useEffect(() => {
    const prevLang = document.documentElement.lang;
    document.documentElement.lang = 'en';
    return () => {
      document.documentElement.lang = prevLang;
    };
  }, []);

  useEffect(() => {
    if (currentUser) navigate('/app', { replace: true });
  }, [currentUser, navigate]);

  // Kiosk disabilitato → reindirizza alla login/dashboard
  useEffect(() => {
    if (featureFlags['kiosk_active'] === false) {
      navigate(currentUser ? '/app' : PATH_PROFILO, { replace: true });
    }
  }, [featureFlags, currentUser, navigate]);

  if (featureFlags['kiosk_active'] === false) return null;

  return (
    <div className="min-h-screen w-full flex flex-col safe-area-pad bg-[#f8fafc] dark:bg-[#0a0a0a] font-sans antialiased text-slate-900 dark:text-neutral-100">
      <PunchInKiosk onGoToLogin={() => navigate(PATH_PROFILO)} />
    </div>
  );
}

/** Dopo login: torna a `/app`, `/admin`, ecc. solo se path interno (no open redirect). */
function safeInternalRedirectPath(state: unknown, fallback = '/app'): string {
  const pathname = (state as { from?: { pathname?: string } } | null)?.from?.pathname;
  if (
    typeof pathname === 'string' &&
    pathname.startsWith('/') &&
    !pathname.startsWith('//') &&
    !pathname.includes('://')
  ) {
    return pathname;
  }
  return fallback;
}

// ─── Login Route ───────────────────────────────────────────────────────────────
function LoginRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useApp();
  const postAuthPath = useMemo(() => safeInternalRedirectPath(location.state), [location.state]);

  useEffect(() => {
    if (currentUser) navigate(postAuthPath, { replace: true });
  }, [currentUser, navigate, postAuthPath]);

  const handleLogin = () => navigate(postAuthPath, { replace: true });
  const handleBack = () => navigate(PATH_TIMBRATURA, { replace: true });

  return (
    <>
      <AnimatePresence mode="wait">
        <LoginPage key="login" onLogin={handleLogin} onBack={handleBack} />
      </AnimatePresence>
    </>
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
    postUnlockReloadPending,
    silentRefreshData,
    featureFlags,
    roleTemplatesRevision,
  } = useApp();

  const isManagement = currentUser ? isManagementRole(currentUser.role) : false;
  const isMobileViewport = useIsMobileViewport();
  const staffMobileCompactHeader = !isManagement && isMobileViewport;

  // ── Onboarding obbligatorio: email o telefono mancanti ──────────────────────
  const needsOnboarding = Boolean(
    currentUser &&
    (!currentUser.email?.trim() || !currentUser.phone?.trim())
  );
  const [onboardingDone, setOnboardingDone] = useState(false);
  const showOnboarding = needsOnboarding && !onboardingDone;

  // Nasconde la sticky header quando un overlay/modal è aperto (evita il bug iOS Safari
  // dove il backdrop-filter della header appare sopra i modal con z-index superiore).
  const [overlayOpen, setOverlayOpen] = useState(false);
  useEffect(() => {
    const check = () => setOverlayOpen(document.body.dataset.overlay === '1');
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-overlay'] });
    return () => obs.disconnect();
  }, []);


  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  /** `roleTemplatesRevision` deve essere nelle dipendenze: `getEnabledFeatures` legge il template da cache modulo; dopo PIN/sync il memo altrimenti resta sulla lista schede vecchia. */
  const visibleNavTabs = useMemo((): AppNavTab[] => {
    void roleTemplatesRevision;
    if (!currentUser) return ['home'];
    return getUnifiedNavTabs(currentUser, isManagement, featureFlags);
  }, [currentUser, isManagement, featureFlags, roleTemplatesRevision]);

  /** Bottom bar: staff con ordine ferie → turni (Ore in barra se abilitata). */
  const bottomNavTabs = useMemo((): AppNavTab[] => {
    void roleTemplatesRevision;
    if (!currentUser) return ['home'];
    return getBottomNavTabsForMainApp(currentUser, isManagement, featureFlags);
  }, [currentUser, isManagement, featureFlags, roleTemplatesRevision]);

  const tr = getTranslations(effectiveLanguage);
  const noNavTabs = Boolean(currentUser && visibleNavTabs.length === 0);
  /** Spazio sotto il contenuto: la MobileBottomNav staff è `fixed`; `pb-24` su `<main>` evita che l’ultimo blocco resti sotto la barra. */
  const staffMobileBottomNavActive =
    !!currentUser && !noNavTabs && isMobileViewport;

  const appStickyHeaderRef = useRef<HTMLElement | null>(null);

  /** Altezza reale header sticky → `--app-sticky-header-offset` per barre interne (es. date turni). */
  useLayoutEffect(() => {
    const el = appStickyHeaderRef.current;
    if (!el) return;
    const setOffset = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--app-sticky-header-offset', `${h}px`);
    };
    setOffset();
    const ro = new ResizeObserver(setOffset);
    ro.observe(el);
    window.addEventListener('resize', setOffset);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', setOffset);
      document.documentElement.style.removeProperty('--app-sticky-header-offset');
    };
  }, []);

  const [activeTab, setActiveTab] = useState<AppNavTab>('home');
  const mainViewRestoredUserIdRef = useRef<string | null>(null);
  const pendingScrollRestoreRef = useRef<{ y: number; tab: AppNavTab } | null>(null);
  const profileLeaveGuardRef = useRef<ProfileLeaveGuard | null>(null);

  const applyTabChange = useCallback(
    (id: AppNavTab) => {
      if (isManagement && id === 'settings' && currentUser && isAdminOnly(currentUser)) {
        navigate('/admin');
        return;
      }
      setActiveTab(id);
    },
    [currentUser, isManagement, navigate]
  );

  const handleTabChange = useCallback(
    (id: AppNavTab) => {
      void (async () => {
        const tv = tr as Record<string, string>;
        if (activeTab === 'profile' && id !== 'profile') {
          const g = profileLeaveGuardRef.current;
          if (g?.isDirty()) {
            const msg =
              tv.profile_leave_unsaved_confirm ??
              'Ci sono modifiche non salvate nel profilo. OK per salvare e cambiare scheda, Annulla per restare.';
            if (!window.confirm(msg)) return;
            try {
              await g.save();
            } catch {
              return;
            }
          }
        }
        applyTabChange(id);
      })();
    },
    [activeTab, tr, applyTabChange]
  );

  useEffect(() => {
    if (!currentUser) return;
    if (visibleNavTabs.length === 0) return;
    if (!visibleNavTabs.includes(activeTab)) {
      setActiveTab(visibleNavTabs[0]!);
    }
  }, [currentUser, isManagement, featureFlags, visibleNavTabs, activeTab]);

  /** Dopo reload: ripristina tab e (subito dopo il paint) scroll salvati in sessionStorage. */
  useLayoutEffect(() => {
    if (!currentUser?.id || visibleNavTabs.length === 0) return;
    if (mainViewRestoredUserIdRef.current === currentUser.id) return;
    mainViewRestoredUserIdRef.current = currentUser.id;
    const s = readMainViewState(currentUser.id);
    if (s?.activeTab && visibleNavTabs.includes(s.activeTab as AppNavTab)) {
      const tab = s.activeTab as AppNavTab;
      setActiveTab(tab);
      pendingScrollRestoreRef.current = { y: s.scrollY, tab };
    } else {
      pendingScrollRestoreRef.current = null;
    }
  }, [currentUser?.id, visibleNavTabs]);

  useEffect(() => {
    const bundle = pendingScrollRestoreRef.current;
    if (!bundle || bundle.tab !== activeTab) return;
    if (isGlobalRefreshing || postRefreshLocked || postUnlockReloadPending) return;
    pendingScrollRestoreRef.current = null;
    const y = bundle.y;
    const apply = () => applyWindowScrollY(y);
    apply();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      apply();
      raf2 = requestAnimationFrame(apply);
    });
    const t1 = window.setTimeout(apply, 80);
    const t2 = window.setTimeout(apply, 320);
    const t3 = window.setTimeout(apply, 800);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [activeTab, isGlobalRefreshing, postRefreshLocked, postUnlockReloadPending]);

  const persistSkipFirstActiveTabRef = useRef(true);
  useEffect(() => {
    if (!currentUser?.id) return;
    const save = () => {
      writeMainViewState(currentUser.id, {
        activeTab,
        scrollY: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0,
      });
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') save();
    };
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', save);
      window.removeEventListener('beforeunload', save);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [currentUser?.id, activeTab]);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (persistSkipFirstActiveTabRef.current) {
      persistSkipFirstActiveTabRef.current = false;
      return;
    }
    writeMainViewState(currentUser.id, {
      activeTab,
      scrollY: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0,
    });
  }, [currentUser?.id, activeTab]);

  // Sincronizza settimana tra Turni e Presenze notificando il cambio tab
  useEffect(() => {
    if (activeTab === 'turni' || activeTab === 'timesheet') {
      window.dispatchEvent(
        new CustomEvent('osteria-tab-activated', { detail: activeTab })
      );
    }
  }, [activeTab]);

  /** Da NotificationCenter / Ore: apre tab (es. Presenze) e scroll ad ancoraggio. */
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const ce = e as CustomEvent<{ tab?: AppNavTab; anchor?: string }>;
      const tab = ce.detail?.tab;
      const anchor = ce.detail?.anchor;
      if (!tab || !visibleNavTabs.includes(tab)) return;
      void (async () => {
        const tv = tr as Record<string, string>;
        if (activeTab === 'profile' && tab !== 'profile') {
          const g = profileLeaveGuardRef.current;
          if (g?.isDirty()) {
            const msg =
              tv.profile_leave_unsaved_confirm ??
              'Ci sono modifiche non salvate nel profilo. OK per salvare e cambiare scheda, Annulla per restare.';
            if (!window.confirm(msg)) return;
            try {
              await g.save();
            } catch {
              return;
            }
          }
        }
        setActiveTab(tab);
        const scrollTo = () => {
          if (!anchor) return;
          document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        requestAnimationFrame(() => requestAnimationFrame(scrollTo));
        window.setTimeout(scrollTo, 400);
        window.setTimeout(scrollTo, 800);
      })();
    };
    window.addEventListener('osteria-navigate', onNavigate as EventListener);
    return () => window.removeEventListener('osteria-navigate', onNavigate as EventListener);
  }, [visibleNavTabs, activeTab, tr]);

  const renderManagementContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomePage
            activeTab={activeTab}
            onNavigateToHolidays={() => {
              void handleTabChange('ferie');
            }}
            onNavigateToShifts={() => {
              void handleTabChange('turni');
            }}
            onNavigateToReports={() => {
              void handleTabChange('timesheet');
            }}
            onTabChange={(tab) => void handleTabChange(tab)}
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
      case 'profile':
        return <ProfileNavTabPanel onLogout={onLogout} onGoToSettings={() => void handleTabChange('settings')} />;
      default:
        return null;
    }
  };

  /** `overflow-visible` così popover / menu non vengono tagliati dal bordo arrotondato della card. */
  const appHeaderMainCardClass = 'w-full rounded-2xl border-0 bg-gradient-to-b from-white/75 to-white/55 dark:from-neutral-800/70 dark:to-neutral-900/60 shadow-[0_2px_0_0_rgba(255,255,255,0.85)_inset,0_-1px_0_0_rgba(0,0,0,0.05)_inset,0_10px_28px_-4px_rgba(0,82,255,0.12),0_4px_12px_-2px_rgba(15,23,42,0.10)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset,0_-1px_0_0_rgba(0,0,0,0.45)_inset,0_12px_32px_-4px_rgba(0,0,0,0.55),0_4px_12px_-2px_rgba(0,0,0,0.35)] overflow-visible supports-[backdrop-filter]:backdrop-blur-2xl supports-[backdrop-filter]:backdrop-saturate-[2]';
  const appHeaderCardClass = 'w-full rounded-2xl border border-slate-100 dark:border-white/10 bg-white/80 dark:bg-neutral-900/80 shadow-[0_4px_16px_-4px_rgba(0,82,255,0.10),0_2px_8px_-4px_rgba(15,23,42,0.08)] dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.35)] overflow-hidden supports-[backdrop-filter]:backdrop-blur-lg supports-[backdrop-filter]:backdrop-saturate-150';

  return (
    <ProfileLeaveGuardRefContext.Provider value={profileLeaveGuardRef}>
    {/* Onboarding obbligatorio: blocca l'interfaccia finché email/telefono non sono configurati */}
    {showOnboarding && (
      <OnboardingSetupModal onComplete={() => setOnboardingDone(true)} />
    )}
    <div className="min-h-screen min-h-[100dvh] w-full bg-gray-50 dark:bg-[#0a0a0a] text-[#1a1a1a] dark:text-neutral-100 font-sans antialiased overflow-x-clip safe-area-pad pt-0 flex flex-col">
      <BodyPullToRefresh
        onRefresh={() => silentRefreshData({ pullRemoteConfig: true })}
        disabled={!!(isGlobalRefreshing || postRefreshLocked || postUnlockReloadPending)}
      />

      {/*
        Sticky: solo safe-area + padding come il main (`app-horizontal-pad`). Un’unica card definisce i bordi visibili.
      */}
      <header
        ref={appStickyHeaderRef}
        className={`sticky top-0 z-[10040] shrink-0 pt-[max(6px,env(safe-area-inset-top,0px))] app-horizontal-pad pb-2 transition-[visibility,opacity] duration-150 ${
          activeTab === 'profile' ? 'hidden' : ''
        } ${
          overlayOpen ? 'invisible opacity-0 pointer-events-none' : ''
        } ${
          isGlobalRefreshing || postRefreshLocked || postUnlockReloadPending ? 'blur-md pointer-events-none' : ''
        }`}
      >
        <div className={appHeaderMainCardClass}>
          <MobileProfileHeader
            onLogout={onLogout}
            activeTab={activeTab}
            showOnDesktop
            compact={staffMobileCompactHeader}
            parentProvidesCardShell
            hideToolbarAvatar={false}
          />
        </div>
        {currentUser && activeTab === 'home' && (
          <div className={`${appHeaderCardClass} mt-1.5`}>
            <HeaderTodayCoworkersCard />
          </div>
        )}
      </header>

      <main
        className={`flex-1 flex flex-col w-full min-h-0 ${isGlobalRefreshing || postRefreshLocked || postUnlockReloadPending ? 'blur-md pointer-events-none' : ''}`}
        style={activeTab === 'profile' ? { paddingTop: 'max(6px, env(safe-area-inset-top, 0px))' } : undefined}
      >
        <div className="w-full flex-1 app-main-top-pad app-horizontal-pad">
          {activeTab !== 'profile' && (
            <p
              className="text-sm sm:text-base font-extrabold tracking-widest leading-tight truncate uppercase mb-3"
              style={{ background: 'linear-gradient(110deg, #06B6D4 0%, #0052FF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
            >
              {getAppNavTabTitle(tr, activeTab)}
            </p>
          )}
          {noNavTabs ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-10 pb-content text-center text-sm text-amber-950 max-w-lg mx-auto">
              {(tr as Record<string, string>).app_all_nav_tabs_disabled}
            </div>
          ) : isManagement ? (
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

      <AnimatePresence mode="wait">
        {postRefreshLocked && <RefreshLockOverlay key="refresh-lock" />}
        {postUnlockReloadPending && !postRefreshLocked && (
          <PostUnlockRestartOverlay key="post-unlock-restart" language={effectiveLanguage} />
        )}
      </AnimatePresence>

      {!noNavTabs && (
        <div className={postUnlockReloadPending ? 'pointer-events-none' : undefined}>
          <BottomNav
            activeTab={activeTab}
            onTabChange={handleTabChange}
            visibleTabs={bottomNavTabs}
          />
        </div>
      )}
    </div>
    </ProfileLeaveGuardRefContext.Provider>
  );
}

// ─── Protected App Route ───────────────────────────────────────────────────────
function ProtectedApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, setCurrentUser, forceLogoutRequested, clearForceLogoutRequest, featureFlags, showError, effectiveLanguage, setIsSessionElevated } = useApp();

  useEffect(() => {
    const state = location.state as { accessDenied?: boolean } | null;
    if (state?.accessDenied) {
      showError?.(getTranslations(effectiveLanguage).app_access_denied);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, showError, effectiveLanguage]);

  const handleLogout = () => {
    applyUnauthenticatedDocumentTheme();
    try {
      localStorage.removeItem(APP_SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (currentUser?.language && ['it', 'en', 'es', 'fr'].includes(currentUser.language)) {
      persistStoredUiLanguage(currentUser.language);
    }
    setIsSessionElevated(false);
    setCurrentUser(null);
    navigate(PATH_TIMBRATURA, { replace: true });
  };

  useEffect(() => {
    if (forceLogoutRequested) {
      if (currentUser?.id) clearMainViewState(currentUser.id);
      applyUnauthenticatedDocumentTheme();
      try {
        localStorage.removeItem(APP_SESSION_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      if (currentUser?.language && ['it', 'en', 'es', 'fr'].includes(currentUser.language)) {
        persistStoredUiLanguage(currentUser.language);
      }
      setIsSessionElevated(false);
      setCurrentUser(null);
      clearForceLogoutRequest();
      navigate(PATH_TIMBRATURA, { replace: true });
    }
  }, [
    forceLogoutRequested,
    clearForceLogoutRequest,
    currentUser?.id,
    currentUser?.language,
    setCurrentUser,
    navigate,
  ]);

  if (!currentUser) {
    return <Navigate to={PATH_PROFILO} replace state={{ from: location }} />;
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
      <Route path="/i/:slug" element={<InviteRedirect />} />
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
  // Se il dominio è il progetto super-admin dedicato, reindirizza / → /super-admin
  const isSuperAdminDomain =
    typeof window !== 'undefined' &&
    window.location.hostname.includes('super-admin');

  // Overlay aggiornamento SW: mostrato quando viene rilevato un nuovo deploy
  const [swUpdating, setSwUpdating] = useState(false);

  useEffect(() => {
    const onSwUpdate = () => setSwUpdating(true);
    window.addEventListener('sw-update', onSwUpdate);
    return () => window.removeEventListener('sw-update', onSwUpdate);
  }, []);

  // Priorità massima: se SW update in corso, mostra solo l'overlay
  if (swUpdating) return <SwUpdateOverlay />;

  return (
    <Routes>
      {/* Super admin: completamente isolato da AppProvider e TenantContext */}
      <Route path="/super-admin" element={<Suspense fallback={null}><SuperAdminPanel /></Suspense>} />
      {/* Redirect automatico dalla root per il dominio super-admin dedicato */}
      {isSuperAdminDomain && (
        <Route path="/" element={<Navigate to="/super-admin" replace />} />
      )}
      {/* Tutto il resto: avvolto nei provider normali */}
      <Route
        path="*"
        element={
          <AppProvider>
            <LayoutPresetProvider>
              <AppContent />
            </LayoutPresetProvider>
          </AppProvider>
        }
      />
    </Routes>
  );
}

export default App;
