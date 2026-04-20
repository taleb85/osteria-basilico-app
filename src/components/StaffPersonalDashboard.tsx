import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Download, X, Share, ChevronRight, ChevronLeft, LogOut, Shield, Calendar } from 'lucide-react';
import { database } from '../lib/database';
import { useApp } from '../context/AppContext';
import { User as UserType, Shift, HolidayRequest, PunchRecord } from '../types';
import { format, isToday, isFuture, startOfWeek, endOfWeek, addWeeks, addDays, startOfMonth, endOfMonth, parseISO, isWithinInterval, startOfDay, endOfDay, getISOWeek } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';
import { loadPeriodConfig, getPeriodDateRange, prevPeriodConfig, nextPeriodConfig, type PeriodConfig } from '../utils/periodConfig';
import { getTimesheetGridPrivacyMode } from '../utils/timesheetGridPrivacy';
import { formatMinutesToHoursAndMinutes } from '../utils/timeCalculations';
import { getNetShiftMinutes } from '../utils/breakRules';
import { getResolvedStartEndForHours } from '../utils/shiftResolvedClockTimes';
import { getTranslations, getDateLocale } from '../utils/translations';
import {
  getVisibleStaffTabs,
  getUnifiedNavTabs,
  type AppNavTab,
} from '../utils/enabledModules';
import { useWallAlignedMinuteClock } from '../hooks/useWallAlignedMinuteClock';
import MobileStaffDashboard from './mobile/MobileStaffDashboard';
// import MobileShifts from './mobile/MobileShifts'; // rendered via MobileStaffDashboard
// import MobileTimesheet from './mobile/MobileTimesheet'; // rendered via MobileStaffDashboard
import ManagementMobileShifts from './mobile/ManagementMobileShifts';
import ManagementMobileTimesheet from './mobile/ManagementMobileTimesheet';
import MobileRequests from './mobile/MobileRequests';
import MobileStatsCards from './mobile/MobileStatsCards';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
// const Timesheets = lazy(() => import('./Timesheets')); // unused here
const HolidayRequests = lazy(() => import('./HolidayRequests'));
const Statistics = lazy(() => import('./Statistics'));
// const WeeklyShiftsTable = lazy(() => import('./WeeklyShiftsTable')); // unused here
const SettingsPage = lazy(() => import('./SettingsPage'));

import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { isSameWeek, eachDayOfInterval } from 'date-fns';
// import { safeFormatDate } from '../utils/safeDateFormat'; // unused
import { isPurelyManagementRole } from '../utils/permissions';
import { isUiWidgetVisible } from '../utils/uiScreenWidgets';
import { userRowToSessionUser } from '../utils/staffPermissionDefaults';
import { APP_SESSION_STORAGE_KEY } from '../constants/appSession';
import { translateDepartmentValue } from '../utils/departmentLabels';
import AdminRow from './ui/AdminRow';
import RequestHolidayModal from './RequestHolidayModal';
import LanguageToggleGrid from './LanguageToggleGrid';
import NotificationCenter from './NotificationCenter';
import ProfileNavTabPanel from './ProfileNavTabPanel';
import { StaffPushNotificationPromptBanner } from './StaffPushNotificationPromptBanner';

// ─── Desktop grid view for staff shifts ───────────────────────────────────────
function StaffDesktopShifts({ shifts, language = 'it' }: { shifts: any[]; language?: import('../types').Language }) {
  const locale = getDateLocale(language) ?? itLocale;
  const t = getTranslations(language);
  const _STATUS_CFG = {
    approved:  { label: t.ts_status_approved  ?? 'Approvato',  Icon: CheckCircle2, pill: 'shift-badge-approved' },
    confirmed: { label: t.ts_status_confirmed ?? 'Confermato', Icon: AlertCircle,  pill: 'shift-badge-confirmed' },
    draft:     { label: t.status_draft        ?? 'Bozza',      Icon: AlertCircle,  pill: 'shift-badge-draft' },
    absent:    { label: t.status_absent       ?? 'Assente',    Icon: XCircle,      pill: 'shift-badge-absent' },
  } as const;

  const weeks = useMemo(() => {
    const sorted = [...shifts].sort((a, b) => a.date.localeCompare(b.date));
    const map: { start: Date; end: Date; shifts: any[] }[] = [];
    sorted.forEach(shift => {
      const d = parseISO(shift.date);
      const s = startOfWeek(d, { weekStartsOn: 1 });
      const e = endOfWeek(d, { weekStartsOn: 1 });
      let week = map.find(w => isSameWeek(w.start, s, { weekStartsOn: 1 }));
      if (!week) { week = { start: s, end: e, shifts: [] }; map.push(week); }
      week.shifts.push(shift);
    });
    return map;
  }, [shifts]);

  if (shifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border border-slate-200">
          <Calendar className="w-7 h-7 text-white/40" />
        </div>
        <p className="text-white/70 font-bold uppercase tracking-widest text-[10px]">
          {t.no_shifts_scheduled}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-11 pb-8">
      {weeks.map((week, wIdx) => {
        const weekDays = eachDayOfInterval({ start: week.start, end: week.end });
        const byDay = new Map<string, any[]>();
        weekDays.forEach(d => byDay.set(format(d, 'yyyy-MM-dd'), []));
        week.shifts.forEach(s => {
          const k = format(parseISO(s.date), 'yyyy-MM-dd');
          const arr = byDay.get(k) ?? [];
          arr.push(s);
          byDay.set(k, arr);
        });

        const totalMins = week.shifts.reduce((acc, s) => {
          if (!s.start_time || !s.end_time || s.approval_status === 'absent') return acc;
          const [sh, sm] = s.start_time.split(':').map(Number);
          const [eh, em] = s.end_time.split(':').map(Number);
          return acc + (eh * 60 + em - sh * 60 - sm);
        }, 0);
        const totalH = Math.floor(totalMins / 60);
        const totalM = totalMins % 60;
        const totalLabel = totalMins > 0 ? (totalM > 0 ? `${totalH}h ${totalM}m` : `${totalH}h`) : '';

        return (
          <div key={wIdx}
            className="shift-card-ultra shift-week-spacing-ultra overflow-hidden"
          >
            {/* Week header */}
            <div className="flex items-center justify-between px-6 py-6 shift-separator-ultra">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-black" />
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/60 leading-none mb-1">
                    {t.week_label ?? 'Sett.'}
                  </p>
                  <p className="text-base font-semibold text-white">
                    {format(week.start, 'd MMM', { locale })} – {format(week.end, 'd MMM', { locale })}
                  </p>
                </div>
              </div>
              {totalLabel && (
                <span className="shift-total-ultra shift-time-clean">
                  {totalLabel}
                </span>
              )}
            </div>

            {/* 7-column day grid - NO VERTICAL BORDERS */}
            <div className="grid grid-cols-7">
              {weekDays.map((day, dIdx) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayShifts = (byDay.get(dateStr) ?? []).sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
                const _isWeekend = dIdx >= 5;
                const today = isToday(day);

                return (
                  <div
                    key={dateStr}
                    className={`flex flex-col min-h-[160px] ${today ? 'bg-white/20' : ''}`}
                  >
                    {/* Day header */}
                    <div className={`px-3 py-3 ${today ? 'bg-white/15' : ''}`}>
                      <p className={`text-[9px] font-medium uppercase tracking-wider mb-1 ${today ? 'text-white' : 'text-white/70'}`}>
                        {format(day, 'EEE', { locale })}
                      </p>
                      <p className={`text-base font-semibold ${today ? 'text-white' : 'text-white/90'}`}>
                        {format(day, 'd')}
                      </p>
                    </div>

                    {/* Shifts - NO BOXES, solo testo pulito con whitespace aumentato */}
                    <div className="flex flex-col shift-gap-ultra px-5 py-5 flex-1">
                      {dayShifts.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                          <span className="w-1 h-1 rounded-full bg-slate-200" />
                        </div>
                      ) : dayShifts.map((shift: any) => {
                        const isAbsent = shift.approval_status === 'absent';
                        const isDraft = shift.approval_status === 'draft';

                        // Planned hours
                        const [sh, sm2] = (shift.start_time ?? '00:00').split(':').map(Number);
                        const [eh, em2] = (shift.end_time ?? '00:00').split(':').map(Number);
                        const plannedMins = isAbsent ? 0 : Math.max(0, eh * 60 + em2 - sh * 60 - sm2);
                        const ph = Math.floor(plannedMins / 60);
                        const pm = plannedMins % 60;
                        const hoursLabel = isAbsent ? '' : (pm > 0 ? `${ph}h ${pm}m` : `${ph}h`);

                        // Classe stato dinamica
                        const statusCls = isDraft ? 'shift-status-draft' : 'shift-status-confirmed';

                        return (
                          <div
                            key={shift.id}
                            className="text-left"
                          >
                            {isAbsent ? (
                              <p className="shift-status-off text-center py-2">OFF</p>
                            ) : (
                              <>
                                {/* Orari ULTRA-CLEAN: 22px medio sans-serif */}
                                <p className={`shift-time-ultra shift-time-clean leading-tight ${statusCls}`}>
                                  {shift.start_time.slice(0, 5)}–{shift.end_time?.slice(0, 5) ?? '…'}
                                </p>
                                {/* Ore totali piccole sotto */}
                                <p className="text-xs font-medium text-white/50 mt-0.5">
                                  {hoursLabel}
                                </p>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Desktop grid view for staff timesheet ────────────────────────────────────
function StaffDesktopTimesheet({
  shifts, punchRecords, user, breakRules, breakComputeOpts, language = 'it',
}: {
  shifts: any[]; punchRecords: any[]; user: any; breakRules: any;   breakComputeOpts: any; language?: import('../types').Language;
}) {
  const locale = getDateLocale(language) ?? itLocale;
  const t = getTranslations(language);
  

  const _STATUS_CONFIG = {
    approved: { label: t.ts_status_approved ?? 'Approvato', Icon: CheckCircle2, pill: 'shift-badge-approved' },
    confirmed: { label: t.ts_status_confirmed ?? 'Confermato', Icon: AlertCircle, pill: 'shift-badge-confirmed' },
    absent: { label: t.status_absent ?? 'Assente', Icon: XCircle, pill: 'shift-badge-absent' },
  } as const;

  const history = shifts
    .filter(s => s.date <= format(new Date(), 'yyyy-MM-dd'))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border border-slate-200">
          <Clock className="w-7 h-7 text-white/40" />
        </div>
        <p className="text-white/70 font-bold uppercase tracking-widest text-[10px]">
          {t.no_shifts_scheduled ?? 'Nessuno storico disponibile'}
        </p>
      </div>
    );
  }

  // Group by week
  const weeks: { start: Date; end: Date; shifts: any[] }[] = [];
  history.forEach(shift => {
    const sd = new Date(shift.date);
    const s = startOfWeek(sd, { weekStartsOn: 1 });
    const e = endOfWeek(sd, { weekStartsOn: 1 });
    let week = weeks.find(w => isSameWeek(w.start, s, { weekStartsOn: 1 }));
    if (!week) { week = { start: s, end: e, shifts: [] }; weeks.push(week); }
    week.shifts.push(shift);
  });

  return (
    <div className="flex flex-col gap-11 pb-8">
      {weeks.map((week, wIdx) => {
        // Total hours
        let totalMins = 0;
        week.shifts.forEach(shift => {
          const { start, end } = getResolvedStartEndForHours(shift, punchRecords);
          totalMins += getNetShiftMinutes(shift, start, end, user, breakRules, breakComputeOpts);
        });
        const totalH = Math.floor(totalMins / 60);
        const totalM = totalMins % 60;
        const totalLabel = totalM > 0 ? `${totalH}h ${totalM}m` : `${totalH}h`;

        // All 7 days of the week
        const weekDays = eachDayOfInterval({ start: week.start, end: week.end });

        // Map date → shifts
        const dayMap = new Map<string, any[]>();
        week.shifts.forEach(shift => {
          const arr = dayMap.get(shift.date) ?? [];
          arr.push(shift);
          dayMap.set(shift.date, arr);
        });
        weekDays.forEach(d => {
          const k = format(d, 'yyyy-MM-dd');
          if (!dayMap.has(k)) dayMap.set(k, []);
        });

        return (
          <div key={wIdx}
            className="shift-card-ultra shift-week-spacing-ultra overflow-hidden"
          >
            {/* Week header */}
            <div className="flex items-center justify-between px-6 py-6 shift-separator-ultra">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-black" />
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/60 leading-none mb-1">
                    {t.week_label ?? 'Sett.'}
                  </p>
                  <p className="text-base font-semibold text-white">
                    {format(week.start, 'd MMM', { locale })} – {format(week.end, 'd MMM', { locale })}
                  </p>
                </div>
              </div>
              {totalMins > 0 && (
                <span className="shift-total-ultra shift-time-clean">
                  {totalLabel}
                </span>
              )}
            </div>

            {/* Day grid: 7 columns - NO VERTICAL BORDERS */}
            <div className="grid grid-cols-7">
              {weekDays.map((day, dIdx) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayShifts = (dayMap.get(dateStr) ?? []).sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
                const _isWeekend = dIdx >= 5;
                const today = isToday(day);

                return (
                  <div
                    key={dateStr}
                    className={`flex flex-col min-h-[160px] ${today ? 'bg-white/20' : ''}`}
                  >
                    {/* Day header */}
                    <div className={`px-3 py-3 ${today ? 'bg-white/15' : ''}`}>
                      <p className={`text-[9px] font-medium uppercase tracking-wider mb-1 ${today ? 'text-white' : 'text-white/70'}`}>
                        {format(day, 'EEE', { locale })}
                      </p>
                      <p className={`text-base font-semibold ${today ? 'text-white' : 'text-white/90'}`}>
                        {format(day, 'd')}
                      </p>
                    </div>

                    {/* Shifts - ULTRA-CLEAN: padding aumentato */}
                    <div className="flex flex-col shift-gap-ultra px-5 py-5 flex-1">
                      {dayShifts.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                          <span className="w-1 h-1 rounded-full bg-slate-200" />
                        </div>
                      ) : dayShifts.map((shift: any) => {
                        const isAbsent = shift.approval_status === 'absent';
                        const isDraft = shift.approval_status === 'draft';
                        const { start, end } = getResolvedStartEndForHours(shift, punchRecords);
                        const mins = getNetShiftMinutes(shift, start, end, user, breakRules, breakComputeOpts);
                        const hh = Math.floor(mins / 60);
                        const mm = mins % 60;
                        const hoursLabel = isAbsent ? '' : (mm > 0 ? `${hh}h ${mm}m` : `${hh}h`);

                        const statusCls = isDraft ? 'shift-status-draft' : 'shift-status-confirmed';

                        return (
                          <div
                            key={shift.id}
                            className="text-left"
                          >
                            {isAbsent ? (
                              <p className="shift-status-off text-center py-2">OFF</p>
                            ) : (
                              <>
                                <p className={`shift-time-ultra shift-time-clean leading-tight ${statusCls}`}>
                                  {shift.start_time.slice(0, 5)}–{shift.end_time?.slice(0, 5) ?? '…'}
                                </p>
                                <p className="text-xs font-medium text-white/50 mt-0.5">
                                  {hoursLabel}
                                </p>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface StaffPersonalDashboardProps {
  user: UserType;
  onLogout: () => void;
  activeTab: AppNavTab;
  onTabChange: (tab: AppNavTab) => void;
}

const showProfileDemoSeed =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_PROFILE_DEMO_SEED === 'true';

export default function StaffPersonalDashboard({
  user,
  onLogout,
  activeTab,
  onTabChange,
}: StaffPersonalDashboardProps) {
  const {
    setCurrentUser,
    users,
    effectiveLanguage,
    setLanguage,
    breakRules,
    featureFlags,
    roleTemplatesRevision,
    seedDemoProfileForUser,
    showSuccess,
    showError,
  } = useApp();
  const latestUser = users.find((u) => u.id === user.id) ?? user;
  // Usa latestUser (da users) per permessi: quando l'admin disabilita can_request_holidays,
  // currentUser non viene aggiornato (è un altro utente), ma users sì.
  const displayUser = latestUser;
  const uiW = useCallback((key: string) => isUiWidgetVisible(displayUser, key), [displayUser]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<HolidayRequest[]>([]);
  const [punchRecords, setPunchRecords] = useState<PunchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [seedingDemoProfile, setSeedingDemoProfile] = useState(false);
  const t = getTranslations(effectiveLanguage);
  const now = useWallAlignedMinuteClock();
  const breakComputeOpts = useMemo(
    () => ({ autoBreaksFeatureEnabled: featureFlags['auto_breaks'] !== false }),
    [featureFlags]
  );

  const loadUserData = useCallback(async () => {
    try {
      const [shiftsData, holidaysData, punchesData] = await Promise.all([
        database.shifts.getByUserId(user.id),
        database.holidays.getByUserId(user.id),
        database.punchRecords.getByUserId(user.id),
      ]);
      setShifts(shiftsData);
      setHolidays(holidaysData);
      setPunchRecords(punchesData);
    } catch (error) {
      console.error(t.load_error, error);
    } finally {
      setLoading(false);
    }
  }, [user.id, t.load_error]);

  // Allinea currentUser alla riga aggiornata in `users` (permessi, JSONB) — stessa normalizzazione del login / realtime.
  useEffect(() => {
    if (latestUser.status !== 'active') {
      try {
        localStorage.removeItem(APP_SESSION_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setCurrentUser(null);
      return;
    }
    setCurrentUser(userRowToSessionUser(latestUser));
  }, [latestUser, setCurrentUser]);

  useEffect(() => {
    loadUserData();
    const unsubShifts = database.realtime.subscribeToShifts(user.id, setShifts);
    const unsubHolidays = database.realtime.subscribeToHolidays(user.id, setHolidays);
    const unsubPunches = database.realtime.subscribeToPunchRecords(user.id, setPunchRecords);
    return () => {
      unsubShifts();
      unsubHolidays();
      unsubPunches();
    };
  }, [user.id, loadUserData]);

  /** PWA ↔ Safari / cambio app: realtime può restare indietro — riallinea da DB. */
  useEffect(() => {
    let reloadDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (document.visibilityState !== 'visible') {
        if (reloadDebounceTimer) {
          clearTimeout(reloadDebounceTimer);
          reloadDebounceTimer = null;
        }
        return;
      }
      if (reloadDebounceTimer) clearTimeout(reloadDebounceTimer);
      reloadDebounceTimer = setTimeout(() => {
        reloadDebounceTimer = null;
        loadUserData();
      }, 300);
    };
    document.addEventListener('visibilitychange', scheduleReload);
    window.addEventListener('focus', scheduleReload);
    window.addEventListener('online', scheduleReload);
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted || document.visibilityState === 'visible') scheduleReload();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', scheduleReload);
      window.removeEventListener('focus', scheduleReload);
      window.removeEventListener('online', scheduleReload);
      window.removeEventListener('pageshow', onPageShow);
      if (reloadDebounceTimer) clearTimeout(reloadDebounceTimer);
    };
  }, [loadUserData]);
  const dateLocale = getDateLocale(effectiveLanguage);

  const displayName = (displayUser?.first_name?.trim() || displayUser?.email?.split('@')[0] || 'Utente').trim() || 'Utente';
  const displayDept = displayUser?.department
    ? translateDepartmentValue(displayUser.department, effectiveLanguage)
    : ((t as { department_none?: string }).department_none ?? 'Nessuno');

  const visibleShifts = shifts.filter(
    (s) => s.approval_status === 'approved' || s.approval_status === 'confirmed' || s.approval_status === 'absent'
  );
  const todayShifts = visibleShifts.filter((shift) => isToday(new Date(shift.date)));
  const upcomingShifts = visibleShifts.filter((shift) => isFuture(new Date(shift.date)));
  const approvedShifts = visibleShifts;
  
  const totalApprovedMinutes = approvedShifts.reduce((sum, shift) => {
    const { start, end } = getResolvedStartEndForHours(shift, punchRecords);
    return sum + getNetShiftMinutes(shift, start, end, displayUser, breakRules, breakComputeOpts);
  }, 0);
  const totalApprovedHours = formatMinutesToHoursAndMinutes(totalApprovedMinutes);

  // ── PWA Install Prompt ────────────────────────────────────────────────────
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Already installed as PWA — don't show the banner
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Already dismissed
    if (localStorage.getItem('pwa_install_dismissed') === '1') return;

    // iOS detection (no beforeinstallprompt — show manual instructions)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
    if (ios) {
      setIsIos(true);
      setShowInstallBanner(true);
      return;
    }

    // Legge il prompt già catturato in index.html prima del caricamento di React
    const already = (window as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt;
    if (already) {
      setDeferredInstallPrompt(already);
      setShowInstallBanner(true);
      return;
    }
    // Fallback: ascolta nel caso il componente monti prima del prompt
    const handler = (e: Event) => {
      e.preventDefault();
      (window as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt = e;
      setDeferredInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = () => {
    if (!deferredInstallPrompt) return;
    const p = deferredInstallPrompt as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };
    p.prompt();
    p.userChoice
      .then(({ outcome }) => {
        if (outcome === 'accepted') {
          setShowInstallBanner(false);
          setDeferredInstallPrompt(null);
          (window as { __deferredInstallPrompt?: Event }).__deferredInstallPrompt = undefined;
        }
      })
      .catch(() => {});
  };

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa_install_dismissed', '1');
  };
  // ─────────────────────────────────────────────────────────────────────────

  const monthKey = format(new Date(), 'yyyy-MM');
  const _confirmedThisMonth = displayUser.monthly_confirmed?.[monthKey];
  const _shiftsListRef = useRef<HTMLDivElement>(null);

  const [holidaysFocus, setHolidaysFocus] = useState(false);

  useEffect(() => {
    if (activeTab !== 'home') setHolidaysFocus(false);
  }, [activeTab]);

  /** Sempre prima di qualsiasi return anticipato (loading / profilo gestionale) — altrimenti React #310. */
  const _visibleStaffTabs = useMemo(() => {
    void roleTemplatesRevision;
    return getVisibleStaffTabs(displayUser, featureFlags);
  }, [displayUser, featureFlags, roleTemplatesRevision]);

  const _staffUnifiedTabs = useMemo(() => {
    void roleTemplatesRevision;
    return getUnifiedNavTabs(displayUser, false, featureFlags);
  }, [displayUser, featureFlags, roleTemplatesRevision]);

  const staffHomeWeeklyMonthly = useMemo(() => {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 7);
    const mStart = startOfMonth(now);
    const mEnd = endOfMonth(now);
    const weekOk = (s: Shift) =>
      s.approval_status === 'approved' || s.approval_status === 'confirmed' || s.approval_status === 'absent';
    const thisWeekShifts = visibleShifts.filter((s) => {
      const d = parseISO(s.date);
      return d >= weekStart && d < weekEnd && weekOk(s);
    });
    let weeklyMinutes = 0;
    for (const s of thisWeekShifts) {
      if (s.approval_status === 'absent') continue;
      const { start, end } = getResolvedStartEndForHours(s, punchRecords);
      weeklyMinutes += getNetShiftMinutes(s, start, end, displayUser, breakRules, breakComputeOpts);
    }
    const monthShifts = visibleShifts.filter((s) => {
      const d = parseISO(s.date);
      return d >= mStart && d <= mEnd && weekOk(s);
    });
    let monthlyMinutes = 0;
    for (const s of monthShifts) {
      if (s.approval_status === 'absent') continue;
      const { start, end } = getResolvedStartEndForHours(s, punchRecords);
      monthlyMinutes += getNetShiftMinutes(s, start, end, displayUser, breakRules, breakComputeOpts);
    }
    const monthDaysWorked = new Set(monthShifts.filter((s) => s.approval_status !== 'absent').map((s) => s.date)).size;
    const monthShiftCount = monthShifts.filter((s) => s.approval_status !== 'absent').length;
    return { weeklyMinutes, monthlyMinutes, monthDaysWorked, monthShiftCount };
  }, [now, visibleShifts, punchRecords, displayUser, breakRules, breakComputeOpts]);

  const showHomeKpiStrip =
    totalApprovedMinutes > 0 || todayShifts.length + upcomingShifts.length > 0;

  const renderHome = () => {
    const grouped: Record<string, typeof upcomingShifts> = {};
    upcomingShifts.slice(0, 10).forEach(s => {
      if (!grouped[s.date]) grouped[s.date] = [];
      grouped[s.date].push(s);
    });
    const _sortedDates = Object.keys(grouped).sort().slice(0, 6);
    const todayStr = format(now, 'yyyy-MM-dd');

    return (
      <div className="space-y-0">
        <StaffPushNotificationPromptBanner userId={displayUser.id} effectiveLanguage={effectiveLanguage} />
        <MobileStaffDashboard
          user={displayUser}
          language={effectiveLanguage}
          todayStr={todayStr}
          now={now}
          myShifts={shifts}
          punchRecords={punchRecords}
          weeklyMinutes={staffHomeWeeklyMonthly.weeklyMinutes}
          monthlyMinutes={staffHomeWeeklyMonthly.monthlyMinutes}
          monthDaysWorked={staffHomeWeeklyMonthly.monthDaysWorked}
          weekCapMinutes={40 * 60}
          onTabChange={onTabChange}
          greetingText={t.home_greeting.replace('{name}', displayUser.first_name ?? '')}
          activeTab={activeTab}
          onRefresh={loadUserData}
        />
      </div>
    );
  };

  const shiftsSortedMobile = useMemo(
    () =>
      [...visibleShifts].sort(
        (a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
      ),
    [visibleShifts]
  );

  const isMobile = useIsMobileViewport();

  /** Sub-tab interno scheda Presenze/Ore: presenze oppure statistiche. */
  const [tsStaffView, setTsStaffView] = useState<'presence' | 'stats'>('presence');
  const showStatsSubTabStaff = featureFlags['view_stats'] !== false;

  // ── Navigazione periodo mobile (turni + presenze) ──────────────
  type MobileNavTab = 'week' | 'period';
  const [mobileNavTab, _setMobileNavTab] = useState<MobileNavTab>('period');
  const [mobileNavOffset, setMobileNavOffset] = useState(0);

  const getMobileRange = useCallback((tab: MobileNavTab, offset: number): { start: Date; end: Date } => {
    const today = new Date();
    if (tab === 'week') {
      const base = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), offset);
      return { start: startOfDay(base), end: endOfDay(endOfWeek(base, { weekStartsOn: 1 })) };
    }
    let cfg: PeriodConfig = loadPeriodConfig();
    if (offset > 0) for (let i = 0; i < offset; i++) cfg = nextPeriodConfig(cfg);
    else if (offset < 0) for (let i = 0; i > offset; i--) cfg = prevPeriodConfig(cfg);
    const r = getPeriodDateRange(cfg);
    return { start: startOfDay(new Date(r.startDate)), end: endOfDay(new Date(r.endDate)) };
  }, []);

  const mobileRange = useMemo(
    () => getMobileRange(mobileNavTab, mobileNavOffset),
    [getMobileRange, mobileNavTab, mobileNavOffset]
  );

  const mobileShiftsFiltered = useMemo(
    () => shiftsSortedMobile.filter(s => {
      const d = parseISO(s.date);
      return isWithinInterval(d, { start: mobileRange.start, end: mobileRange.end });
    }),
    [shiftsSortedMobile, mobileRange]
  );

  const mobileTimesheetFiltered = useMemo(
    () => visibleShifts.filter(s => {
      const d = parseISO(s.date);
      return isWithinInterval(d, { start: mobileRange.start, end: mobileRange.end });
    }),
    [visibleShifts, mobileRange]
  );

  const mobileLocale = dateLocale ?? itLocale;

  // ── Statistiche per MobileStatsCards ──────────────────────────────────────
  const mobileStatsData = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd   = endOfWeek(now,   { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd   = endOfMonth(now);

    const workedStatuses = new Set(['approved', 'confirmed']);
    const calcMins = (s: Shift) => {
      const { start, end } = getResolvedStartEndForHours(s, punchRecords);
      return getNetShiftMinutes(s, start, end, displayUser, breakRules, breakComputeOpts);
    };

    let weekWorkedMins = 0;
    let monthWorkedMins = 0;
    const monthWorkedDays = new Set<string>();

    for (const s of visibleShifts) {
      if (!workedStatuses.has(s.approval_status ?? '')) continue;
      const d = parseISO(s.date);
      const mins = calcMins(s);
      if (isWithinInterval(d, { start: weekStart,  end: weekEnd  })) weekWorkedMins  += mins;
      if (isWithinInterval(d, { start: monthStart, end: monthEnd })) {
        monthWorkedMins += mins;
        monthWorkedDays.add(s.date);
      }
    }

    const weekCapMins = ((displayUser as any).hours_per_week ?? 40) * 60;

    return { weekWorkedMins, weekCapMins, monthWorkedMins, monthDaysWorked: monthWorkedDays.size };
  }, [visibleShifts, punchRecords, displayUser, breakRules, breakComputeOpts]);

  const MobileNavBar = () => (
    <div className="flex items-center gap-2 mb-4 px-4">
      {/* Etichetta "Periodo" a sinistra */}
      <span className="h-9 inline-flex items-center px-3 rounded-2xl bg-accent text-white text-[10px] font-extrabold uppercase tracking-wider shrink-0 shadow-sm">
        {t.tab_period}
      </span>

      {/* Frecce + chip data a destra */}
      <div className="flex items-center border border-slate-100 rounded-2xl overflow-hidden flex-1 supports-[backdrop-filter]:backdrop-blur-md" style={{ background: 'transparent', boxShadow: 'none' }}>
        <button
          type="button"
          onClick={() => setMobileNavOffset(o => o - 1)}
          className="flex items-center justify-center h-9 w-9 text-white/60 hover:bg-slate-50 transition-colors shrink-0 border-r border-slate-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 flex items-center justify-center gap-1.5 px-2 min-w-0">
          <Calendar className="h-3 w-3 text-white/50 shrink-0" />
          <span className="text-[10px] font-bold text-white/80 tabular-nums truncate">
            {mobileNavTab === 'week'
              ? `S.${getISOWeek(mobileRange.start)} · ${format(mobileRange.start, 'd MMM', { locale: mobileLocale })} – ${format(mobileRange.end, 'd MMM', { locale: mobileLocale })}`
              : `${format(mobileRange.start, 'd MMM', { locale: mobileLocale })} – ${format(mobileRange.end, 'd MMM yy', { locale: mobileLocale })}`
            }
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMobileNavOffset(o => o + 1)}
          className="flex items-center justify-center h-9 w-9 text-white/60 hover:bg-slate-50 transition-colors shrink-0 border-l border-slate-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const renderShifts = () => (
    <div className="space-y-4">
      {isMobile ? (
        <ManagementMobileShifts
          shifts={mobileShiftsFiltered}
          users={users}
          currentUserId={displayUser.id}
          language={effectiveLanguage}
        />
      ) : (
        <>
          <MobileNavBar />
          <StaffDesktopShifts shifts={mobileShiftsFiltered} language={effectiveLanguage} />
        </>
      )}
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-4">
      {uiW('staff_profile.panel') && (
      <div className="surface-glass">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="ui-section-title text-white/70">{(t as { profile_settings?: string }).profile_settings ?? 'Impostazioni profilo'}</h3>
        </div>
        <div>
          <AdminRow
            label={t.sidebar_profile}
            action={<span className="text-sm font-semibold text-white uppercase tracking-wide truncate max-w-[55%] text-right">{displayName}</span>}
          />
          <AdminRow
            label={(t as { email?: string }).email ?? 'Email'}
            action={<span className="text-sm text-white/70 truncate max-w-[55%] text-right">{displayUser?.email ?? '—'}</span>}
          />
          <AdminRow
            label={(t as { phone?: string }).phone ?? 'Telefono'}
            action={<span className="text-sm text-white/70">{displayUser?.phone ?? '—'}</span>}
          />
          <AdminRow
            label={(t as { department_label?: string }).department_label ?? 'Reparto'}
            action={<span className="text-sm text-white/70">{displayDept}</span>}
          />
          <AdminRow label={t.profile_notifications} action={<NotificationCenter denseTrigger />} />
          <AdminRow
            className="!items-start"
            label={t.language}
            action={
              <div className="min-w-0 max-w-full sm:max-w-xs">
                <LanguageToggleGrid effectiveLanguage={effectiveLanguage} setLanguage={setLanguage} />
              </div>
            }
          />
          {showProfileDemoSeed && (
            <div className="border-t border-slate-100 px-5 py-4 space-y-2">
              <button
                type="button"
                disabled={seedingDemoProfile}
                onClick={async () => {
                  if (!window.confirm(t.settings_seed_demo_profile_confirm)) return;
                  setSeedingDemoProfile(true);
                  try {
                    await seedDemoProfileForUser(user.id);
                    await loadUserData();
                    showSuccess(t.settings_seed_demo_profile_done);
                  } catch (e) {
                    showError(e instanceof Error ? e.message : t.settings_seed_demo_profile_error);
                  } finally {
                    setSeedingDemoProfile(false);
                  }
                }}
                className="w-full py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider bg-slate-100 text-white/80 hover:bg-slate-200 disabled:opacity-60 transition-colors"
              >
                {seedingDemoProfile ? t.ui_ellipsis : t.settings_seed_demo_profile_btn}
              </button>
              <p className="text-[10px] text-white/50 leading-relaxed">{t.settings_seed_demo_profile_hint}</p>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-between border-t border-slate-100 px-5 py-4 text-left hover:bg-red-50 transition-colors min-h-[52px] text-red-600 font-medium"
          >
            <span className="text-sm">{(t as { header_logout?: string }).header_logout ?? 'Esci'}</span>
            <LogOut className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
      </div>
      )}
    </div>
  );

  const renderHolidays = () => (
    <div className="space-y-4">
      {isMobile ? (
        <MobileRequests 
          requests={holidays.filter(h => h.user_id === user.id)} 
          onRequestNew={() => setIsHolidayModalOpen(true)}
          t={t}
        />
      ) : (
        <Suspense fallback={tabSpinner}>
          <HolidayRequests />
        </Suspense>
      )}
    </div>
  );

  if (loading) return null;

  // Profilo gestionale solo Admin: nessun turno assegnato (Proprietario = stesso flusso Manager)
  if (isPurelyManagementRole(displayUser.role)) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-white/90 font-sans antialiased flex flex-col items-center justify-center px-6 safe-area-pad">
        <div className="surface-glass max-w-sm p-8 text-center">
          <Shield className="w-14 h-14 text-white/60 mx-auto mb-4" strokeWidth={1.5} />
          <h2 className="text-lg font-bold text-white/90 mb-2">Profilo Gestionale</h2>
          <p className="text-white/60 text-sm">Nessun turno assegnato</p>
          <p className="text-white/60 text-xs mt-3">Questo profilo è riservato alla gestione. Accedi al pannello di controllo per amministrare turni e personale.</p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-6 w-full py-3 rounded-xl bg-slate-100 text-white/80 font-semibold text-sm hover:bg-slate-200 transition-colors"
          >
            {(t as { header_logout?: string }).header_logout ?? 'Esci'}
          </button>
        </div>
      </div>
    );
  }

  const tabMotionKey = holidaysFocus ? 'holidays-inline' : activeTab;

  const tabSpinner = (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full scroll-smooth text-white/90 font-sans antialiased pb-content">
      {holidaysFocus && (
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHolidaysFocus(false)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent min-h-[44px] px-2 -ml-2 rounded-xl hover:bg-accent/10 touch-target"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden />
            {(t as { back?: string }).back ?? 'Indietro'}
          </button>
          <span className="text-xs font-bold text-white/80 uppercase tracking-widest truncate">{t.sidebar_holidays}</span>
        </div>
      )}

      {activeTab === 'home' && !holidaysFocus && uiW('staff_home.header_kpi') && showHomeKpiStrip && (
        <div className="hidden md:block pb-4 pt-1">
          <div className="surface-glass p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl px-4 py-3 text-center"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: 'none',
                  boxShadow: '0 4px 16px 0 rgba(11, 53, 115, 0.06)',
                }}
              >
                <p className="text-white/60 text-[10px] font-medium uppercase tracking-widest mb-1">{t.week_hours}</p>
                <p className="text-white text-2xl font-bold tabular-nums">{totalApprovedHours}</p>
              </div>
              <div className="rounded-2xl px-4 py-3 text-center"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: 'none',
                  boxShadow: '0 4px 16px 0 rgba(11, 53, 115, 0.06)',
                }}
              >
                <p className="text-white/60 text-[10px] font-medium uppercase tracking-widest mb-1">{t.shifts_week}</p>
                <p className="text-white text-2xl font-bold tabular-nums">{upcomingShifts.length + todayShifts.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full min-h-[40vh]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tabMotionKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {holidaysFocus ? (
              renderHolidays()
            ) : (
              <>
                {activeTab === 'home' && renderHome()}
                {activeTab === 'turni' && renderShifts()}
                {activeTab === 'ferie' && renderHolidays()}
                {activeTab === 'timesheet' && (
                  <>
                    {/* ── Sub-tab: Presenze | Statistiche ── */}
                    {showStatsSubTabStaff && (
                      <div className="flex items-center gap-1.5 mb-4 px-4">
                        {(['presence', 'stats'] as const).map((v) => {
                          const label = v === 'presence' ? (t.tab_attendance ?? 'Presenze') : (t.tab_statistics ?? 'Statistiche');
                          const active = tsStaffView === v;
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setTsStaffView(v)}
                              className={`h-8 px-4 rounded-full text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                                active
                                  ? 'bg-[#3366CC] text-white shadow-sm'
                                  : 'bg-transparent border border-slate-200 text-white/60 hover:border-[#3366CC]/40 hover:text-[#3366CC]'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Statistiche ── */}
                    {tsStaffView === 'stats' && showStatsSubTabStaff && (
                      <div className="min-h-0 overflow-y-auto overscroll-y-contain scroll-smooth [-webkit-overflow-scrolling:touch] pb-1">
                        <Suspense fallback={tabSpinner}>
                          <Statistics />
                        </Suspense>
                      </div>
                    )}

                    {/* ── Presenze ── */}
                    {tsStaffView === 'presence' && (
                      <>
                        {isMobile && (
                          <div className="px-4 mb-4">
                            <MobileStatsCards
                              weekWorkedMins={mobileStatsData.weekWorkedMins}
                              weekCapMins={mobileStatsData.weekCapMins}
                              monthWorkedMins={mobileStatsData.monthWorkedMins}
                              monthDaysWorked={mobileStatsData.monthDaysWorked}
                              labels={{
                                title: t.tab_statistics ?? 'Statistiche',
                                week: t.ts_period_week ?? 'Settimana',
                                month: t.ts_period_month ?? 'Mese',
                                daysWorked: (t as any).mobile_dash_days_worked ?? 'Giorni lavorati',
                              }}
                            />
                          </div>
                        )}
                        {isMobile ? (
                          <ManagementMobileTimesheet
                            shifts={mobileTimesheetFiltered}
                            punchRecords={punchRecords}
                            users={users}
                            currentUserId={displayUser.id}
                            language={effectiveLanguage}
                            plannedOnly={getTimesheetGridPrivacyMode(displayUser) === 'planned_only'}
                          />
                        ) : (
                          <>
                            <MobileNavBar />
                            <StaffDesktopTimesheet
                              shifts={mobileTimesheetFiltered}
                              punchRecords={punchRecords}
                              user={displayUser}
                              breakRules={breakRules}
                              breakComputeOpts={breakComputeOpts}
                              language={effectiveLanguage}
                            />
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
                {activeTab === 'profile' && (
                  <div className="space-y-4">
                    <ProfileNavTabPanel onLogout={onLogout} />
                  </div>
                )}
                {activeTab === 'settings' && (
                  <Suspense fallback={tabSpinner}>
                    {displayUser?.elevated_role
                      ? <SettingsPage />
                      : renderProfile()
                    }
                  </Suspense>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showInstallBanner && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed bottom-[5.5rem] left-0 right-0 z-[45] flex justify-center px-4 max-w-screen-xl mx-auto"
          >
            <div className="modal-glass-panel flex w-full max-w-lg items-center gap-3 rounded-2xl px-4 py-3 !border-accent/25">
              <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                {isIos ? <Share className="w-4 h-4 text-white" /> : <Download className="w-4 h-4 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white/90 leading-tight">Installa l'app FLOW</p>
                {isIos ? (
                  <p className="text-[11px] text-white/60 mt-0.5 leading-snug">
                    Tocca <strong>Condividi</strong> → <strong>Aggiungi a schermata Home</strong>
                  </p>
                ) : (
                  <p className="text-[11px] text-white/60 mt-0.5">Accedi più velocemente ai tuoi turni</p>
                )}
              </div>
              {!isIos && (
                <button type="button" onClick={handleInstall}
                  className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors">
                  Installa
                </button>
              )}
              <button type="button" onClick={dismissInstallBanner}
                className="flex-shrink-0 p-1 rounded-xl text-white/50 hover:text-white/70 hover:bg-slate-100 transition-colors" aria-label={t.close}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RequestHolidayModal isOpen={isHolidayModalOpen} onClose={() => setIsHolidayModalOpen(false)} userId={user.id} />
    </div>
  );
}
