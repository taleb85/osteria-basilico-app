import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isManagementRole } from '../utils/permissions';
import { isAdminSettingsTabEnabled } from '../utils/enabledFeatures';
import { PATH_PROFILO } from '../config/appPaths';

interface AdminGateProps {
  children: React.ReactNode;
}

/** Protegge il pannello Admin: Admin, Proprietario, Manager, Assistant Manager. Altrimenti redirect a /app. */
export default function AdminGate({ children }: AdminGateProps) {
  const { currentUser, showError } = useApp();
  const location = useLocation();

  useEffect(() => {
    if (currentUser && !isManagementRole(currentUser.role)) {
      showError?.('Accesso Negato');
    }
  }, [currentUser, showError]);

  if (!currentUser) {
    return <Navigate to={PATH_PROFILO} replace state={{ from: location }} />;
  }

  if (!isManagementRole(currentUser.role)) {
    return <Navigate to="/app" replace state={{ accessDenied: true } as { accessDenied?: boolean }} />;
  }

  if (!isAdminSettingsTabEnabled(currentUser)) {
    return <Navigate to="/app" replace state={{ accessDenied: true } as { accessDenied?: boolean }} />;
  }

  return <>{children}</>;
}
