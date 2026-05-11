import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { User } from '../types';

interface SessionContextValue {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  users: User[];
  setUsers: (users: User[] | ((prev: User[]) => User[])) => void;
  isSessionElevated: boolean;
  setIsSessionElevated: (v: boolean) => void;
  impersonatingAs: User | null;
  originalAdminUser: User | null;
  setImpersonating: (targetUser: User | null, adminUser: User | null) => void;
  forceLogoutRequested: boolean;
  clearForceLogoutRequest: () => void;
  logout: () => void;
  globalPinSessionId: string | null;
  setGlobalPinSessionId: (id: string | null) => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isSessionElevated, setIsSessionElevated] = useState(false);
  const [impersonatingAs, setImpersonatingAs] = useState<User | null>(null);
  const [originalAdminUser, setOriginalAdminUser] = useState<User | null>(null);
  const [forceLogoutRequested, setForceLogoutRequested] = useState(false);
  const [globalPinSessionId, setGlobalPinSessionId] = useState<string | null>(null);

  const setImpersonating = useCallback((targetUser: User | null, adminUser: User | null) => {
    setImpersonatingAs(targetUser);
    setOriginalAdminUser(adminUser);
  }, []);

  const clearForceLogoutRequest = useCallback(() => {
    setForceLogoutRequested(false);
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setIsSessionElevated(false);
    setImpersonatingAs(null);
    setOriginalAdminUser(null);
    setGlobalPinSessionId(null);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        currentUser, setCurrentUser,
        users, setUsers,
        isSessionElevated, setIsSessionElevated,
        impersonatingAs, originalAdminUser, setImpersonating,
        forceLogoutRequested, clearForceLogoutRequest, logout,
        globalPinSessionId, setGlobalPinSessionId,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
