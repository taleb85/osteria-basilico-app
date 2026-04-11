import { useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { PATH_PROFILO } from '../config/appPaths';

interface AdminGateProps {
  children: React.ReactNode;
}

/** Protegge il pannello Admin: ruolo `admin`, `manager`, `assistant_manager` o sessione elevata via PIN secondario. */
export default function AdminGate({ children }: AdminGateProps) {
  const { currentUser, showError, isSessionElevated } = useApp();
  const location = useLocation();

  const isAllowed = useMemo(() => {
    if (!currentUser) return false;
    if (isSessionElevated) return true;
    if (currentUser.elevated_role) return true;
    return currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'assistant_manager';
  }, [currentUser, isSessionElevated]);

  useEffect(() => {
    if (currentUser && !isAllowed) {
      showError?.('Accesso Negato');
    }
  }, [currentUser, isAllowed, showError]);

  if (!currentUser) {
    return <Navigate to={PATH_PROFILO} replace state={{ from: location }} />;
  }

  if (!isAllowed) {
    return <Navigate to="/app" replace state={{ accessDenied: true } as { accessDenied?: boolean }} />;
  }

  return <>{children}</>;
}
