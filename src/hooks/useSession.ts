import { useState, useCallback } from 'react';
import type { User } from '../types';
import { APP_SESSION_STORAGE_KEY } from '../constants/appSession';

export interface SessionData {
  currentUser: User | null;
  isSessionElevated: boolean;
  impersonatingAs: User | null;
  originalAdminUser: User | null;
  globalPinSessionId: string | null;
  forceLogoutRequested: boolean;
}

export interface UseSessionReturn extends SessionData {
  setCurrentUser: (user: User | null) => void;
  setIsSessionElevated: (v: boolean) => void;
  setImpersonating: (targetUser: User | null, adminUser: User | null) => void;
  setGlobalPinSessionId: (id: string | null) => void;
  requestForceLogout: () => void;
  clearForceLogoutRequest: () => void;
  saveSession: (user: User, tenantSlug?: string) => void;
  clearSession: () => void;
  restoreSession: () => User | null;
}

export function useSession(): UseSessionReturn {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSessionElevated, setIsSessionElevated] = useState(false);
  const [impersonatingAs, setImpersonatingAs] = useState<User | null>(null);
  const [originalAdminUser, setOriginalAdminUser] = useState<User | null>(null);
  const [globalPinSessionId, setGlobalPinSessionId] = useState<string | null>(null);
  const [forceLogoutRequested, setForceLogoutRequested] = useState(false);

  const setImpersonating = useCallback((targetUser: User | null, adminUser: User | null) => {
    setImpersonatingAs(targetUser);
    setOriginalAdminUser(adminUser);
  }, []);

  const requestForceLogout = useCallback(() => {
    setForceLogoutRequested(true);
  }, []);

  const clearForceLogoutRequest = useCallback(() => {
    setForceLogoutRequested(false);
  }, []);

  const saveSession = useCallback((user: User, tenantSlug?: string) => {
    try {
      const session = {
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: user.role,
          language: user.language,
          theme: user.theme,
        },
        tenantSlug,
        savedAt: Date.now(),
      };
      localStorage.setItem(APP_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      /* storage non disponibile */
    }
  }, []);

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(APP_SESSION_STORAGE_KEY);
    } catch {
      /* storage non disponibile */
    }
  }, []);

  const restoreSession = useCallback((): User | null => {
    try {
      const raw = localStorage.getItem(APP_SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const u = parsed?.user;
      if (!u?.id) return null;
      return u as User;
    } catch {
      return null;
    }
  }, []);

  return {
    currentUser,
    isSessionElevated,
    impersonatingAs,
    originalAdminUser,
    globalPinSessionId,
    forceLogoutRequested,
    setCurrentUser,
    setIsSessionElevated,
    setImpersonating,
    setGlobalPinSessionId,
    requestForceLogout,
    clearForceLogoutRequest,
    saveSession,
    clearSession,
    restoreSession,
  };
}
