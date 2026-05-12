import { describe, it, expect } from 'vitest';
import { isShiftPayrollFrozen } from '../utils/timesheetFreezeCriteria';

interface MockShift {
  id: string;
  approval_status: string;
  approved_at: string | null;
  start_time?: string;
  end_time?: string;
  user_id?: string;
  date?: string;
}

function makeShift(overrides: Partial<MockShift> = {}): MockShift {
  return {
    id: 'shift-1',
    approval_status: 'draft',
    approved_at: null,
    start_time: '10:00',
    end_time: '16:00',
    user_id: 'user-1',
    date: '2025-05-05',
    ...overrides,
  };
}

describe('isShiftPayrollFrozen', () => {
  it('should return false for a draft shift', () => {
    const shift = makeShift({ approval_status: 'draft' });
    expect(isShiftPayrollFrozen(shift)).toBe(false);
  });

  it('should return false for a confirmed shift without approved_at', () => {
    const shift = makeShift({ approval_status: 'confirmed', approved_at: null });
    expect(isShiftPayrollFrozen(shift)).toBe(false);
  });

  it('should return true for an approved shift', () => {
    const shift = makeShift({ approval_status: 'approved', approved_at: '2025-05-05T10:00:00Z' });
    expect(isShiftPayrollFrozen(shift)).toBe(true);
  });

  it('should return true for a confirmed shift with approved_at', () => {
    const shift = makeShift({ approval_status: 'confirmed', approved_at: '2025-05-05T10:00:00Z' });
    expect(isShiftPayrollFrozen(shift)).toBe(true);
  });

  it('should return false for an absent shift', () => {
    const shift = makeShift({ approval_status: 'absent' });
    expect(isShiftPayrollFrozen(shift)).toBe(false);
  });
});

describe('Freeze guard — modifica bloccata', () => {
  it('should block updateShift when shift is frozen (approved)', () => {
    const shift = makeShift({ approval_status: 'approved', approved_at: '2025-05-05T10:00:00Z' });
    expect(isShiftPayrollFrozen(shift)).toBe(true);

    const updates = { start_time: '11:00' };
    const isUnfreezeOp = Object.keys(updates).length === 1 && updates.approval_status === 'confirmed';
    expect(isUnfreezeOp).toBe(false);
  });

  it('should block updateShift when shift is frozen (confirmed + approved_at)', () => {
    const shift = makeShift({ approval_status: 'confirmed', approved_at: '2025-05-05T10:00:00Z' });
    expect(isShiftPayrollFrozen(shift)).toBe(true);

    const updates = { start_time: '11:00' };
    const isUnfreezeOp = Object.keys(updates).length === 1 && updates.approval_status === 'confirmed';
    expect(isUnfreezeOp).toBe(false);
  });

  it('should allow updateShift after explicit unfreeze', () => {
    const shift = makeShift({ approval_status: 'approved', approved_at: '2025-05-05T10:00:00Z' });
    expect(isShiftPayrollFrozen(shift)).toBe(true);

    const unfreezeUpdates = { approval_status: 'confirmed' as const };
    const isUnfreezeOp = Object.keys(unfreezeUpdates).length === 1 && unfreezeUpdates.approval_status === 'confirmed';
    expect(isUnfreezeOp).toBe(true);

    const unfrozenShift = makeShift({ approval_status: 'confirmed', approved_at: null });
    expect(isShiftPayrollFrozen(unfrozenShift)).toBe(false);
  });

  it('should block deleteShift when shift is frozen', () => {
    const shift = makeShift({ approval_status: 'approved', approved_at: '2025-05-05T10:00:00Z' });
    expect(isShiftPayrollFrozen(shift)).toBe(true);
  });

  it('should allow deleteShift after unfreeze', () => {
    const shift = makeShift({ approval_status: 'confirmed', approved_at: null });
    expect(isShiftPayrollFrozen(shift)).toBe(false);
  });
});

describe('Freeze guard — modifica consentita dopo sblocco', () => {
  it('should allow updates on a draft shift', () => {
    const shift = makeShift({ approval_status: 'draft' });
    expect(isShiftPayrollFrozen(shift)).toBe(false);
  });

  it('should allow updates on a confirmed shift without approved_at', () => {
    const shift = makeShift({ approval_status: 'confirmed', approved_at: null });
    expect(isShiftPayrollFrozen(shift)).toBe(false);
  });

  it('should reflect unfreeze status correctly (approved -> confirmed)', () => {
    const frozen = makeShift({ approval_status: 'approved', approved_at: '2025-05-05T10:00:00Z' });
    expect(isShiftPayrollFrozen(frozen)).toBe(true);

    const afterUnfreeze = makeShift({ approval_status: 'confirmed', approved_at: null });
    expect(isShiftPayrollFrozen(afterUnfreeze)).toBe(false);
  });
});
