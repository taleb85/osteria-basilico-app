import { useState, useCallback, useRef } from 'react';
import type { User, UserRole, UserStatus, Department } from '../types';
import { database } from '../lib/database';
import { APP_SESSION_STORAGE_KEY } from '../constants/appSession';

export interface UseUsersReturn {
  users: User[];
  currentUser: User | null;
  isLoading: boolean;
  setUsers: (users: User[]) => void;
  setCurrentUser: (user: User | null) => void;
  loadUsers: () => Promise<void>;
  createUser: (payload: {
    first_name: string;
    last_name?: string;
    email: string;
    role: UserRole;
    pin: string;
    status: UserStatus;
    department?: Department;
    hourly_rate_eur?: number | null;
    employment_start_date?: string | null;
    employment_end_date?: string | null;
  }) => Promise<User | null>;
  updateUser: (id: string, updates: Partial<User>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  reorderUsers: (userId: string, direction: 'up' | 'down') => void;
  setUsersSortOrder: (orderedIds: string[]) => void;
}

export function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await database.users.getAll();
      setUsers(data);
    } catch (e) {
      console.error('[useUsers] loadUsers error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createUser = useCallback(async (payload: {
    first_name: string;
    last_name?: string;
    email: string;
    role: UserRole;
    pin: string;
    status: UserStatus;
    department?: Department;
    hourly_rate_eur?: number | null;
    employment_start_date?: string | null;
    employment_end_date?: string | null;
  }): Promise<User | null> => {
    try {
      const user = await database.users.insert(payload as unknown as Omit<User, 'id'>);
      if (user) {
        setUsers((prev) => [...prev, user]);
      }
      return user;
    } catch (e) {
      console.error('[useUsers] createUser error:', e);
      return null;
    }
  }, []);

  const updateUser = useCallback(async (id: string, updates: Partial<User>): Promise<boolean> => {
    try {
      const updated = await database.users.update(id, updates);
      if (updated) {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
        if (currentUser?.id === id) {
          setCurrentUser({ ...currentUser, ...updated });
        }
      }
      return !!updated;
    } catch (e) {
      console.error('[useUsers] updateUser error:', e);
      return false;
    }
  }, [currentUser]);

  const deleteUser = useCallback(async (id: string): Promise<boolean> => {
    try {
      await database.users.delete(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      return true;
    } catch (e) {
      console.error('[useUsers] deleteUser error:', e);
      return false;
    }
  }, []);

  const reorderUsers = useCallback((userId: string, direction: 'up' | 'down') => {
    setUsers((prev) => {
      const sorted = [...prev].sort((a, b) => a.sort_order - b.sort_order);
      const idx = sorted.findIndex((u) => u.id === userId);
      if (idx === -1) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const temp = sorted[idx].sort_order;
      sorted[idx] = { ...sorted[idx], sort_order: sorted[swapIdx].sort_order };
      sorted[swapIdx] = { ...sorted[swapIdx], sort_order: temp };
      return sorted.sort((a, b) => a.sort_order - b.sort_order);
    });
  }, []);

  const setUsersSortOrder = useCallback((orderedIds: string[]) => {
    setUsers((prev) => {
      const map = new Map(prev.map((u) => [u.id, u]));
      return orderedIds.map((id, i) => {
        const u = map.get(id);
        return u ? { ...u, sort_order: i } : null;
      }).filter(Boolean) as User[];
    });
  }, []);

  return {
    users,
    currentUser,
    isLoading,
    setUsers,
    setCurrentUser,
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    reorderUsers,
    setUsersSortOrder,
  };
}
