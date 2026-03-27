import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import type { Shift, PunchRecord, User } from '../types';
import { getResolvedStartEndForHours } from './shiftResolvedClockTimes';
import { getNetShiftMinutes, BreakRule } from './breakRules';

export interface UserStats {
  weeklyMinutes: number;
  monthlyMinutes: number;
  weeklyPercentage: number;
  monthDaysWorked: number;
}

export function calculateUserStats(
  user: User,
  shifts: Shift[],
  punchRecords: PunchRecord[],
  now: Date,
  breakRules: BreakRule[],
  options: { autoBreaksFeatureEnabled: boolean }
): UserStats {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  let weeklyMinutes = 0;
  let monthlyMinutes = 0;
  const monthDaysSet = new Set<string>();

  const visibleShifts = shifts.filter(
    (s) => s.approval_status === 'approved' || s.approval_status === 'confirmed' || s.approval_status === 'absent'
  );

  for (const shift of visibleShifts) {
    const shiftDate = parseISO(shift.date);
    const isAbsent = (shift.approval_status ?? '').toString().toLowerCase() === 'absent';

    // Calcolo settimanale
    if (isWithinInterval(shiftDate, { start: weekStart, end: weekEnd })) {
      if (!isAbsent) {
        const { start, end } = getResolvedStartEndForHours(shift, punchRecords);
        weeklyMinutes += getNetShiftMinutes(shift, start, end, user, breakRules, options);
      }
    }

    // Calcolo mensile
    if (isWithinInterval(shiftDate, { start: monthStart, end: monthEnd })) {
      if (!isAbsent) {
        const { start, end } = getResolvedStartEndForHours(shift, punchRecords);
        monthlyMinutes += getNetShiftMinutes(shift, start, end, user, breakRules, options);
        monthDaysSet.add(shift.date);
      }
    }
  }

  const targetMinutes = 40 * 60;
  const weeklyPercentage = Math.min(100, Math.round((weeklyMinutes / targetMinutes) * 100));

  return {
    weeklyMinutes,
    monthlyMinutes,
    weeklyPercentage,
    monthDaysWorked: monthDaysSet.size,
  };
}
