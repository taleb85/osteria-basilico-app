import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { PATH_PROFILO } from '../config/appPaths';
import InviteRedirect from '../components/InviteRedirect';
import AdminGate from '../components/AdminGate';
import AdminLayout from '../components/AdminLayout';
import { PwaGate } from '../components/PwaGate';

// Lazy imports
const AnimPreview = lazy(() => import('../components/AnimPreview'));
const LoadingPreview = lazy(() => import('../components/LoadingPreview'));
const ScreensPreview = lazy(() => import('../components/ScreensPreview'));

// Import componenti routing da App.tsx originale
// (dovranno essere estratti in file separati in future per completare refactor)
import { LoginRoute, ProtectedApp } from './AppRoutes';
import { AppProviders } from '../components/AppProviders';

/**
 * Routing principale app (tutto tranne super-admin)
 */
export function AppRoutes() {
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
        <Route path="/admin" element={<AdminGate><AdminLayout /></AdminGate>} />
        <Route path="/admin/*" element={<AdminGate><AdminLayout /></AdminGate>} />
        <Route path="/anim-preview" element={<Suspense fallback={null}><AnimPreview /></Suspense>} />
        <Route path="/loading-preview" element={<Suspense fallback={null}><LoadingPreview /></Suspense>} />
        <Route path="/screens-preview" element={
          <AppProviders>
            <Suspense fallback={<div className="min-h-screen w-full flex items-center justify-center bg-[#111] text-white/30 font-sans uppercase tracking-widest text-xs">Caricamento anteprime...</div>}>
              <ScreensPreview />
            </Suspense>
          </AppProviders>
        } />
        <Route path="*" element={<Navigate to={PATH_PROFILO} replace />} />
      </Routes>
    </PwaGate>
  );
}
