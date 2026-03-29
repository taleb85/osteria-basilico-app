import { useRef, useState, useCallback, useMemo } from 'react';
import {
  Clock, Calendar, TrendingUp, Palmtree, Megaphone, X, Pencil, Check,
  Users, AlertCircle, UserCheck, Moon, Sun, LogOut as LogOutIcon,
  ArrowRight, ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useWallAlignedMinuteClock } from '../hooks/useWallAlignedMinuteClock';
import { format, isToday, isTomorrow, isValid, parseISO, addDays, startOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatMinutesToHoursAndMinutes } from '../utils/timeCalculations';
import { getNetShiftMinutes } from '../utils/breakRules';
import {
  isManagementRole,
  isPurelyManagementRole,
  isUserVisibleOnTeamSchedule,
  canOperateTeamSchedule,
  canEditTeamShifts,
  canApproveShiftActions,
} from '../utils/permissions';
import { motion, AnimatePresence } from 'framer-motion';
import { getTranslations, getDateLocale } from '../utils/translations';
import { isFeatureEnabled } from '../utils/enabledFeatures';
import { isUiWidgetVisible } from '../utils/uiScreenWidgets';
import type { Shift } from '../types';
import ApproveShiftModal from './ApproveShiftModal';
import { getResolvedStartEndForHours, shiftPastPlannedEndWithoutClockIn } from '../utils/shiftResolvedClockTimes';
import { safeFormatDate } from '../utils/safeDateFormat';
import { TimeInputField } from './ui/TimeInputField';
import MobileStaffDashboard from './mobile/MobileStaffDashboard';
import type { AppNavTab } from '../utils/enabledModules';

// ── Board helpers ────────────────────────────────────────────────────────────
const BOARD_KEY = 'manager_board_note';
function getBoardNote(): { text: string; author: string; updatedAt: string } | null {
  try { return JSON.parse(localStorage.getItem(BOARD_KEY) || 'null'); } catch { return null; }
}
function saveBoardNote(text: string, author: string) {
  localStorage.setItem(BOARD_KEY, JSON.stringify({ text, author, updatedAt: new Date().toISOString() }));
}
function clearBoardNote() { localStorage.removeItem(BOARD_KEY); }

// ── Time helpers ─────────────────────────────────────────────────────────────
function timeToMins(t: string): number {
  const [h, m] = (t || '00:00').slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function punchTimeHHMM(ts: string | null | undefined): string | null {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (!isValid(d)) return null;
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return null; }
}
function fmtHM(mins: number): string {
  if (!Number.isFinite(mins)) return '—';
  if (mins === 0) return '0h';
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  const sign = mins < 0 ? '−' : '+';
  return m > 0 ? `${sign}${h}h${m.toString().padStart(2, '0')}` : `${sign}${h}h`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface CloseShiftModal {
  shiftId: string;
  punchInId: string;
  dateStr: string;
  plannedEnd: string;
  employeeName: string;
  actualStart: string;
}

interface HomePageProps {
  onNavigateToHolidays?: () => void;
  onNavigateToShifts?: () => void;
  onNavigateToReports?: () => void;
  onTabChange?: (tab: AppNavTab) => void;
  /** Per evidenziare la scheda nella MobileBottomNav (solo home gestionale compatto). */
  activeTab?: AppNavTab;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HomePage({
  onNavigateToHolidays,
  onNavigateToShifts,
  onNavigateToReports,
  onTabChange,
  activeTab: activeTabProp,
}: HomePageProps) {
  const { currentUser, shifts, holidays, users, punchRecords, updatePunchRecord, approveShift, effectiveLanguage, showSuccess, showError, breakRules, featureFlags } = useApp();
  const t = getTranslations(effectiveLanguage);
  const shiftsListRef = useRef<HTMLDivElement>(null);
  const now = useWallAlignedMinuteClock();

  const [boardNote, setBoardNoteState] = useState(() => getBoardNote());
  const [editingBoard, setEditingBoard] = useState(false);
  const [boardDraft, setBoardDraft] = useState('');
  const [closeModal, setCloseModal] = useState<CloseShiftModal | null>(null);
  const [clockOutInput, setClockOutInput] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveModal, setApproveModal] = useState<{ shift: Shift; userName: string } | null>(null);

  const handleSaveBoard = () => {
    if (!boardDraft.trim()) { clearBoardNote(); setBoardNoteState(null); }
    else { saveBoardNote(boardDraft.trim(), currentUser?.first_name ?? 'Manager'); setBoardNoteState(getBoardNote()); }
    setEditingBoard(false);
  };

  const handleConfirmClose = useCallback(async () => {
    if (!closeModal || !clockOutInput) return;
    setClosingLoading(true);
    try {
      const [h, m] = clockOutInput.split(':').map(Number);
      const base = parseISO(closeModal.dateStr);
      const clockOutDate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h ?? 0, m ?? 0, 0, 0);
      await updatePunchRecord(closeModal.punchInId, { clock_out_time: clockOutDate.toISOString() });
      showSuccess?.(t.home_toast_exit_registered);
      setCloseModal(null);
      setClockOutInput('');
    } catch {
      showError?.(t.home_toast_exit_error);
    } finally {
      setClosingLoading(false);
    }
  }, [closeModal, clockOutInput, updatePunchRecord, showSuccess, showError, t]);

  const handleApproveFromModal = useCallback(
    async (shiftId: string, approvedStart: string, approvedEnd: string) => {
      const shift = shifts.find(s => s.id === shiftId);
      const user = users.find(u => u.id === shift?.user_id);
      if (currentUser.role === 'capo' && user?.department !== currentUser.department) {
        showError?.(t.ts_toast_approve_freeze_error);
        return;
      }
      setApprovingId(shiftId);
      try {
        await approveShift(shiftId, { approvedStart, approvedEnd });
        showSuccess?.(t.home_toast_shift_approved);
      } finally {
        setApprovingId(null);
      }
    },
    [approveShift, showSuccess, showError, shifts, users, currentUser, t]
  );

  const breakComputeOpts = useMemo(
    () => ({ autoBreaksFeatureEnabled: featureFlags['auto_breaks'] !== false }),
    [featureFlags]
  );

  if (!currentUser) return null;
  const locale = getDateLocale(effectiveLanguage) ?? it;

  const isMgmtUser = isManagementRole(currentUser.role);
  const isCapoUser = currentUser.role === 'capo';
  const isMobile = window.innerWidth < 768;
  const uiW = (key: string) => isUiWidgetVisible(currentUser, key);
  /** Tabellone team su Home: rispetta matrice `team_view` (non solo il ruolo). */
  const showTeamHome = (isMgmtUser || isCapoUser) && isFeatureEnabled(currentUser, 'team_view');
  const canEditShiftsHome =
    currentUser.role === 'admin' ||
    (isFeatureEnabled(currentUser, 'edit_shifts') &&
      canOperateTeamSchedule(currentUser) &&
      canEditTeamShifts(currentUser));
  /** Bacheca team: manager e assistente possono sempre pubblicare (non solo se hanno `edit_shifts` nel template). */
  const canEditTeamBoard =
    currentUser.role === 'admin' ||
    currentUser.role === 'manager' ||
    currentUser.role === 'assistant_manager' ||
    (isCapoUser && isFeatureEnabled(currentUser, 'edit_shifts')) ||
    canEditShiftsHome;
  const canApproveShiftsHome =
    currentUser.role === 'admin' ||
    (isFeatureEnabled(currentUser, 'approve_shifts') && canApproveShiftActions(currentUser));

  // Filtro per il Capo: vede solo anomalie e chiusure del suo reparto
  const filterByCapoDept = useCallback((enrichedShift: any) => {
    if (currentUser.role !== 'capo') return true;
    return enrichedShift.user?.department === currentUser.department;
  }, [currentUser]);

  /** Stesso gate su web, mobile e PWA (Master Control `staff_requests`). */
  const staffRequestsEnabled = featureFlags['staff_requests'] !== false;
  const todayStr = format(now, 'yyyy-MM-dd');
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const myShifts = shifts
    .filter((s) => s.user_id === currentUser.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcomingShifts = myShifts.filter((s) => {
    if (s.date < todayStr) return false;
    if ((isMgmtUser || isCapoUser) && showTeamHome) return true;
    return s.approval_status === 'approved' || s.approval_status === 'confirmed' || s.approval_status === 'absent';
  });

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const thisWeekShifts = myShifts.filter((s) => {
    const d = parseISO(s.date);
    return (
      d >= weekStart &&
      d < weekEnd &&
      (s.approval_status === 'approved' || s.approval_status === 'confirmed' || s.approval_status === 'absent')
    );
  });
  const weeklyMinutes = thisWeekShifts.reduce((sum, s) => {
    if (s.approval_status === 'absent') return sum;
    const u = users.find((x) => x.id === s.user_id) ?? currentUser;
    if (s.approved_at && s.approved_start_time && s.approved_end_time) {
      const { start, end } = getResolvedStartEndForHours(s, punchRecords);
      return sum + getNetShiftMinutes(s, start, end, u, breakRules, breakComputeOpts);
    }
    return (
      sum +
      getNetShiftMinutes(s, (s.start_time || '').slice(0, 5), (s.end_time || '').slice(0, 5), u, breakRules, breakComputeOpts)
    );
  }, 0);

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const thisMonthShifts = myShifts.filter((s) => {
    const d = parseISO(s.date);
    return (
      d >= monthStart &&
      d <= monthEnd &&
      (s.approval_status === 'approved' || s.approval_status === 'confirmed' || s.approval_status === 'absent')
    );
  });
  const monthlyMinutes = thisMonthShifts.reduce((sum, s) => {
    if (s.approval_status === 'absent') return sum;
    const u = users.find((x) => x.id === s.user_id) ?? currentUser;
    if (s.approved_at && s.approved_start_time && s.approved_end_time) {
      const { start, end } = getResolvedStartEndForHours(s, punchRecords);
      return sum + getNetShiftMinutes(s, start, end, u, breakRules, breakComputeOpts);
    }
    return (
      sum +
      getNetShiftMinutes(s, (s.start_time || '').slice(0, 5), (s.end_time || '').slice(0, 5), u, breakRules, breakComputeOpts)
    );
  }, 0);
  const monthDaysWorked = new Set(thisMonthShifts.filter((s) => s.approval_status !== 'absent').map((s) => s.date)).size;

  const pendingHolidays = holidays.filter((h) => h.status === 'pending');
  const myApprovedHolidays = holidays
    .filter((h) => h.user_id === currentUser.id && h.status === 'approved' && new Date(h.end_date) >= new Date())
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 3);

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    if (isToday(date)) return t.home_today;
    if (isTomorrow(date)) return t.home_tomorrow;
    return format(date, 'EEEE d MMMM', { locale });
  };

  const getPunchForShift = (shiftId: string, userId: string, dateStr: string, isLunchShift: boolean) => {
    const punchIn = punchRecords.find((p) => {
      if (p.type !== 'in') return false;
      if (shiftId && p.shift_id) return p.shift_id === shiftId;
      if (p.user_id !== userId) return false;
      const d = new Date(p.timestamp);
      if (!isValid(d)) return false;
      return format(d, 'yyyy-MM-dd') === dateStr && (isLunchShift ? d.getHours() < 16 : d.getHours() >= 16);
    });
    const punchOut = punchRecords.find((p) => {
      if (p.type !== 'out') return false;
      if (shiftId && p.shift_id) return p.shift_id === shiftId;
      if (p.user_id !== userId) return false;
      const d = new Date(p.timestamp);
      if (!isValid(d)) return false;
      return format(d, 'yyyy-MM-dd') === dateStr && (isLunchShift ? d.getHours() < 16 : d.getHours() >= 16);
    });
    return { punchIn, punchOut };
  };

  // ── Manager: today's shifts with punch data (esclude Admin/Proprietario) ───
  const todayAllShifts = showTeamHome
    ? shifts
        .filter((s) => {
          if (s.date !== todayStr || s.notes?.startsWith('__OPEN__')) return false;
          const u = users.find((x) => x.id === s.user_id);
          if (!u) return true;
          if (currentUser.role === 'capo' && u.department !== currentUser.department) return false;
          return isUserVisibleOnTeamSchedule(u, shifts);
        })
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    : [];

  const todayShiftsEnriched = todayAllShifts.map((s) => {
    const isDinner = timeToMins((s.start_time || '').slice(0, 5)) >= 16 * 60;
    const user = users.find((u) => u.id === s.user_id);
    const { punchIn, punchOut } = getPunchForShift(s.id, s.user_id, todayStr, !isDinner);
    const clockOutRaw = (punchIn as { clock_out_time?: string | null })?.clock_out_time ?? null;
    const actualStart = punchIn ? punchTimeHHMM(punchIn.calculated_time || punchIn.timestamp) : null;
    const actualEnd = clockOutRaw ? punchTimeHHMM(clockOutRaw) : punchOut ? punchTimeHHMM(punchOut.timestamp) : null;
    const scheduledStart = (s.start_time || '').slice(0, 5);
    const scheduledEnd = (s.end_time || '').slice(0, 5);
    const scheduledMins = getNetShiftMinutes(s, scheduledStart, scheduledEnd, user ?? undefined, breakRules, breakComputeOpts);
    let actualMins = 0;
    if (s.approved_at && s.approved_start_time && s.approved_end_time) {
      const { start, end } = getResolvedStartEndForHours(s, punchRecords);
      actualMins = getNetShiftMinutes(s, start, end, user ?? undefined, breakRules, breakComputeOpts);
    } else if (actualStart && actualEnd) {
      actualMins = getNetShiftMinutes(s, actualStart, actualEnd, user ?? undefined, breakRules, breakComputeOpts);
    } else if (actualStart && scheduledEnd) {
      actualMins = getNetShiftMinutes(s, actualStart, scheduledEnd, user ?? undefined, breakRules, breakComputeOpts);
    }
    const deltaMins = actualMins - scheduledMins;
    const isLate = !!(actualStart && timeToMins(actualStart) > timeToMins(scheduledStart) + 5);
    const hasMissingOut = !!(punchIn && !actualEnd);
    const isApproved = s.approval_status === 'approved' && !!s.approved_at;
    const canApprove =
      showTeamHome &&
      canApproveShiftsHome &&
      s.approval_status === 'confirmed' &&
      !!punchIn &&
      !!actualEnd &&
      (currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'assistant_manager' || (currentUser.role === 'capo' && user?.department === currentUser.department));
    const canClose =
      showTeamHome && (canEditShiftsHome || (isCapoUser && user?.department === currentUser.department)) && isDinner && !!punchIn && !actualEnd && !isApproved;
    return { shift: s, user, isDinner, punchIn, punchOut, actualStart, actualEnd, scheduledStart, scheduledEnd, scheduledMins, actualMins, deltaMins, isLate, hasMissingOut, isApproved, canApprove, canClose };
  });

  // Stats oggi — stessa logica delle card riepilogo Presenze (Timesheets)
  const inTurnoCount = todayAllShifts.filter((s) => {
    if (s.approval_status === 'absent') return false;
    const u = users.find((x) => x.id === s.user_id);
    if (currentUser.role === 'capo' && u?.department !== currentUser.department) return false;
    const start = timeToMins((s.start_time || '').slice(0, 5));
    const end = timeToMins((s.end_time || '23:59').slice(0, 5));
    return nowMins >= start - 30 && nowMins <= end;
  }).length;
  const ritardiCount = todayShiftsEnriched.filter((e) => e.isLate).filter(filterByCapoDept).length;
  const senzaTimbraturaCount = todayAllShifts.filter((s) => {
    if (s.approval_status === 'absent') return false;
    const u = users.find((x) => x.id === s.user_id);
    if (currentUser.role === 'capo' && u?.department !== currentUser.department) return false;
    const isDinner = timeToMins((s.start_time || '').slice(0, 5)) >= 16 * 60;
    const { punchIn } = getPunchForShift(s.id, s.user_id, todayStr, !isDinner);
    return !punchIn;
  }).length;
  const approvatiCount = todayAllShifts.filter((s) => {
    if (s.approval_status !== 'approved') return false;
    const u = users.find((x) => x.id === s.user_id);
    if (currentUser.role === 'capo' && u?.department !== currentUser.department) return false;
    return true;
  }).length;

  // Sections: critical = rosso/giallo
  const criticalShifts = todayShiftsEnriched.filter((e) => e.hasMissingOut || e.isLate || e.canApprove).filter(filterByCapoDept);
  const dinnerNeedsClose = todayShiftsEnriched.filter((e) => e.canClose).filter(filterByCapoDept);

  // Attendance
  const todayShiftsWithPunch = todayAllShifts.filter((s) => {
    const isDinner = timeToMins((s.start_time || '').slice(0, 5)) >= 16 * 60;
    const { punchIn } = getPunchForShift(s.id, s.user_id, todayStr, !isDinner);
    return !!punchIn;
  });
  const attendancePercent = todayAllShifts.length > 0 ? Math.round((todayShiftsWithPunch.length / todayAllShifts.length) * 100) : 100;
  const hoursPercent = Math.min(100, Math.round((weeklyMinutes / (40 * 60)) * 100));

  // ── Shift card color helper (palette WeeklyShiftsTable VARIANT_CLASSES) ───
  const getCardStyle = (e: typeof todayShiftsEnriched[0]) => {
    const startMins = timeToMins(e.scheduledStart);
    const endMins = timeToMins((e.scheduledEnd || '00:00').slice(0, 5));
    const inTodayKpiWindow = nowMins >= startMins - 30 && nowMins <= endMins;
    const punchMissingHome = shiftPastPlannedEndWithoutClockIn(e.shift, punchRecords);
    const publishedHome =
      e.shift.approval_status === 'confirmed' ||
      (e.shift.approval_status === 'approved' && !e.shift.approved_at);

    if (e.shift.approval_status === 'absent') {
      return {
        border: 'border-l-rose-400 dark:border-l-rose-500',
        bg: 'bg-rose-50 dark:bg-rose-950/35',
        badge: 'bg-rose-100 text-rose-900 border-rose-400/85 dark:bg-rose-950/45 dark:text-rose-100 dark:border-rose-500/65',
        dot: 'bg-rose-500',
        label: t.status_absent,
      };
    }
    if (e.isApproved) {
      return {
        border: 'border-l-accent',
        bg: 'bg-accent/5 dark:bg-accent/15',
        badge: 'bg-accent/10 text-accent-dark border-accent/20 dark:bg-accent/20 dark:text-accent dark:border-accent/35',
        dot: 'bg-accent',
        label: t.home_status_approved,
      };
    }
    if (e.shift.approval_status === 'draft') {
      return {
        border: 'border-l-slate-400 dark:border-l-white/75',
        bg: 'bg-slate-50 dark:bg-neutral-950/85',
        badge: 'bg-slate-100 text-slate-800 border-slate-400 dark:bg-neutral-800/70 dark:text-neutral-100 dark:border-white/40',
        dot: 'bg-slate-400 dark:bg-neutral-500',
        label: t.status_draft,
      };
    }
    if (e.hasMissingOut || e.isLate) {
      return {
        border: 'border-l-red-500 dark:border-l-red-400',
        bg: 'bg-red-50 dark:bg-red-950/35',
        badge: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-100 dark:border-red-800/60',
        dot: 'bg-red-500 dark:bg-red-400',
        label: t.home_status_anomaly,
      };
    }
    if (e.canApprove) {
      return {
        border: 'border-l-emerald-500 dark:border-l-emerald-500/80',
        bg: 'bg-emerald-50/95 dark:bg-emerald-950/40',
        badge: 'bg-emerald-100 text-emerald-900 border-emerald-500/80 dark:bg-emerald-950/50 dark:text-emerald-50 dark:border-emerald-500/50',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        label: t.home_status_to_approve,
      };
    }
    if (!e.punchIn) {
      if (punchMissingHome) {
        return {
          border: 'border-l-amber-400 dark:border-l-amber-500',
          bg: 'bg-amber-50 dark:bg-amber-950/45',
          badge: 'bg-amber-100 text-amber-950 border-amber-400/70 dark:bg-amber-950/55 dark:text-amber-100 dark:border-amber-500/50',
          dot: 'bg-amber-400 dark:bg-amber-500',
          label: t.home_status_not_punched,
        };
      }
      if (publishedHome) {
        return {
          border: 'border-l-emerald-500 dark:border-l-emerald-500/80',
          bg: 'bg-emerald-50/95 dark:bg-emerald-950/40',
          badge: 'bg-emerald-100 text-emerald-900 border-emerald-500/80 dark:bg-emerald-950/50 dark:text-emerald-50 dark:border-emerald-500/50',
          dot: 'bg-emerald-500 dark:bg-emerald-400',
          label: t.home_status_not_punched,
        };
      }
      return {
        border: 'border-l-amber-400 dark:border-l-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-950/45',
        badge: 'bg-amber-100 text-amber-950 border-amber-400/70 dark:bg-amber-950/55 dark:text-amber-100 dark:border-amber-500/50',
        dot: 'bg-amber-400 dark:bg-amber-500',
        label: t.home_status_not_punched,
      };
    }
    if (inTodayKpiWindow && e.punchIn && !e.isLate && !e.hasMissingOut) {
      return {
        border: 'border-l-emerald-500 dark:border-l-emerald-500/80',
        bg: 'bg-emerald-50/95 dark:bg-emerald-950/40',
        badge: 'bg-emerald-100 text-emerald-900 border-emerald-500/80 dark:bg-emerald-950/50 dark:text-emerald-50 dark:border-emerald-500/50',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        label: t.home_status_in_shift,
      };
    }
    if (e.punchIn && !e.actualEnd) {
      return {
        border: 'border-l-emerald-500 dark:border-l-emerald-500/80',
        bg: 'bg-emerald-50/95 dark:bg-emerald-950/40',
        badge: 'bg-emerald-100 text-emerald-900 border-emerald-500/80 dark:bg-emerald-950/50 dark:text-emerald-50 dark:border-emerald-500/50',
        dot: 'animate-pulse bg-emerald-500 dark:bg-emerald-400',
        label: t.home_status_in_shift,
      };
    }
    if (e.punchIn && e.actualEnd) {
      return {
        border: 'border-l-emerald-500 dark:border-l-emerald-500/80',
        bg: 'bg-emerald-50/95 dark:bg-emerald-950/40',
        badge: 'bg-emerald-100 text-emerald-900 border-emerald-500/80 dark:bg-emerald-950/50 dark:text-emerald-50 dark:border-emerald-500/50',
        dot: 'bg-emerald-500 dark:bg-emerald-400',
        label: t.home_status_complete,
      };
    }
    return {
      border: 'border-l-amber-400 dark:border-l-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/45',
      badge: 'bg-amber-100 text-amber-950 border-amber-400/70 dark:bg-amber-950/55 dark:text-amber-100 dark:border-amber-500/50',
      dot: 'bg-amber-400 dark:bg-amber-500',
      label: t.home_status_not_punched,
    };
  };

  // ── STAFF VIEW (o gestionale senza team_view sulla Home) ────────────────────
  if (!showTeamHome) {
    const todayShiftsMine = shifts.filter((s) => s.date === todayStr && s.user_id === currentUser.id);
    return (
      <div className="pb-content pt-6 w-full app-horizontal-pad font-sans">
        <div className="block md:hidden space-y-4">
          <MobileStaffDashboard
            user={currentUser}
            language={effectiveLanguage}
            todayStr={todayStr}
            now={now}
            myShifts={myShifts}
            punchRecords={punchRecords}
            weeklyMinutes={weeklyMinutes}
            monthlyMinutes={monthlyMinutes}
            monthDaysWorked={monthDaysWorked}
            weekCapMinutes={40 * 60}
            onTabChange={onTabChange}
            greetingText={t.home_greeting.replace('{name}', currentUser.first_name ?? '')}
            showMobileBottomNav={!isMgmtUser}
            activeTab={activeTabProp ?? 'home'}
          />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto hidden max-w-lg flex-col gap-4 md:flex md:flex-col"
        >
          {/* Saluto */}
          {uiW('home_compact.greeting') && (
          <div>
            <h1 className="text-slate-900 dark:text-neutral-100 font-bold text-2xl">{t.home_greeting.replace('{name}', currentUser.first_name)}</h1>
          </div>
          )}

          {/* Bacheca team (gestionale senza team_view sulla Home) */}
          {uiW('home_compact.board') && isMgmtUser && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border px-4 py-3 ${boardNote ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/50' : 'border-dashed border-slate-200 dark:border-white/15 bg-slate-50/80 dark:bg-neutral-900/60'}`}
            >
              <div className="flex items-start gap-3">
                <Megaphone size={15} className={`mt-0.5 shrink-0 ${boardNote ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-neutral-400'}`} />
                <div className="flex-1 min-w-0">
                  {editingBoard ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        autoFocus
                        value={boardDraft}
                        onChange={(e) => setBoardDraft(e.target.value)}
                        placeholder={t.home_board_placeholder}
                        rows={2}
                        className="w-full text-sm text-slate-800 dark:text-neutral-100 bg-white dark:bg-neutral-950 border border-amber-300 dark:border-amber-700/50 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 dark:focus:ring-amber-600"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSaveBoard}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600"
                        >
                          <Check size={12} /> {t.save}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingBoard(false)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-neutral-700"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  ) : boardNote ? (
                    <p className="text-sm text-amber-900 dark:text-amber-100 font-medium whitespace-pre-wrap leading-relaxed">{boardNote.text}</p>
                  ) : canEditTeamBoard ? (
                    <button
                      type="button"
                      onClick={() => {
                        setBoardDraft('');
                        setEditingBoard(true);
                      }}
                      className="text-left w-full text-xs text-slate-500 dark:text-neutral-400 italic hover:text-slate-600 dark:hover:text-neutral-400 transition-colors"
                    >
                      {t.home_board_empty}
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-neutral-400 italic">{t.home_board_empty}</p>
                  )}
                  {boardNote && !editingBoard && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400/90 mt-1">
                      Da {boardNote.author} · {safeFormatDate(boardNote.updatedAt, 'd MMM HH:mm', { locale: it })}
                    </p>
                  )}
                </div>
                {canEditTeamBoard && !editingBoard && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setBoardDraft(boardNote?.text ?? '');
                        setEditingBoard(true);
                      }}
                      className="p-1.5 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                    >
                      <Pencil size={13} />
                    </button>
                    {boardNote && (
                      <button
                        type="button"
                        onClick={() => {
                          clearBoardNote();
                          setBoardNoteState(null);
                        }}
                        className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-400"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Turni di oggi – staff view */}
          {uiW('home_compact.today_shifts') && todayShiftsMine.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">{t.home_today}</h2>
              {todayShiftsMine.map((s) => {
                const isDinner = timeToMins((s.start_time || '').slice(0, 5)) >= 16 * 60;
                const { punchIn } = getPunchForShift(s.id, s.user_id, todayStr, !isDinner);
                const punched = !!punchIn;
                return (
                  <div key={s.id} className={`rounded-2xl border-l-4 p-4 shadow-sm ${punched ? 'border-l-accent bg-accent/5 dark:bg-accent/15' : 'border-l-amber-400 dark:border-l-amber-500 bg-amber-50 dark:bg-amber-950/45'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isDinner ? <Moon className="w-4 h-4 text-amber-600 dark:text-amber-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{isDinner ? t.dinner : t.lunch}</span>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${punched ? 'bg-accent/10 text-accent-dark border-accent/20 dark:bg-accent/20 dark:text-accent dark:border-accent/35' : 'bg-amber-100 text-amber-950 border-amber-400/70 dark:bg-amber-950/55 dark:text-amber-100 dark:border-amber-500/50'}`}>
                        {punched ? t.home_punched : t.home_not_punched}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-neutral-100 tabular-nums">
                      {s.start_time.slice(0, 5)} → {s.end_time?.slice(0, 5) ?? '…'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Prossimo turno */}
          {uiW('home_compact.next_shift') && upcomingShifts.filter((s) => s.date !== todayStr)[0] && (() => {
            const next = upcomingShifts.filter((s) => s.date !== todayStr)[0];
            return (
              <div className="surface-glass p-5">
                <p className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-2">{t.home_next_shift}</p>
                <p className="text-lg font-bold text-slate-800 dark:text-neutral-100 mb-1">{getDateLabel(next.date)}</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" />
                  <span className="text-xl font-bold text-slate-900 dark:text-neutral-100 tabular-nums">{next.start_time.slice(0, 5)} → {next.end_time?.slice(0, 5) ?? '…'}</span>
                </div>
              </div>
            );
          })()}

          {/* Lista turni */}
          {uiW('home_compact.shift_list') && (
          <div ref={shiftsListRef} className="surface-glass p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">{t.home_my_shifts}</h3>
              <button type="button" onClick={() => onNavigateToShifts?.()} className="text-xs font-semibold text-accent flex items-center gap-1 hover:underline">
                {t.home_see_all} <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-0">
              {upcomingShifts.slice(0, 10).length === 0 ? (
                <p className="text-slate-500 dark:text-neutral-400 text-sm text-center py-4">{t.no_shifts_scheduled}</p>
              ) : (() => {
                const grouped: Record<string, typeof upcomingShifts> = {};
                upcomingShifts.slice(0, 10).forEach((s) => { if (!grouped[s.date]) grouped[s.date] = []; grouped[s.date].push(s); });
                return Object.keys(grouped).sort().slice(0, 7).map((dateStr, idx) => (
                  <motion.div key={dateStr} initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 + idx * 0.04 }}
                    className="flex items-center py-2.5 border-b border-slate-50 dark:border-white/5 last:border-0 gap-3">
                    <p className="text-slate-500 dark:text-neutral-400 font-semibold text-xs uppercase tracking-wide w-[72px] flex-shrink-0">
                      {safeFormatDate(dateStr, 'EEE d', { locale })}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {grouped[dateStr].sort((a, b) => a.start_time.localeCompare(b.start_time)).map((s) => (
                        <span key={s.id} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.approval_status === 'draft' ? 'bg-slate-100 text-slate-600 border-slate-400 dark:bg-neutral-800 dark:text-neutral-300 dark:border-white/25' : 'bg-emerald-50/95 text-emerald-900 border-emerald-500/80 dark:bg-emerald-950/40 dark:text-emerald-50 dark:border-emerald-500/50'}`}>
                          {s.start_time.slice(0, 5)}–{s.end_time?.slice(0, 5) ?? '…'}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ));
              })()}
            </div>
          </div>
          )}

          {/* Ferie approvate */}
          {uiW('home_compact.approved_holidays') && staffRequestsEnabled && myApprovedHolidays.length > 0 && (
            <div className="surface-glass p-5">
              <h3 className="text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Palmtree className="w-4 h-4 text-accent dark:text-accent-light" /> {t.home_upcoming_holidays}
              </h3>
              {myApprovedHolidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 dark:border-white/5 last:border-0">
                  <span className="text-slate-600 dark:text-neutral-300 text-xs font-medium">
                    {safeFormatDate(h.start_date, 'd MMM', { locale })} – {safeFormatDate(h.end_date, 'd MMM yyyy', { locale })}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent-dark text-xs font-bold border border-accent/20 dark:bg-accent/15 dark:text-accent dark:border-accent/30">{t.home_holiday_approved}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ── MANAGER VIEW (team home) ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="pb-content pt-6 w-full app-horizontal-pad font-sans">
        <MobileStaffDashboard
          user={currentUser}
          language={effectiveLanguage}
          todayStr={todayStr}
          now={now}
          myShifts={myShifts}
          punchRecords={punchRecords}
          weeklyMinutes={weeklyMinutes}
          monthlyMinutes={monthlyMinutes}
          monthDaysWorked={monthDaysWorked}
          weekCapMinutes={40 * 60}
          onTabChange={onTabChange}
          greetingText={t.home_greeting.replace('{name}', currentUser.first_name ?? '')}
          activeTab={activeTabProp ?? 'home'}
        />
      </div>
    );
  }

  return (
    <>
      <div className="pb-content pt-6 w-full app-horizontal-pad font-sans">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="flex flex-col gap-5">

          {/* ── Profilo amministratore (solo Admin) ───────────────────── */}
          {uiW('home_mgmt.admin_banner') && isPurelyManagementRole(currentUser.role) && (
            <div className="surface-glass flex items-center gap-3 bg-slate-50/40 px-4 py-3 dark:bg-neutral-900/30">
              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-slate-500 dark:text-neutral-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-neutral-100">
                  {(t as Record<string, string>).home_admin_profile_banner_title}
                </p>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  {(t as Record<string, string>).home_admin_profile_banner_body}
                </p>
              </div>
            </div>
          )}

          {/* ── Bacheca Manager ───────────────────────────────────────────── */}
          {uiW('home_mgmt.team_board') && (
          <AnimatePresence>
            <motion.div key="board" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              className={`rounded-2xl border px-4 py-3 ${boardNote ? 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/40' : 'surface-glass border-dashed border-slate-200/90 dark:border-white/15'}`}>
              <div className="flex items-start gap-3">
                <Megaphone size={15} className={`mt-0.5 shrink-0 ${boardNote ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-neutral-400'}`} />
                <div className="flex-1 min-w-0">
                  {editingBoard ? (
                    <div className="flex flex-col gap-2">
                      <textarea autoFocus value={boardDraft} onChange={(e) => setBoardDraft(e.target.value)}
                        placeholder={t.home_board_placeholder} rows={2}
                        className="w-full text-sm text-slate-800 dark:text-neutral-100 bg-white dark:bg-neutral-950 border border-amber-300 dark:border-amber-700/50 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 dark:focus:ring-amber-600" />
                      <div className="flex gap-2">
                        <button type="button" onClick={handleSaveBoard} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600">
                          <Check size={12} /> {t.save}
                        </button>
                        <button type="button" onClick={() => setEditingBoard(false)} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-neutral-700">
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  ) : boardNote ? (
                    <p className="text-sm text-amber-900 dark:text-amber-100 font-medium whitespace-pre-wrap leading-relaxed">{boardNote.text}</p>
                  ) : canEditTeamBoard ? (
                    <button
                      type="button"
                      onClick={() => {
                        setBoardDraft('');
                        setEditingBoard(true);
                      }}
                      className="text-left w-full text-xs text-slate-500 dark:text-neutral-400 italic hover:text-slate-600 dark:hover:text-neutral-400 transition-colors"
                    >
                      {t.home_board_empty}
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-neutral-400 italic">{t.home_board_empty}</p>
                  )}
                  {boardNote && !editingBoard && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400/90 mt-1">Da {boardNote.author} · {safeFormatDate(boardNote.updatedAt, 'd MMM HH:mm', { locale: it })}</p>
                  )}
                </div>
                {canEditTeamBoard && !editingBoard && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => { setBoardDraft(boardNote?.text ?? ''); setEditingBoard(true); }} className="p-1.5 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400"><Pencil size={13} /></button>
                    {boardNote && <button type="button" onClick={() => { clearBoardNote(); setBoardNoteState(null); }} className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-400 dark:text-red-400"><X size={13} /></button>}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
          )}

          {/* ── Stats Bar ─────────────────────────────────────────────────── */}
          {uiW('home_mgmt.stats_bar') && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: t.home_stat_in_shift,
                value: inTurnoCount,
                Icon: Users,
                iconColor: 'text-emerald-600 dark:text-emerald-400',
                bg: 'bg-transparent dark:bg-transparent',
                border: 'border-emerald-200 dark:border-emerald-800/40',
                iconWell: 'bg-emerald-100/80 dark:bg-emerald-950/50',
              },
              {
                label: t.home_stat_delays,
                value: ritardiCount,
                Icon: Clock,
                iconColor: 'text-red-500 dark:text-red-400',
                bg: 'bg-transparent dark:bg-transparent',
                border: 'border-red-200 dark:border-red-900/40',
                iconWell: 'bg-red-100/80 dark:bg-red-950/40',
              },
              {
                label: t.home_stat_missing_out,
                value: senzaTimbraturaCount,
                Icon: AlertCircle,
                iconColor: 'text-amber-500 dark:text-amber-400',
                bg: 'bg-transparent dark:bg-transparent',
                border: 'border-amber-400/45 dark:border-amber-500/35',
                iconWell: 'bg-amber-400/15 dark:bg-amber-500/20',
              },
              {
                label: t.home_stat_approved,
                value: approvatiCount,
                Icon: UserCheck,
                iconColor: 'text-accent dark:text-accent-light',
                bg: 'bg-transparent dark:bg-transparent',
                border: 'border-accent/20 dark:border-accent/30',
                iconWell: 'bg-accent/15 dark:bg-accent/25',
              },
            ].map(({ label, value, Icon, iconColor, bg, border, iconWell }) => (
              <div key={label} className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${border} ${bg}`}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${border} ${iconWell}`}>
                  <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} strokeWidth={2} aria-hidden />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-neutral-100 leading-none">{value}</p>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 leading-tight">{label}</p>
                </div>
              </div>
            ))}
          </div>
          )}

          {/* ── Pannello Dinner: Chiudi Turno ────────────────────────────── */}
          {uiW('home_mgmt.dinner_close') && dinnerNeedsClose.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <div className="flex items-center gap-2 mb-3">
                <Moon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-neutral-100">{t.home_dinner_close_required}</h2>
                <span className="ml-auto rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-200">
                  {dinnerNeedsClose.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {dinnerNeedsClose.map((e) => (
                  <div
                    key={e.shift.id}
                    className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-800/40 dark:bg-amber-950/35"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                        {e.user?.first_name?.[0] ?? '?'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-neutral-100 text-sm">{e.user?.first_name ?? '—'}</p>
                        <p className="text-[11px] text-slate-500 dark:text-neutral-400">{e.user?.department ?? e.user?.role ?? ''}</p>
                      </div>
                      <span className="ml-auto flex items-center gap-1 rounded-full border border-emerald-500/80 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-950/50 dark:text-emerald-50">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 dark:bg-emerald-400" /> {t.home_badge_in_shift}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-white/70 dark:bg-neutral-950/50 rounded-xl px-2.5 py-2 text-center">
                        <p className="text-[9px] text-slate-500 dark:text-neutral-400 uppercase font-semibold mb-0.5">{t.home_label_planned}</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-neutral-200 tabular-nums">{e.scheduledStart}–{e.scheduledEnd}</p>
                      </div>
                      <div className="bg-white/70 dark:bg-neutral-950/50 rounded-xl px-2.5 py-2 text-center">
                        <p className="text-[9px] text-slate-500 dark:text-neutral-400 uppercase font-semibold mb-0.5">{t.home_label_entry}</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-neutral-100 tabular-nums">{e.actualStart ?? '—'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!e.punchIn) return;
                        setClockOutInput(e.scheduledEnd);
                        setCloseModal({ shiftId: e.shift.id, punchInId: e.punchIn.id, dateStr: todayStr, plannedEnd: e.scheduledEnd, employeeName: e.user?.first_name ?? '—', actualStart: e.actualStart ?? e.scheduledStart });
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-bold transition-colors shadow-sm"
                    >
                      <LogOutIcon className="w-4 h-4" /> {t.home_btn_close_shift}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Richiede Attenzione (rosso/giallo) ───────────────────────── */}
          {uiW('home_mgmt.critical') && criticalShifts.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-neutral-100">{t.home_requires_attention}</h2>
                <span className="ml-auto text-[11px] font-bold text-red-600 dark:text-red-300 bg-red-100 dark:bg-red-950/45 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800/50">{criticalShifts.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {criticalShifts.map((e) => {
                  const style = getCardStyle(e);
                  return (
                    <HomeManagementShiftCard key={e.shift.id} e={e} style={style} isManager={showTeamHome}
                      onClose={() => {
                        if (!e.punchIn) return;
                        setClockOutInput(e.scheduledEnd);
                        setCloseModal({ shiftId: e.shift.id, punchInId: e.punchIn.id, dateStr: todayStr, plannedEnd: e.scheduledEnd, employeeName: e.user?.first_name ?? '—', actualStart: e.actualStart ?? e.scheduledStart });
                      }}
                      onApprove={() => setApproveModal({ shift: e.shift, userName: e.user?.first_name ?? '—' })}
                      approvingId={approvingId}
                      t={t}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Tutti i turni di oggi ─────────────────────────────────────── */}
          {uiW('home_mgmt.today_shifts') && todayShiftsEnriched.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-slate-500 dark:text-neutral-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-neutral-100">{t.home_todays_shifts}</h2>
                <span className="text-[11px] text-slate-500 dark:text-neutral-400 ml-1">({todayShiftsEnriched.length})</span>
                <button type="button" onClick={() => onNavigateToShifts?.()} className="ml-auto text-xs font-semibold text-accent flex items-center gap-0.5 hover:underline">
                  {t.home_see_all_shifts} <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {todayShiftsEnriched.map((e) => {
                  const style = getCardStyle(e);
                  return (
                    <HomeManagementShiftCard key={e.shift.id} e={e} style={style} isManager={showTeamHome}
                      onClose={() => {
                        if (!e.punchIn) return;
                        setClockOutInput(e.scheduledEnd);
                        setCloseModal({ shiftId: e.shift.id, punchInId: e.punchIn.id, dateStr: todayStr, plannedEnd: e.scheduledEnd, employeeName: e.user?.first_name ?? '—', actualStart: e.actualStart ?? e.scheduledStart });
                      }}
                      onApprove={() => setApproveModal({ shift: e.shift, userName: e.user?.first_name ?? '—' })}
                      approvingId={approvingId}
                      t={t}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Bottom grid: Reports + Holidays + KPI ─────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Reports */}
            {uiW('home_mgmt.card_presenze') && (
            <div className="surface-glass surface-ghost-interactive cursor-pointer p-5" onClick={() => onNavigateToReports?.()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 dark:text-neutral-50">{t.home_section_attendance}</h3>
                <TrendingUp className="w-4 h-4 text-slate-400 dark:text-neutral-400" />
              </div>
              <div className="space-y-3">
                {[
                  { label: t.home_attendance_today, pct: attendancePercent, color: 'bg-accent' },
                  { label: t.home_hours_this_week, pct: hoursPercent, color: 'bg-teal-600 dark:bg-teal-500' },
                ].map(({ label, pct, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-600 dark:text-neutral-300 font-medium">{label}</span>
                      <span className="text-slate-800 dark:text-neutral-50 font-bold tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-neutral-700 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.3, duration: 0.7, ease: 'easeOut' }}
                        className={`h-full rounded-full ${color}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* Holidays — nascosto se funzione disattivata globalmente */}
            {uiW('home_mgmt.card_ferie') && staffRequestsEnabled && (
            <div className="surface-glass surface-ghost-interactive cursor-pointer p-5" onClick={() => onNavigateToHolidays?.()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800 dark:text-neutral-100">{t.home_holidays_section}</h3>
                <Palmtree className="w-4 h-4 text-accent dark:text-accent-light" />
              </div>
              {pendingHolidays.length > 0 && (
                <div className="flex items-center gap-2 mb-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{pendingHolidays.length} {t.home_holiday_pending}</p>
                </div>
              )}
              <div className="space-y-1.5">
                {holidays.slice(0, 3).map((h) => {
                  const u = users.find((x) => x.id === h.user_id);
                  return (
                    <div key={h.id} className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-white/5 last:border-0">
                      <span className="text-slate-600 dark:text-neutral-300 text-xs font-medium truncate flex-1">{u?.first_name ?? '?'}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-2 ${h.status === 'approved' ? 'bg-accent/10 text-accent-dark border-accent/20 dark:bg-accent/15 dark:text-accent dark:border-accent/30' : h.status === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50' : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/45 dark:text-red-300 dark:border-red-800/50'}`}>
                        {h.status === 'approved' ? t.home_holiday_approved : h.status === 'pending' ? t.home_holiday_pending : t.home_holiday_rejected}
                      </span>
                    </div>
                  );
                })}
                {holidays.length === 0 && <p className="text-slate-500 dark:text-neutral-300 text-xs text-center py-2 font-medium">{t.home_no_requests}</p>}
              </div>
            </div>
            )}

            {/* KPI */}
            {uiW('home_mgmt.card_kpi') && (
            <div className="flex flex-col gap-3">
              <div className="surface-glass surface-ghost-interactive cursor-pointer p-4" onClick={() => onNavigateToShifts?.()}>
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-4 h-4 text-slate-400 dark:text-neutral-400" />
                  <span className="text-[10px] text-slate-500 dark:text-neutral-300 font-semibold uppercase">{t.home_kpi_hours_week}</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-neutral-50 tabular-nums">{formatMinutesToHoursAndMinutes(weeklyMinutes)}</p>
              </div>
              <div className="surface-glass surface-ghost-interactive cursor-pointer p-4" onClick={() => onNavigateToShifts?.()}>
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-4 h-4 text-slate-400 dark:text-neutral-400" />
                  <span className="text-[10px] text-slate-500 dark:text-neutral-300 font-semibold uppercase">{t.home_kpi_shifts_week}</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-neutral-50 tabular-nums">{todayAllShifts.length}</p>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">{t.home_today}</p>
              </div>
            </div>
            )}
          </div>

        </motion.div>
      </div>

      {/* ── Modal Chiudi Turno ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {closeModal && (() => {
          const [h, m] = clockOutInput ? clockOutInput.split(':').map(Number) : [0, 0];
          const previewMins = clockOutInput ? Math.max(0, timeToMins(`${String(h ?? 0).padStart(2,'0')}:${String(m ?? 0).padStart(2,'0')}`) - timeToMins(closeModal.actualStart)) : 0;
          const homeClockComplete = /^\d{2}:\d{2}$/.test((clockOutInput || '').trim());
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
              onClick={(e) => { if (e.target === e.currentTarget) { setCloseModal(null); setClockOutInput(''); } }}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.15 }} className="modal-glass-panel w-full max-w-sm rounded-2xl p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-neutral-100 text-lg flex items-center gap-2">
                      <Moon className="h-5 w-5 text-amber-600 dark:text-amber-400" /> {t.home_modal_close_dinner}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-neutral-400 mt-0.5">{closeModal.employeeName} · {safeFormatDate(closeModal.dateStr, 'd MMM', { locale })}</p>
                  </div>
                  <button type="button" onClick={() => { setCloseModal(null); setClockOutInput(''); }} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors">
                    <X className="w-4 h-4 text-slate-500 dark:text-neutral-400" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-slate-50 dark:bg-neutral-800/80 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-slate-500 dark:text-neutral-400 uppercase font-semibold mb-1">{t.home_label_planned}</p>
                    <p className="font-bold text-slate-700 dark:text-neutral-200 tabular-nums">{closeModal.actualStart} → {closeModal.plannedEnd}</p>
                  </div>
                  <div className="rounded-xl bg-teal-50 p-3 text-center dark:bg-teal-950/40">
                    <p className="text-[10px] text-slate-500 dark:text-neutral-400 uppercase font-semibold mb-1">{t.home_label_entry}</p>
                    <p className="font-bold text-slate-800 dark:text-neutral-100 tabular-nums">{closeModal.actualStart}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-600 dark:text-neutral-300 mb-1.5 uppercase tracking-wide">{t.home_label_exit_time}</label>
                  <TimeInputField
                    size="hero"
                    value={clockOutInput}
                    onChange={setClockOutInput}
                    aria-label={t.home_label_exit_time}
                    className="w-full tabular-nums"
                    autoFocus
                  />
                </div>

                {homeClockComplete && (
                  <div className="bg-slate-50 dark:bg-neutral-800/80 rounded-xl p-3 mb-4 grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: t.home_modal_start, val: closeModal.actualStart },
                      { label: t.home_modal_end, val: clockOutInput },
                      { label: t.home_modal_duration, val: `${Math.floor(previewMins / 60)}h${previewMins % 60 > 0 ? String(previewMins % 60).padStart(2,'0') : ''}` },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <p className="text-[10px] text-slate-500 dark:text-neutral-400 uppercase font-semibold mb-0.5">{label}</p>
                        <p className="font-bold text-slate-800 dark:text-neutral-100 text-sm tabular-nums">{val}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button type="button" onClick={() => { setCloseModal(null); setClockOutInput(''); }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-neutral-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors">
                    {t.cancel}
                  </button>
                  <button type="button" disabled={!clockOutInput || closingLoading} onClick={handleConfirmClose}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                    {closingLoading ? t.saving : <><LogOutIcon className="w-4 h-4" />{t.home_btn_register}</>}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {approveModal && currentUser && (
        <ApproveShiftModal
          shift={approveModal.shift}
          punchRecords={punchRecords}
          userName={approveModal.userName}
          currentUser={currentUser}
          onClose={() => setApproveModal(null)}
          onApprove={(id, st, en) => handleApproveFromModal(id, st, en)}
        />
      )}
    </>
  );
}

// ── Shift Card Sub-component ──────────────────────────────────────────────────
export interface HomeManagementShiftCardProps {
  e: {
    shift: { id: string; start_time: string; end_time?: string | null; approval_status: string; date?: string };
    user?: { first_name?: string; department?: string; role?: string } | null;
    isDinner: boolean;
    punchIn?: { id: string } | null;
    actualStart: string | null;
    actualEnd: string | null;
    scheduledStart: string;
    scheduledEnd: string;
    scheduledMins: number;
    actualMins: number;
    deltaMins: number;
    isLate: boolean;
    hasMissingOut: boolean;
    isApproved: boolean;
    canApprove: boolean;
    canClose: boolean;
  };
  style: { border: string; bg: string; badge: string; dot: string; label: string };
  isManager: boolean;
  onClose: () => void;
  onApprove: () => void;
  approvingId: string | null;
  t: Record<string, string>;
}

/** Esportato per anteprima admin (Cosa vede chi) — stessa UI dei turni in Home gestionale. */
export function HomeManagementShiftCard({ e, style, isManager, onClose, onApprove, approvingId, t }: HomeManagementShiftCardProps) {
  const deltaColor =
    e.deltaMins > 5 ? 'text-accent' : e.deltaMins < -5 ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-neutral-400';
  const notPunchedLineCls = style.border.includes('emerald')
    ? 'text-emerald-900 dark:text-emerald-50'
    : style.border.includes('slate-400')
      ? 'text-slate-700 dark:text-neutral-200'
      : style.border.includes('rose-')
        ? 'text-rose-900 dark:text-rose-100'
        : style.border.includes('red-')
          ? 'text-red-800 dark:text-red-100'
          : 'text-amber-950 dark:text-amber-100';

  return (
    <div className={`rounded-2xl border-l-4 ${style.border} ${style.bg} p-4 shadow-sm`}>
      {/* Header: avatar + name + badge */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${style.bg} border ${style.badge.split(' ')[2] ?? 'border-slate-200'} text-slate-700 dark:text-neutral-200`}>
          {e.user?.first_name?.[0] ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 dark:text-neutral-100 text-sm truncate">{e.user?.first_name ?? '—'}</p>
          <p className="text-[10px] text-slate-500 dark:text-neutral-400 truncate">{e.user?.department ?? e.user?.role ?? ''}</p>
          {e.shift.date && (
            <p className="text-[10px] font-semibold text-slate-500 dark:text-neutral-400 tabular-nums">
              {safeFormatDate(e.shift.date, 'EEE d MMM', { locale: it })}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.badge}`}>{style.label}</span>
          <span className={`text-[10px] font-semibold text-slate-500 dark:text-neutral-400 flex items-center gap-0.5`}>
            {e.isDinner ? <Moon className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400" /> : <Sun className="h-2.5 w-2.5 text-amber-400" />}
            {e.isDinner ? t.dinner : t.lunch}
          </span>
        </div>
      </div>

      {/* Scheduled vs Actual */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="surface-glass-sm bg-slate-50/35 px-2.5 py-2 dark:bg-neutral-900/25">
          <p className="text-[9px] text-slate-500 dark:text-neutral-400 uppercase font-semibold mb-0.5">{t.home_label_planned}</p>
          <p className="text-sm font-bold text-slate-600 dark:text-neutral-200 tabular-nums">{e.scheduledStart} → {e.scheduledEnd}</p>
        </div>
        <div className="surface-glass-sm bg-slate-50/35 px-2.5 py-2 dark:bg-neutral-900/25">
          <p className="text-[9px] text-slate-500 dark:text-neutral-400 uppercase font-semibold mb-0.5">{t.ts_label_punched}</p>
          {e.actualStart ? (
            <p className="text-sm font-bold text-slate-800 dark:text-neutral-100 tabular-nums">
              {e.actualStart} → {e.actualEnd ?? <span className="text-red-500 dark:text-red-400">…</span>}
            </p>
          ) : (
            <p className={`text-sm font-semibold italic ${notPunchedLineCls}`}>{t.home_status_not_punched}</p>
          )}
        </div>
      </div>

      {/* Delta */}
      {e.actualMins > 0 && (
        <div className={`text-[11px] font-bold mb-2 ${deltaColor}`}>
          {fmtHM(e.deltaMins)} {t.home_vs_planned}
        </div>
      )}

      {/* Actions */}
      {isManager && (
        <div className="flex gap-1.5 mt-1">
          {e.canClose && (
            <button type="button" onClick={onClose}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors">
              <LogOutIcon className="w-3.5 h-3.5" /> {t.home_btn_close_shift}
            </button>
          )}
          {e.canApprove && (
            <button type="button" onClick={onApprove} disabled={approvingId === e.shift.id}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-colors disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />
              {approvingId === e.shift.id ? '...' : t.home_btn_approve}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
