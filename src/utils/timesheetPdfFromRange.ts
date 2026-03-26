/**
 * Costruisce la griglia presenze come in Timesheets e genera il PDF (stesso layout exportTimesheetPdf).
 * Usato da Presenze e Ore.
 */
import { format, addDays, isValid } from 'date-fns';
import type { Locale } from 'date-fns';
import type { Shift, PunchRecord, User } from '../types';
import { calculateShiftMinutesGross } from './timeCalculations';
import { getBreakMinutesForShift, getNetShiftMinutes, type BreakRule } from './breakRules';
import { getResolvedStartEndForHours } from './shiftResolvedClockTimes';
import {
  exportTimesheetPdfToFile,
  type TimesheetPdfDayData,
  type TimesheetPdfUser,
} from './exportTimesheetPdf';

function toMinutesFromMidnight(hhmm: string): number {
  const [h, m] = (hhmm || '00:00').slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function punchTimeHHMM(ts: string | null | undefined): string | null {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

type GridShiftRow = {
  plannedStart: string;
  plannedEnd: string;
  plannedMins: number;
  breakMinutes: number;
  breakMinutesActual: number;
  actualStart: string | null;
  actualEnd: string | null;
  actualMins: number;
  deltaMins: number;
  status: 'approved' | 'confirmed' | 'draft' | 'absent';
  punched: boolean;
  hasMissingOut: boolean;
};

type GridDayData = {
  shifts: GridShiftRow[];
  totalPlannedMins: number;
  totalActualMins: number;
  totalDeltaMins: number;
};

function computeTimesheetGridForPdf(
  weekDays: Date[],
  weekShifts: Shift[],
  visibleUsers: User[],
  punchRecords: PunchRecord[],
  breakRules: BreakRule[],
  breakComputeOpts: { autoBreaksFeatureEnabled?: boolean }
): Record<string, Record<string, GridDayData>> {
  const data: Record<string, Record<string, GridDayData>> = {};

  for (const user of visibleUsers) {
    data[user.id] = {};
    for (const day of weekDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayShifts = weekShifts
        .filter((s) => s.user_id === user.id && s.date === dateStr)
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

      const shiftRows: GridShiftRow[] = dayShifts.map((s) => {
        const plannedStart = (s.start_time || '').slice(0, 5);
        const plannedEnd = (s.end_time || '').slice(0, 5);
        const grossPlanned = calculateShiftMinutesGross(plannedStart, plannedEnd);
        const breakMinutes = getBreakMinutesForShift(s, grossPlanned, user, breakRules, breakComputeOpts);
        const plannedMins = Math.max(0, grossPlanned - breakMinutes);

        if (s.approval_status === 'absent') {
          return {
            plannedStart,
            plannedEnd,
            plannedMins,
            breakMinutes,
            breakMinutesActual: 0,
            actualStart: null,
            actualEnd: null,
            actualMins: 0,
            deltaMins: -plannedMins,
            status: 'absent' as const,
            punched: false,
            hasMissingOut: false,
          };
        }

        const shiftHour = parseInt(plannedStart.split(':')[0], 10);
        const isLunch = shiftHour < 16;

        const punchIn = punchRecords.find((p) => {
          if (p.type !== 'in') return false;
          if (s.id && p.shift_id) return p.shift_id === s.id;
          if (p.user_id !== user.id) return false;
          const pDate = new Date(p.timestamp);
          if (!isValid(pDate)) return false;
          if (format(pDate, 'yyyy-MM-dd') !== dateStr) return false;
          return isLunch ? pDate.getHours() < 16 : pDate.getHours() >= 16;
        });

        const punchOut = punchRecords.find((p) => {
          if (p.type !== 'out') return false;
          if (s.id && p.shift_id) return p.shift_id === s.id;
          if (p.user_id !== user.id) return false;
          const pDate = new Date(p.timestamp);
          if (!isValid(pDate)) return false;
          if (format(pDate, 'yyyy-MM-dd') !== dateStr) return false;
          return isLunch ? pDate.getHours() < 16 : pDate.getHours() >= 16;
        });

        const clockOutRaw = (punchIn as { clock_out_time?: string | null })?.clock_out_time ?? null;
        const punchActualStart = punchIn ? punchTimeHHMM(punchIn.calculated_time || punchIn.timestamp) : null;
        const actualEndFull = clockOutRaw ?? punchOut?.timestamp ?? undefined;
        const punchActualEnd = actualEndFull ? punchTimeHHMM(actualEndFull) : null;

        const frozen = !!(s.approved_at && s.approved_start_time && s.approved_end_time);
        let displayActualStart = punchActualStart;
        let displayActualEnd = punchActualEnd;
        let grossActualMins = 0;

        if (frozen) {
          const r = getResolvedStartEndForHours(s as Shift, punchRecords);
          displayActualStart = r.start;
          displayActualEnd = r.end;
          grossActualMins = calculateShiftMinutesGross(r.start, r.end);
        } else if (punchActualStart && punchActualEnd) {
          const startM = toMinutesFromMidnight(punchActualStart);
          const endM = toMinutesFromMidnight(punchActualEnd);
          const elapsedMs =
            actualEndFull && punchIn
              ? new Date(actualEndFull).getTime() -
                new Date(punchIn.calculated_time || punchIn.timestamp).getTime()
              : (endM >= startM ? endM - startM : endM + 1440 - startM) * 60_000;
          grossActualMins = Math.max(0, Math.round(elapsedMs / 60_000));
        }

        const actualMins =
          displayActualStart && displayActualEnd
            ? getNetShiftMinutes(
                s,
                displayActualStart,
                displayActualEnd,
                user,
                breakRules,
                breakComputeOpts
              )
            : Math.max(0, grossActualMins);
        const deltaMins = actualMins - plannedMins;
        const breakMinutesActual =
          displayActualStart && displayActualEnd
            ? Math.max(
                0,
                calculateShiftMinutesGross(displayActualStart, displayActualEnd) - actualMins
              )
            : 0;

        const hasMissingOut = frozen ? false : !!(punchIn && !punchActualEnd);

        return {
          plannedStart,
          plannedEnd,
          plannedMins,
          breakMinutes,
          breakMinutesActual,
          actualStart: displayActualStart,
          actualEnd: displayActualEnd,
          actualMins,
          deltaMins,
          status: s.approval_status as GridShiftRow['status'],
          punched: !!punchIn,
          hasMissingOut,
        };
      });

      const totalPlannedMins = shiftRows.reduce((a, r) => a + r.plannedMins, 0);
      const totalActualMins = shiftRows.reduce((a, r) => a + r.actualMins, 0);
      const totalDeltaMins = totalActualMins - totalPlannedMins;

      data[user.id][dateStr] = {
        shifts: shiftRows,
        totalPlannedMins,
        totalActualMins,
        totalDeltaMins,
      };
    }
  }
  return data;
}

function gridToPdfDays(
  grid: Record<string, Record<string, GridDayData>>,
  visibleUsers: User[],
  weekDays: Date[]
): Record<string, Record<string, TimesheetPdfDayData>> {
  const pdfTimesheetData: Record<string, Record<string, TimesheetPdfDayData>> = {};
  for (const u of visibleUsers) {
    pdfTimesheetData[u.id] = {};
    for (const day of weekDays) {
      const ds = format(day, 'yyyy-MM-dd');
      const dd = grid[u.id]?.[ds];
      pdfTimesheetData[u.id][ds] = dd
        ? {
            shifts: dd.shifts.map((s) => ({
              plannedStart: s.plannedStart,
              plannedEnd: s.plannedEnd,
              plannedMins: s.plannedMins,
              breakMinutes: s.breakMinutes,
              breakMinutesActual: s.breakMinutesActual,
              actualStart: s.actualStart,
              actualEnd: s.actualEnd,
              actualMins: s.actualMins,
              deltaMins: s.deltaMins,
              status: s.status,
              punched: s.punched,
              hasMissingOut: s.hasMissingOut,
            })),
            totalPlannedMins: dd.totalPlannedMins,
            totalActualMins: dd.totalActualMins,
            totalDeltaMins: dd.totalDeltaMins,
          }
        : { shifts: [], totalPlannedMins: 0, totalActualMins: 0, totalDeltaMins: 0 };
    }
  }
  return pdfTimesheetData;
}

function computeUserTotalsFromGrid(
  visibleUsers: User[],
  weekDays: Date[],
  grid: Record<string, Record<string, GridDayData>>
): Record<string, { plannedMins: number; actualMins: number; deltaMins: number }> {
  const totals: Record<string, { plannedMins: number; actualMins: number; deltaMins: number }> = {};
  for (const user of visibleUsers) {
    let planned = 0;
    let actual = 0;
    for (const day of weekDays) {
      const dayData = grid[user.id]?.[format(day, 'yyyy-MM-dd')];
      if (dayData) {
        planned += dayData.totalPlannedMins;
        actual += dayData.totalActualMins;
      }
    }
    totals[user.id] = { plannedMins: planned, actualMins: actual, deltaMins: actual - planned };
  }
  return totals;
}

export type ExportAttendancePdfFromGridOptions = {
  weekDays: Date[];
  visibleUsers: User[];
  shifts: Shift[];
  punchRecords: PunchRecord[];
  breakRules: BreakRule[];
  breakComputeOpts: { autoBreaksFeatureEnabled?: boolean };
  locale: Locale;
  t: Record<string, string>;
  formatTrans: (template: string, vars: Record<string, string | number>) => string;
  fmtHM: (mins: number) => string;
  /**
   * true = solo turni confermati o approvati (stessi totali della scheda Ore).
   * false = tutti i turni nel range (export da Presenze).
   */
  onlyConfirmedOrApproved?: boolean;
};

/** @returns `'ok'` | `'no_days'` | `'no_users'` */
export function exportAttendancePdfFromGrid(
  options: ExportAttendancePdfFromGridOptions
): 'ok' | 'no_days' | 'no_users' {
  const {
    weekDays,
    visibleUsers,
    shifts,
    punchRecords,
    breakRules,
    breakComputeOpts,
    locale,
    t,
    formatTrans,
    fmtHM,
    onlyConfirmedOrApproved = false,
  } = options;

  if (weekDays.length === 0) return 'no_days';
  if (visibleUsers.length === 0) return 'no_users';

  const weekStart = weekDays[0];
  const lastDay = weekDays[weekDays.length - 1];
  const rangeStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndExclusive = format(addDays(lastDay, 1), 'yyyy-MM-dd');

  let weekShifts = shifts.filter(
    (s) => s.date >= rangeStartStr && s.date < weekEndExclusive && !s.notes?.startsWith('__OPEN__')
  );
  if (onlyConfirmedOrApproved) {
    weekShifts = weekShifts.filter(
      (s) => s.approval_status === 'confirmed' || s.approval_status === 'approved'
    );
  }

  const grid = computeTimesheetGridForPdf(
    weekDays,
    weekShifts,
    visibleUsers,
    punchRecords,
    breakRules,
    breakComputeOpts
  );
  const pdfTimesheetData = gridToPdfDays(grid, visibleUsers, weekDays);
  const userTotals = computeUserTotalsFromGrid(visibleUsers, weekDays, grid);

  const pdfUsers: TimesheetPdfUser[] = visibleUsers.map((u) => ({
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name ?? undefined,
    department: u.department ?? undefined,
    role: u.role,
  }));

  const weekShiftsMeta = weekShifts.map((s) => ({
    approval_status: s.approval_status,
    approved_by: s.approved_by ?? null,
    approved_at: s.approved_at ?? null,
  }));

  exportTimesheetPdfToFile({
    weekDays,
    weekStart,
    locale,
    t,
    formatTrans,
    visibleUsers: pdfUsers,
    timesheetData: pdfTimesheetData,
    userTotals,
    weekShifts: weekShiftsMeta,
    fmtHM,
  });

  return 'ok';
}
