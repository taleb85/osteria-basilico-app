import type { Shift, User, PunchRecord } from '../types';
import { getResolvedStartEndForHours } from './shiftResolvedClockTimes';
import { getNetShiftMinutes } from './breakRules';

export interface LabourCostRow {
  userId: string;
  userName: string;
  department: string;
  role: string;
  hourlyRate: number;
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  plannedCost: number;
  actualCost: number;
  deltaCost: number;
  overtimeMinutes: number;
  overtimeCost: number;
  shiftCount: number;
}

export interface LabourCostSummary {
  rows: LabourCostRow[];
  totalPlannedCost: number;
  totalActualCost: number;
  totalDeltaCost: number;
  totalPlannedMinutes: number;
  totalActualMinutes: number;
  totalOvertimeCost: number;
  totalShiftCount: number;
  budgetCaps: BudgetCap[];
}

export interface BudgetCap {
  department: string;
  budgetMinutes: number;
  budgetCost: number;
  actualMinutes: number;
  actualCost: number;
  remainingMinutes: number;
  remainingCost: number;
}

interface CostConfig {
  users: User[];
  shifts: Shift[];
  punchRecords: PunchRecord[];
  dateRange: { start: string; end: string };
  breakRules?: any[];
  breakComputeOpts?: any;
  caps?: { department: string; budgetCost: number; budgetMinutes: number }[];
}

function parseRate(rate: number | string | null | undefined): number {
  if (rate == null) return 0;
  const n = typeof rate === 'string' ? parseFloat(rate) : rate;
  return Number.isFinite(n) ? n : 0;
}

function calcCost(minutes: number, hourlyRate: number): number {
  return (minutes / 60) * hourlyRate;
}

export function computeLabourCostDashboard(cfg: CostConfig): LabourCostSummary {
  const { users, shifts, punchRecords, dateRange, caps = [] } = cfg;
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rowMap = new Map<string, LabourCostRow>();

  for (const shift of shifts) {
    if (shift.date < dateRange.start || shift.date > dateRange.end) continue;
    const user = userMap.get(shift.user_id);
    if (!user) continue;

    const hourlyRate = parseRate(user.hourly_rate_eur);
    const { start, end } = getResolvedStartEndForHours(shift, punchRecords);
    const plannedMins = shift.start_time && shift.end_time
      ? getNetShiftMinutes(shift, shift.start_time, shift.end_time, user, cfg.breakRules ?? [], cfg.breakComputeOpts ?? {})
      : 0;
    const actualMins = start && end
      ? getNetShiftMinutes(shift, start, end, user, cfg.breakRules ?? [], cfg.breakComputeOpts ?? {})
      : plannedMins;

    const existing = rowMap.get(shift.user_id);
    const plannedCost = calcCost(plannedMins, hourlyRate);
    const actualCost = calcCost(actualMins, hourlyRate);

    if (existing) {
      existing.totalPlannedMinutes += plannedMins;
      existing.totalActualMinutes += actualMins;
      existing.plannedCost += plannedCost;
      existing.actualCost += actualCost;
      existing.deltaCost = existing.actualCost - existing.plannedCost;
      existing.shiftCount += 1;
      if (actualMins > plannedMins) {
        existing.overtimeMinutes += actualMins - plannedMins;
        existing.overtimeCost += calcCost(actualMins - plannedMins, hourlyRate * 1.25);
      }
    } else {
      rowMap.set(shift.user_id, {
        userId: shift.user_id,
        userName: [user.first_name, user.last_name].filter(Boolean).join(' '),
        department: user.department ?? '',
        role: user.role ?? '',
        hourlyRate,
        totalPlannedMinutes: plannedMins,
        totalActualMinutes: actualMins,
        plannedCost,
        actualCost,
        deltaCost: actualCost - plannedCost,
        overtimeMinutes: actualMins > plannedMins ? actualMins - plannedMins : 0,
        overtimeCost: actualMins > plannedMins ? calcCost(actualMins - plannedMins, hourlyRate * 1.25) : 0,
        shiftCount: 1,
      });
    }
  }

  const rows = Array.from(rowMap.values()).sort((a, b) => b.actualCost - a.actualCost);

  const summary: LabourCostSummary = {
    rows,
    totalPlannedCost: rows.reduce((s, r) => s + r.plannedCost, 0),
    totalActualCost: rows.reduce((s, r) => s + r.actualCost, 0),
    totalDeltaCost: rows.reduce((s, r) => s + r.deltaCost, 0),
    totalPlannedMinutes: rows.reduce((s, r) => s + r.totalPlannedMinutes, 0),
    totalActualMinutes: rows.reduce((s, r) => s + r.totalActualMinutes, 0),
    totalOvertimeCost: rows.reduce((s, r) => s + r.overtimeCost, 0),
    totalShiftCount: rows.reduce((s, r) => s + r.shiftCount, 0),
    budgetCaps: caps.map((cap) => {
      const deptRows = rows.filter((r) => r.department === cap.department);
      const actualCost = deptRows.reduce((s, r) => s + r.actualCost, 0);
      const actualMins = deptRows.reduce((s, r) => s + r.totalActualMinutes, 0);
      return {
        department: cap.department,
        budgetMinutes: cap.budgetMinutes,
        budgetCost: cap.budgetCost,
        actualMinutes: actualMins,
        actualCost,
        remainingMinutes: cap.budgetMinutes - actualMins,
        remainingCost: cap.budgetCost - actualCost,
      };
    }),
  };

  return summary;
}


