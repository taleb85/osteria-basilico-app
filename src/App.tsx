import { useState, useEffect, useLayoutEffect, lazy, Suspense, useMemo, useCallback, useRef } from 'react';
import { unlockAudioContext } from './utils/hapticFeedbackCore';

import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { getDateLocale } from './utils/translations';
import SwUpdateOverlay from './components/SwUpdateOverlay';
import AdminSyncOverlay from './components/AdminSyncOverlay';
/**
 * SuperAdminPanel — accessibile solo sul dominio super-admin, protetto da PIN.
 */
const SuperAdminPanel = lazy(() => import('./components/SuperAdminPanel'));
const AnimPreview = lazy(() => import('./components/AnimPreview'));
const LoadingPreview = lazy(() => import('./components/LoadingPreview'));
const ScreensPreview = lazy(() => import('./components/ScreensPreview'));
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useApp } from './context/AppContext';
import { ProfileLeaveGuardRefContext, type ProfileLeaveGuard } from './context/ProfileLeaveGuardContext';
import { LayoutPresetProvider } from './context/LayoutPresetContext';
import { applyUnauthenticatedDocumentTheme } from './utils/theme';
import { getTranslations } from './utils/translations';
import TopTabBar from './components/TopTabBar';
import MobileProfileHeader from './components/MobileProfileHeader';
import FlowWaveIcon from './components/ui/FlowWaveIcon';
// import HeaderTodayCoworkersCard from './components/HeaderTodayCoworkersCard'; // unused
import RefreshLockOverlay from './components/RefreshLockOverlay';
import PostUnlockRestartOverlay from './components/PostUnlockRestartOverlay';
import BodyPullToRefresh from './components/BodyPullToRefresh';
import HomePage from './components/HomePage';
import LoginPage from './components/LoginPage';
// import PWAInstallRequired from './components/PWAInstallRequired'; // unused (rendered by PwaGate)
// import { isPWAStandalone } from './utils/pwaStandalone'; // unused
import InviteRedirect from './components/InviteRedirect';
import { Wrench, RotateCw, Cloud, CloudOff, Lock, Unlock, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { PinPadModal } from './components/ui/PinPadModal';
import { findFreezeVerifierByPin, findFreezeVerifierById } from './utils/permissions';
import { lockBodyScroll, unlockBodyScroll } from './utils/bodyScrollLock';
import { persistStoredUiLanguage } from './utils/uiLanguagePreference';
import { PATH_PROFILO } from './config/appPaths';
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
import { getTimesheetGridPrivacyMode } from './utils/timesheetGridPrivacy';
import AdminGate from './components/AdminGate';
import { PwaGate } from './components/PwaGate';

const PunchInKiosk = lazy(() => import('./components/PunchInKiosk'));
const StaffPersonalDashboard = lazy(() => import('./components/StaffPersonalDashboard'));
const ProfileNavTabPanel = lazy(() => import('./components/ProfileNavTabPanel'));
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const OnboardingSetupModal = lazy(() => import('./components/OnboardingSetupModal'));
const PermissionRequestModal = lazy(() => import('./components/PermissionRequestModal').then(m => ({ default: m.default })));
const shouldShowPermissionModal = () => import('./components/PermissionRequestModal').then(m => m.shouldShowPermissionModal()).catch(() => false);

const WeeklyShiftsTable = lazy(() => import('./components/WeeklyShiftsTable'));
const HolidayRequests = lazy(() => import('./components/HolidayRequests'));
// const Statistics = lazy(() => import('./components/Statistics')); // unused in App.tsx (rendered via routing in AdminLayout)
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const Timesheets = lazy(() => import('./components/Timesheets'));
const ManagementMobileShifts = lazy(() => import('./components/mobile/ManagementMobileShifts'));
const ManagementMobileTimesheet = lazy(() => import('./components/mobile/ManagementMobileTimesheet'));

// ─── Maintenance Page ─────────────────────────────────────────────────────────
function MaintenancePage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 px-6 text-center font-sans antialiased">
      <div className="w-20 h-20 rounded-2xl bg-amber-100 flex items-center justify-center mb-6 shadow-sm">
        <Wrench className="w-10 h-10 text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold text-white/90 mb-2">In Manutenzione</h1>
      <p className="text-white/60 text-base max-w-xs leading-relaxed mb-1">
        L'app è temporaneamente in manutenzione.
      </p>
      <p className="text-white/50 text-sm mb-8">Torneremo attivi tra poco. 👨‍🍳</p>
      <div className="surface-glass-sm px-4 py-2 text-[11px] text-white/60">
        Per assistenza contatta il responsabile.
      </div>
    </div>
  );
}

// ─── Kiosk Route (disabilitata — /kiosk reindirizza a /profilo) ──────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Feedback visivo via JS (event delegation) — più affidabile di CSS :active su iOS
  // Sblocca anche AudioContext al primo tocco
  useEffect(() => {
    let audioUnlocked = false;

    const onTouchStart = (e: TouchEvent) => {
      // Sblocca audio al primo tocco
      if (!audioUnlocked) {
        unlockAudioContext();
        audioUnlocked = true;
      }
      // Trova il bottone più vicino e aggiunge classe tap-active
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('button, [role="button"]') as HTMLElement | null;
      if (btn) {
        btn.classList.add('tap-active');
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('button, [role="button"]') as HTMLElement | null;
      if (btn) {
        // Piccolo delay per rendere l'animazione visibile
        setTimeout(() => btn.classList.remove('tap-active'), 100);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
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
    <div className="min-h-screen w-full flex flex-col safe-area-pad bg-[#f8fafc] font-sans antialiased text-white">
      <Suspense fallback={null}><PunchInKiosk onGoToLogin={() => navigate(PATH_PROFILO)} /></Suspense>
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
  const handleBack = () => navigate(PATH_PROFILO, { replace: true });

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
    syncStage,
    postRefreshLocked,
    postUnlockReloadPending,
    silentRefreshData,
    featureFlags,
    roleTemplatesRevision,
    hardReloadFromDatabase,
    dataSyncInProgress,
    users,
    shifts,
    punchRecords,
    globalPinSessionId,
    setGlobalPinSessionId,
    isSessionElevated,
    impersonatingAs,
    originalAdminUser,
    setImpersonating,
    setCurrentUser: setCtxCurrentUser,
    setIsSessionElevated,
  } = useApp();

  const t = getTranslations(effectiveLanguage);
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

  // ── Modal permessi (notifiche + posizione) al primo accesso ─────────────────
  const [showPermissions, setShowPermissions] = useState(false);
  useEffect(() => {
    if (!currentUser || showOnboarding) return;
    shouldShowPermissionModal().then(show => { if (show) setShowPermissions(true); });
  }, [currentUser, showOnboarding]);

  const [overlayOpen, setOverlayOpen] = useState(false);
  useEffect(() => {
    const check = () => setOverlayOpen(document.body.dataset.overlay === '1');
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-overlay'] });
    return () => obs.disconnect();
  }, []);

  const location = useLocation();

  const visibleNavTabs = useMemo((): AppNavTab[] => {
    void roleTemplatesRevision;
    if (!currentUser) return ['home'];
    return getUnifiedNavTabs(currentUser, isManagement, featureFlags);
  }, [currentUser, isManagement, featureFlags, roleTemplatesRevision]);

  const bottomNavTabs = useMemo((): AppNavTab[] => {
    void roleTemplatesRevision;
    if (!currentUser) return ['home'];
    return getBottomNavTabsForMainApp(currentUser, isManagement, featureFlags);
  }, [currentUser, isManagement, featureFlags, roleTemplatesRevision]);

  // ── Blocca bounce/rubber-band iOS su #root (Safari ignora overscroll-behavior) ──
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    let lastY = 0;
    const onTouchStart = (e: TouchEvent) => {
      lastY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      const atTop = root.scrollTop <= 0;
      const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 1;
      if ((atTop && y > lastY) || (atBottom && y < lastY)) {
        e.preventDefault();
      }
      lastY = y;
    };
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  const noNavTabs = Boolean(currentUser && visibleNavTabs.length === 0);

  const appStickyHeaderRef = useRef<HTMLElement | null>(null);
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

  // Forza background trasparente per la griglia presenze in dark mode
  useEffect(() => {
    const grid = document.getElementById('timesheet-section-main-grid');
    if (grid) {
      if (document.documentElement.classList.contains('dark')) {
        grid.style.setProperty('background', 'transparent', 'important');
      } else {
        grid.style.removeProperty('background');
      }
    }
  }, [activeTab]);
  const prevTabRef = useRef<AppNavTab>('home');
  const tabNavDirection = useRef<1 | -1>(1); // 1 = destra→sinistra, -1 = sinistra→destra
  const mainViewRestoredUserIdRef = useRef<string | null>(null);
  const pendingScrollRestoreRef = useRef<{ y: number; tab: AppNavTab } | null>(null);
  const profileLeaveGuardRef = useRef<ProfileLeaveGuard | null>(null);

  const applyTabChange = useCallback(
    (id: AppNavTab) => {
      if (id === 'settings' && currentUser && (isAdminOnly(currentUser) || isSessionElevated || !!currentUser.elevated_role)) {
        navigate('/admin');
        return;
      }
      // Calcola direzione per l'animazione shared-axis
      const allTabs: AppNavTab[] = ['home', 'turni', 'timesheet', 'reports', 'ferie', 'profile', 'settings'];
      const fromIdx = allTabs.indexOf(prevTabRef.current);
      const toIdx = allTabs.indexOf(id);
      tabNavDirection.current = toIdx >= fromIdx ? 1 : -1;
      prevTabRef.current = id;
      setActiveTab(id);
    },
    [currentUser, isManagement, navigate]
  );

  const handleTabChange = useCallback(
    (id: AppNavTab) => {
      void (async () => {
        const tr = getTranslations(effectiveLanguage);
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
    [activeTab, effectiveLanguage, applyTabChange]
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
    const u = new URL(window.location.href);
    const open = u.pathname.startsWith('/app') ? u.searchParams.get('open') : null;
    if (open === 'punch_exit' && visibleNavTabs.includes('timesheet')) {
      u.searchParams.delete('open');
      window.history.replaceState({}, '', u.pathname + (u.search || '') + u.hash);
      prevTabRef.current = 'timesheet';
      setActiveTab('timesheet');
    } else if (open === 'turni' && visibleNavTabs.includes('turni')) {
      u.searchParams.delete('open');
      window.history.replaceState({}, '', u.pathname + (u.search || '') + u.hash);
      prevTabRef.current = 'turni';
      setActiveTab('turni');
    } else {
      setActiveTab('home');
    }
    pendingScrollRestoreRef.current = null;
    void readMainViewState; // mantenuto per uso futuro
  }, [currentUser?.id, visibleNavTabs]);

  useEffect(() => {
    const onSw = (event: MessageEvent) => {
      const t = event.data?.type;
      if (t === 'OPEN_PUNCH_EXIT') {
        if (!visibleNavTabs.includes('timesheet')) return;
        void handleTabChange('timesheet');
        return;
      }
      if (t === 'OPEN_TURNI') {
        if (!visibleNavTabs.includes('turni')) return;
        void handleTabChange('turni');
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSw);
    }
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSw);
      }
    };
  }, [visibleNavTabs, handleTabChange]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const u = new URL(window.location.href);
    if (!u.pathname.startsWith('/app')) return;
    const o = u.searchParams.get('open');
    if (o === 'punch_exit' && visibleNavTabs.includes('timesheet')) {
      u.searchParams.delete('open');
      window.history.replaceState({}, '', u.pathname + (u.search || '') + u.hash);
      void handleTabChange('timesheet');
    } else if (o === 'turni' && visibleNavTabs.includes('turni')) {
      u.searchParams.delete('open');
      window.history.replaceState({}, '', u.pathname + (u.search || '') + u.hash);
      void handleTabChange('turni');
    }
  }, [location.search, currentUser?.id, visibleNavTabs, handleTabChange]);

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
        const tr = getTranslations(effectiveLanguage);
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
  }, [visibleNavTabs, activeTab, effectiveLanguage]);

  const now = useMemo(() => new Date(), []);
  const isSynced = !!featureFlags && Object.keys(featureFlags).length > 0;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleHardRefresh = useCallback(async () => {
    if (isRefreshing || dataSyncInProgress) return;
    setIsRefreshing(true);
    try {
      await hardReloadFromDatabase();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, dataSyncInProgress, hardReloadFromDatabase]);

  const [showPinMenu, setShowPinMenu] = useState(false);
  const [globalPinValue, setGlobalPinValue] = useState('');
  const [globalPinError, setGlobalPinError] = useState('');
  const closePinMenu = useCallback(() => {
    setShowPinMenu(false);
    setGlobalPinValue('');
    setGlobalPinError('');
    unlockBodyScroll();
  }, []);
  const handleGlobalPinSubmit = useCallback(async (pin: string) => {
    const verifier = findFreezeVerifierByPin(users, pin);
    if (!verifier) {
      setGlobalPinError('PIN non riconosciuto');
      return;
    }
    setGlobalPinSessionId(Date.now().toString());
    closePinMenu();
  }, [users, setGlobalPinSessionId, closePinMenu]);
  useEffect(() => {
    if (showPinMenu) lockBodyScroll();
    else unlockBodyScroll();
    return () => unlockBodyScroll();
  }, [showPinMenu]);

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
        return isMobileViewport ? (
          <Suspense fallback={null}>
            <ManagementMobileShifts
              shifts={shifts}
              users={users}
              currentUserId={currentUser?.id ?? ''}
              language={effectiveLanguage}
            />
          </Suspense>
        ) : (
          <WeeklyShiftsTable />
        );
      case 'ferie':
        return <HolidayRequests />;
      case 'reports':
        // 'reports' is no longer a standalone tab — redirect to timesheet which hosts Statistiche as sub-tab
        void handleTabChange('timesheet');
        return null;
      case 'timesheet':
        return isMobileViewport ? (
          <Suspense fallback={null}>
            <ManagementMobileTimesheet
              shifts={shifts}
              punchRecords={punchRecords}
              users={users}
              currentUserId={currentUser?.id ?? ''}
              language={effectiveLanguage}
              plannedOnly={getTimesheetGridPrivacyMode(currentUser) === 'planned_only'}
            />
          </Suspense>
        ) : (
          <Timesheets />
        );
      case 'settings':
        return <SettingsPage />;
      case 'profile':
        return <Suspense fallback={null}><ProfileNavTabPanel onLogout={onLogout} onGoToSettings={() => void handleTabChange('settings')} /></Suspense>;
      default:
        return null;
    }
  };

  // Overlay sync admin: mostrato quando un admin ha pushato nuove impostazioni via push notification
  const [adminSyncPending, setAdminSyncPending] = useState(false);
  useEffect(() => {
    if (!navigator.serviceWorker) return;
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'FORCE_DATA_RELOAD' && currentUser?.role !== 'admin') {
        setAdminSyncPending(true);
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [currentUser?.role]);

  /** `overflow-visible` così popover / menu non vengono tagliati dal bordo arrotondato della card. */

  return (
    <ProfileLeaveGuardRefContext.Provider value={profileLeaveGuardRef}>
    {/* Overlay aggiornamento dati admin: mostrato su tutti i dispositivi non-admin */}
    <AnimatePresence>
      {adminSyncPending && (
        <AdminSyncOverlay
          onReload={() => hardReloadFromDatabase()}
          onDone={() => setAdminSyncPending(false)}
        />
      )}
    </AnimatePresence>
    {/* Onboarding obbligatorio: blocca l'interfaccia finché email/telefono non sono configurati */}
    {showOnboarding && (
      <Suspense fallback={null}><OnboardingSetupModal onComplete={() => setOnboardingDone(true)} /></Suspense>
    )}
    <AnimatePresence>
      {showPermissions && !showOnboarding && (
        <Suspense fallback={null}><PermissionRequestModal key="perm-modal" onDone={() => setShowPermissions(false)} /></Suspense>
      )}
    </AnimatePresence>
    <div className="min-h-screen min-h-[100dvh] w-full text-white font-sans antialiased overflow-x-clip safe-area-pad pt-0 flex flex-col">
      <BodyPullToRefresh
        onRefresh={() => silentRefreshData({ pullRemoteConfig: true })}
        disabled={!!(isGlobalRefreshing || postRefreshLocked || postUnlockReloadPending)}
      />

      {/* ── Banner Impersonazione (Cambio Rapido Admin) ── */}
      {impersonatingAs && originalAdminUser && (
        <div
          className="fixed left-0 right-0 z-[10039] flex items-center justify-between gap-2 px-4 py-2 text-sm font-semibold shadow-md"
          style={{
            top: 0,
            background: 'linear-gradient(90deg, #fef3c7 0%, #fde68a 100%)',
            borderBottom: '1px solid #f59e0b',
            color: '#92400e',
          }}
        >
          <span className="truncate">
            Sessione attiva come: <strong>{impersonatingAs.first_name}{impersonatingAs.last_name ? ` ${impersonatingAs.last_name}` : ''}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              setCtxCurrentUser(originalAdminUser);
              setIsSessionElevated(false);
              setImpersonating(null, null);
              void silentRefreshData?.();
            }}
            className="shrink-0 rounded-lg px-3 py-1 text-xs font-bold transition-colors hover:bg-amber-200 active:scale-95"
            style={{ background: '#fcd34d', color: '#78350f' }}
          >
            Torna ad Admin
          </button>
        </div>
      )}

      {/* ── Header fisso unificato: topbar + tabbar ── */}
      <header
        ref={appStickyHeaderRef}
        className={`fixed left-0 right-0 z-[10040] shrink-0 transition-[visibility,opacity,top] duration-150 ${
          overlayOpen ? 'invisible opacity-0 pointer-events-none' : ''
        } ${
          isGlobalRefreshing || postRefreshLocked || postUnlockReloadPending ? 'blur-md pointer-events-none' : ''
        }`}
        style={{
          top: impersonatingAs ? 40 : 0,
          background: 'rgba(5, 14, 46, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <MobileProfileHeader
          onLogout={onLogout}
          activeTab={activeTab}
          showOnDesktop
          compact={staffMobileCompactHeader}
          hideToolbarAvatar={false}
          rightExtra={
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleHardRefresh}
                disabled={isRefreshing || dataSyncInProgress}
                title={isRefreshing || dataSyncInProgress ? 'Sincronizzazione in corso...' : 'Sincronizza dati'}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation liquid-glass ${
                  isRefreshing || dataSyncInProgress
                    ? 'text-amber-500 liquid-glass-amber'
                    : isSynced
                      ? 'text-emerald-500 liquid-glass-green'
                      : 'text-slate-300'
                }`}
              >
                {isRefreshing || dataSyncInProgress ? (
                  <RotateCw className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
                ) : isSynced ? (
                  <span className="relative inline-flex">
                    <Cloud className="h-3.5 w-3.5" strokeWidth={2.5} />
                    <span className="absolute -bottom-0.5 -right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-500 text-white" style={{ fontSize: 7 }}>✓</span>
                  </span>
                ) : (
                  <CloudOff className="h-3.5 w-3.5" strokeWidth={2.5} />
                )}
              </button>
              {featureFlags['unlock_with_pin'] !== false && currentUser && isManagement && (
                <button
                  type="button"
                  onClick={() => setShowPinMenu(true)}
                  title={globalPinSessionId ? 'Sessione PIN attiva' : 'Sblocca sessione PIN'}
                  aria-label={globalPinSessionId ? 'Gestisci sessione PIN' : 'Sblocca sessione PIN'}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation liquid-glass ${
                    globalPinSessionId
                      ? 'text-emerald-500 liquid-glass-green'
                      : 'text-red-500 liquid-glass-red'
                  }`}
                >
                  {globalPinSessionId
                    ? <Unlock className="h-3.5 w-3.5" strokeWidth={2.5} />
                    : <Lock className="h-3.5 w-3.5" strokeWidth={2.5} />}
                </button>
              )}
            </div>
          }
        />
        {!noNavTabs && (
          <TopTabBar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            visibleTabs={bottomNavTabs}
          />
        )}
      </header>

      <main
        className={`flex-1 flex flex-col w-full min-h-0 ${isGlobalRefreshing || postRefreshLocked || postUnlockReloadPending ? 'blur-md pointer-events-none' : ''}`}
        style={{ paddingTop: 'var(--app-sticky-header-offset, 80px)' }}
      >
        <div className="w-full flex-1 app-horizontal-pad pt-3">
          {/* PIN portals */}
          {createPortal(
            <AnimatePresence>
              {showPinMenu && !globalPinSessionId && currentUser && (
                <PinPadModal
                  key="global-pin-lock"
                  title={t.global_pin_unlock_title}
                  subtitle={t.global_pin_unlock_subtitle}
                  pinLabel="PIN"
                  pin={globalPinValue}
                  onPinChange={setGlobalPinValue}
                  error={globalPinError}
                  onConfirm={() => handleGlobalPinSubmit(globalPinValue)}
                  onCancel={closePinMenu}
                  confirmLabel={t.ts_drawer_unlock_btn}
                  userId={currentUser.id}
                  userDisplayName={[currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ')}
                  userEmail={currentUser.email ?? ''}
                  onBiometricSuccess={() => {
                    const verifier = findFreezeVerifierById(users, currentUser.id);
                    if (!verifier) { setGlobalPinError(t.global_pin_unlock_insufficient_role); return; }
                    setGlobalPinSessionId(Date.now().toString());
                    closePinMenu();
                  }}
                />
              )}
            </AnimatePresence>,
            document.body
          )}
          {createPortal(
            <AnimatePresence>
              {showPinMenu && !!globalPinSessionId && (
                <motion.div
                  key="global-pin-unlock"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="fixed inset-0 z-[10080] bg-black/40 backdrop-blur-md flex flex-col items-center justify-center"
                >
                  <button type="button" onClick={closePinMenu} className="absolute top-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" aria-label={t.close}>
                    <X size={20} strokeWidth={2.5} />
                  </button>
                  <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.9 }} className="flex flex-col items-center w-full max-w-[320px] px-6">
                    <div className="flex flex-col items-center text-center mb-10">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/20 border-2 border-accent/40 mb-5">
                        <ShieldCheck className="w-9 h-9 text-accent" strokeWidth={2} />
                      </div>
                      <h2 className="text-white font-bold uppercase tracking-widest text-base mb-2">Sessione sbloccata</h2>
                      <p className="text-white/60 text-sm font-medium leading-tight px-4">Tutte le operazioni protette da PIN sono accessibili in questa sessione.</p>
                    </div>
                    <button type="button" onClick={() => { setGlobalPinSessionId(null); closePinMenu(); }} className="w-full h-14 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold flex items-center justify-center gap-2.5 transition-all active:scale-95 mb-3">
                      <ShieldOff className="w-5 h-5" strokeWidth={2} />
                      Blocca sessione
                    </button>
                    <button type="button" onClick={closePinMenu} className="w-full h-14 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white/70 font-bold transition-all active:scale-95">Annulla</button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}
          {noNavTabs ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-10 pb-content text-center text-sm text-amber-950 max-w-lg mx-auto">
              {(getTranslations(effectiveLanguage) as Record<string, string>).app_all_nav_tabs_disabled}
            </div>
          ) : isManagement ? (
            <AnimatePresence mode="wait" custom={tabNavDirection.current}>
              <motion.div
                key={activeTab}
                custom={tabNavDirection.current}
                variants={{
                  initial: (dir: number) => ({ opacity: 0, x: dir * 36 }),
                  animate: { opacity: 1, x: 0 },
                  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
                }}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.55, ease: [0.32, 0, 0.12, 1] }}
                className="w-full"
              >
                <Suspense fallback={null}>
                  {renderManagementContent()}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          ) : currentUser ? (
            <Suspense fallback={null}>
              <StaffPersonalDashboard
                user={currentUser}
                onLogout={onLogout}
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />
            </Suspense>
          ) : null}
        </div>
      </main>

      {isGlobalRefreshing && (() => {
        return (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 font-sans text-center px-4" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(0,82,255,0.22) 0%, transparent 55%), #000B18' }}>
            <div className="flex flex-col items-center gap-6">
              <motion.div
                animate={{
                  boxShadow: [
                    '0 0 32px rgba(0,82,255,0.70), 0 0 12px rgba(34,211,238,0.50)',
                    '0 0 56px rgba(0,82,255,1.00), 0 0 24px rgba(34,211,238,0.80)',
                    '0 0 32px rgba(0,82,255,0.70), 0 0 12px rgba(34,211,238,0.50)',
                  ],
                }}
                transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
                style={{ borderRadius: 32 }}
              >
                <FlowWaveIcon size={120} radius={32} />
              </motion.div>
              <div className="flex flex-col items-center gap-1 min-h-[40px]">
                <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">
                  {getTranslations(effectiveLanguage).sync_total_in_progress}
                </p>
                {syncStage ? (
                  <p className="text-white/90 text-sm font-medium">{syncStage}</p>
                ) : null}
              </div>
            </div>
          </div>
        );
      })()}

      <AnimatePresence mode="wait">
        {postRefreshLocked && <RefreshLockOverlay key="refresh-lock" />}
        {postUnlockReloadPending && !postRefreshLocked && (
          <PostUnlockRestartOverlay key="post-unlock-restart" language={effectiveLanguage} />
        )}
      </AnimatePresence>

    </div>
    </ProfileLeaveGuardRefContext.Provider>
  );
}

// ─── Protected App Route ───────────────────────────────────────────────────────
function ProtectedApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isLoading: appIsLoading, setCurrentUser, forceLogoutRequested, clearForceLogoutRequest, featureFlags, showError, effectiveLanguage, setIsSessionElevated } = useApp();

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
    navigate(PATH_PROFILO, { replace: true });
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
      navigate(PATH_PROFILO, { replace: true });
    }
  }, [
    forceLogoutRequested,
    clearForceLogoutRequest,
    currentUser?.id,
    currentUser?.language,
    setCurrentUser,
    navigate,
  ]);

  // Aspetta che AppContext abbia finito il caricamento iniziale (sessione da localStorage).
  // Senza questo check, currentUser è null per ~100-300ms e il redirect scatta prima
  // che la sessione salvata venga ripristinata.
  if (appIsLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="fixed inset-0 flex items-center justify-center font-sans"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(0,82,255,0.22) 0%, transparent 55%), #000B18' }}
      >
        <motion.div
          initial={{ scale: 0.82, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: 1,
            boxShadow: [
              '0 0 32px rgba(0,82,255,0.70), 0 0 12px rgba(34,211,238,0.50)',
              '0 0 56px rgba(0,82,255,1.00), 0 0 24px rgba(34,211,238,0.80)',
              '0 0 32px rgba(0,82,255,0.70), 0 0 12px rgba(34,211,238,0.50)',
            ],
          }}
          transition={{
            scale:     { duration: 0.6, ease: [0.34, 1.2, 0.64, 1] },
            opacity:   { duration: 0.5, ease: 'easeOut' },
            boxShadow: { duration: 2.4, ease: 'easeInOut', repeat: Infinity, delay: 0.5 },
          }}
          style={{ borderRadius: 38 }}
        >
          <FlowWaveIcon size={140} radius={38} />
        </motion.div>
      </motion.div>
    );
  }

  if (!currentUser) {
    return <Navigate to={PATH_PROFILO} replace state={{ from: location }} />;
  }

  if (featureFlags['maintenance_mode'] === true && currentUser.role !== 'admin') {
    return <MaintenancePage />;
  }

  return <MainApp onLogout={handleLogout} />;
}

// ─── Banner "Aggiungi a Home" per Safari iOS (non-standalone) ─────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function IosSafariInstallBanner() {
  const [visible, setVisible] = useState(() => {
    // Mostra solo su Safari iOS fuori dalla modalità standalone
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|fxios|crios/i.test(ua);
    const isStandalone =
      ('standalone' in window.navigator && (window.navigator as any).standalone === true) ||
      window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = sessionStorage.getItem('ios_install_banner_dismissed') === '1';
    return isIos && isSafari && !isStandalone && !dismissed;
  });

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[99990] flex items-center justify-between gap-3 px-4 py-2.5 font-sans"
      style={{
        background: 'rgba(0,26,128,0.96)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      <p className="text-[12px] text-white/90 leading-snug flex-1">
        Tocca{' '}
        <span className="inline-flex items-center gap-0.5 font-semibold text-[#6699FF]">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 2v11M6 6l4-4 4 4"/><rect x="3" y="13" width="14" height="6" rx="2"/></svg>
          Condividi
        </span>
        {' '}poi{' '}
        <span className="font-semibold text-white">«Aggiungi a Home»</span>
        {' '}per l'esperienza completa.
      </p>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem('ios_install_banner_dismissed', '1');
          setVisible(false);
        }}
        aria-label="Chiudi"
        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
      </button>
    </div>
  );
}

// Esporta per uso in routing
export { LoginRoute, ProtectedApp };

// ─── Root App ─────────────────────────────────────────────────────────────────
function AppContent() {
  return (
    <PwaGate>
    <Routes>
      <Route path="/" element={<Navigate to={PATH_PROFILO} replace />} />

      <Route path="/i/:slug" element={<InviteRedirect />} />
      <Route path="/kiosk" element={<Navigate to={PATH_PROFILO} replace />} />
      <Route path="/timbratura" element={<Navigate to={PATH_PROFILO} replace />} />
      <Route path={PATH_PROFILO} element={<LoginRoute />} />
      <Route path="/login" element={<Navigate to={PATH_PROFILO} replace />} />
      <Route path="/app" element={<ProtectedApp />} />
      <Route path="/app/*" element={<ProtectedApp />} />
      <Route path="/admin" element={<AdminGate><Suspense fallback={null}><AdminLayout /></Suspense></AdminGate>} />
      <Route path="/admin/*" element={<AdminGate><Suspense fallback={null}><AdminLayout /></Suspense></AdminGate>} />
      <Route path="/anim-preview" element={<Suspense fallback={null}><AnimPreview /></Suspense>} />
      <Route path="/loading-preview" element={<Suspense fallback={null}><LoadingPreview /></Suspense>} />
      <Route path="/screens-preview" element={
        <AppProvider>
          <Suspense fallback={<div className="min-h-screen w-full flex items-center justify-center bg-[#111] text-white/30 font-sans uppercase tracking-widest text-xs">Caricamento anteprime...</div>}>
            <ScreensPreview />
          </Suspense>
        </AppProvider>
      } />
      <Route path="*" element={<Navigate to={PATH_PROFILO} replace />} />
    </Routes>
    </PwaGate>
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
      {/* SuperAdminPanel — attivo solo sul dominio super-admin, protetto da PIN */}
      <Route path="/super-admin" element={
        isSuperAdminDomain
          ? <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white/50 text-sm">Caricamento…</div>}>
              <SuperAdminPanel />
            </Suspense>
          : <div className="min-h-screen flex items-center justify-center text-white p-6 text-center" style={{ background: 'transparent' }}>
              <div className="rounded-2xl border border-white/15 p-8 max-w-sm" style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}>
                <h1 className="text-2xl font-bold mb-2">SuperAdmin</h1>
                <p className="text-white/50 text-sm">Accedi da flow-workinmotion-super-admin.vercel.app</p>
              </div>
            </div>
      } />
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
