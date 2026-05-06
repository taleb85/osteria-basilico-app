import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase
vi.mock('../lib/supabase', () => ({
  supabase: null,
  getTenantId: () => null,
  setTenantId: () => {},
}));

describe('database module', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should export database object', async () => {
    const mod = await import('../lib/database');
    expect(mod.database).toBeDefined();
    expect(mod.database.users).toBeDefined();
    expect(mod.database.shifts).toBeDefined();
    expect(mod.database.punchRecords).toBeDefined();
    expect(mod.database.holidays).toBeDefined();
    expect(mod.database.availability).toBeDefined();
    expect(mod.database.shiftTemplates).toBeDefined();
    expect(mod.database.realtime).toBeDefined();
  });

  it('should export formatSupabaseError', async () => {
    const mod = await import('../lib/database');
    expect(typeof mod.formatSupabaseError).toBe('function');
  });

  it('formatSupabaseError should format error message', async () => {
    const mod = await import('../lib/database');
    const result = mod.formatSupabaseError({
      message: 'Test error',
      details: 'Detail info',
      hint: 'Try again',
    });
    expect(result).toContain('Test error');
    expect(result).toContain('Detail info');
    expect(result).toContain('Try again');
  });

  it('formatSupabaseError should handle empty error', async () => {
    const mod = await import('../lib/database');
    const result = mod.formatSupabaseError({});
    expect(result).toBe('');
  });
});

describe('database users (supabase null)', () => {
  it('should return empty array for getAll', async () => {
    const { database } = await import('../lib/database');
    const users = await database.users.getAll();
    expect(users).toEqual([]);
  });

  it('should return null for getById', async () => {
    const { database } = await import('../lib/database');
    const user = await database.users.getById('test-id');
    expect(user).toBeNull();
  });

  it('should return null for insert', async () => {
    const { database } = await import('../lib/database');
    const result = await database.users.insert({} as any);
    expect(result).toBeNull();
  });

  it('should return null for update', async () => {
    const { database } = await import('../lib/database');
    const result = await database.users.update('test-id', {});
    expect(result).toBeNull();
  });

  it('should not throw on delete', async () => {
    const { database } = await import('../lib/database');
    await expect(database.users.delete('test-id')).resolves.toBeUndefined();
  });
});

describe('database shifts (supabase null)', () => {
  it('should return empty array for getAll', async () => {
    const { database } = await import('../lib/database');
    const shifts = await database.shifts.getAll();
    expect(shifts).toEqual([]);
  });

  it('should return null for insert', async () => {
    const { database } = await import('../lib/database');
    const result = await database.shifts.insert({} as any);
    expect(result).toBeNull();
  });
});

describe('database punchRecords (supabase null)', () => {
  it('should return empty array', async () => {
    const { database } = await import('../lib/database');
    const records = await database.punchRecords.getAll();
    expect(records).toEqual([]);
  });

  it('should return null on insert', async () => {
    const { database } = await import('../lib/database');
    const result = await database.punchRecords.insert({} as any);
    expect(result).toBeNull();
  });
});

describe('database holidays (supabase null)', () => {
  it('should return empty array', async () => {
    const { database } = await import('../lib/database');
    const holidays = await database.holidays.getAll();
    expect(holidays).toEqual([]);
  });
});

describe('database availability (supabase null)', () => {
  it('should return empty array', async () => {
    const { database } = await import('../lib/database');
    const avail = await database.availability.getAll();
    expect(avail).toEqual([]);
  });
});

describe('database hardResetTestData (supabase null)', () => {
  it('should return zeros', async () => {
    const { database } = await import('../lib/database');
    const result = await database.hardResetTestData();
    expect(result).toEqual({ shifts: 0, holidays: 0, punchRecords: 0 });
  });
});
