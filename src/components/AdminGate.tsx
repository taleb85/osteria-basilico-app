import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isAdminOnly } from '../utils/permissions';
import { PATH_PROFILO } from '../config/appPaths';

interface AdminGateProps {
  children: React.ReactNode;
}

/** Protegge il pannello Admin: solo ruolo `admin`. */
export default function AdminGate({ children }: AdminGateProps) {
  const { currentUser, showError } = useApp();
  const location = useLocation();

  useEffect(() => {
    if (currentUser && !isAdminOnly(currentUser)) {
      showError?.('Accesso Negato');
    }
  }, [currentUser, showError]);

  if (!currentUser) {
    return <Navigate to={PATH_PROFILO} replace state={{ from: location }} />;
  }

  if (!isAdminOnly(currentUser)) {
    return <Navigate to="/app" replace state={{ accessDenied: true } as { accessDenied?: boolean }} />;
  }

  return <>{children}</>;
}
