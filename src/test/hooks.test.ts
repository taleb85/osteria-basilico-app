import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock database
vi.mock('../lib/database', () => ({
  database: {
    users: {
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockResolvedValue({ id: 'new-id', first_name: 'Test', email: 'test@test.com' }),
      update: vi.fn().mockResolvedValue({ id: 'test', first_name: 'Updated' }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    shifts: {
      getAll: vi.fn().mockResolvedValue([]),
      getByUserId: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue({ id: 'shift1', date: '2025-01-01' }),
      update: vi.fn().mockResolvedValue({ id: 'shift1', date: '2025-01-01' }),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteMany: vi.fn().mockResolvedValue(undefined),
      getIdsByDateRange: vi.fn().mockResolvedValue([]),
    },
    punchRecords: {
      getAll: vi.fn().mockResolvedValue([]),
      getByUserId: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue({ id: 'punch1', type: 'in' }),
      update: vi.fn().mockResolvedValue({ id: 'punch1' }),
      deleteByShiftId: vi.fn().mockResolvedValue(undefined),
    },
    holidays: {
      getAll: vi.fn().mockResolvedValue([]),
      getByUserId: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockResolvedValue({ id: 'hol1', status: 'pending' }),
      update: vi.fn().mockResolvedValue({ id: 'hol1', status: 'approved' }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    availability: {
      getAll: vi.fn().mockResolvedValue([]),
      getByUserId: vi.fn().mockResolvedValue([]),
      toggle: vi.fn().mockResolvedValue({ id: 'avail1', start_date: '2025-01-01' }),
    },
  },
  formatSupabaseError: vi.fn().mockReturnValue('formatted error'),
}));

vi.mock('../lib/supabase', () => ({
  supabase: null,
  getTenantId: () => null,
  setTenantId: () => {},
}));

vi.mock('../constants/appSession', () => ({
  APP_SESSION_STORAGE_KEY: 'test_session_key',
}));

describe('useUsers', () => {
  it('should return empty users initially', async () => {
    const { useUsers } = await import('../hooks/useUsers');
    const { result } = renderHook(() => useUsers());
    expect(result.current.users).toEqual([]);
    expect(result.current.currentUser).toBeNull();
  });

  it('should load users', async () => {
    const { useUsers } = await import('../hooks/useUsers');
    const { result } = renderHook(() => useUsers());
    
    await act(async () => {
      await result.current.loadUsers();
    });

    expect(result.current.users).toEqual([]);
  });
});

describe('useSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return null user initially', async () => {
    const { useSession } = await import('../hooks/useSession');
    const { result } = renderHook(() => useSession());
    expect(result.current.currentUser).toBeNull();
  });

  it('should save and restore session', async () => {
    const { useSession } = await import('../hooks/useSession');
    const { result } = renderHook(() => useSession());
    const user = { id: 'user1', first_name: 'Test', last_name: 'User', email: 'test@test.com', role: 'waiter' } as any;

    act(() => {
      result.current.saveSession(user, 'test-tenant');
    });

    const restored = result.current.restoreSession();
    expect(restored).toBeTruthy();
    expect(restored?.id).toBe('user1');
  });

  it('should clear session', async () => {
    const { useSession } = await import('../hooks/useSession');
    const { result } = renderHook(() => useSession());
    const user = { id: 'user1', first_name: 'Test', role: 'waiter' } as any;

    act(() => {
      result.current.saveSession(user);
    });

    act(() => {
      result.current.clearSession();
    });

    const restored = result.current.restoreSession();
    expect(restored).toBeNull();
  });

  it('should set impersonating', async () => {
    const { useSession } = await import('../hooks/useSession');
    const { result } = renderHook(() => useSession());
    const target = { id: 'target', first_name: 'Target' } as any;
    const admin = { id: 'admin', first_name: 'Admin' } as any;

    act(() => {
      result.current.setImpersonating(target, admin);
    });

    expect(result.current.impersonatingAs?.id).toBe('target');
    expect(result.current.originalAdminUser?.id).toBe('admin');
  });
});

describe('useShifts', () => {
  it('should return empty shifts initially', async () => {
    const { useShifts } = await import('../hooks/useShifts');
    const { result } = renderHook(() => useShifts());
    expect(result.current.shifts).toEqual([]);
  });

  it('should load shifts', async () => {
    const { useShifts } = await import('../hooks/useShifts');
    const { result } = renderHook(() => useShifts());
    
    await act(async () => {
      await result.current.loadShifts();
    });

    expect(result.current.shifts).toEqual([]);
  });
});

describe('usePunchRecords', () => {
  it('should return empty records initially', async () => {
    const { usePunchRecords } = await import('../hooks/usePunchRecords');
    const { result } = renderHook(() => usePunchRecords());
    expect(result.current.punchRecords).toEqual([]);
  });
});

describe('useHolidays', () => {
  it('should return empty holidays initially', async () => {
    const { useHolidays } = await import('../hooks/useHolidays');
    const { result } = renderHook(() => useHolidays());
    expect(result.current.holidays).toEqual([]);
    expect(result.current.availability).toEqual([]);
  });

  it('should load holidays', async () => {
    const { useHolidays } = await import('../hooks/useHolidays');
    const { result } = renderHook(() => useHolidays());
    
    await act(async () => {
      await result.current.loadHolidays();
    });

    expect(result.current.holidays).toEqual([]);
  });
});
