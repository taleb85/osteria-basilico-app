import { lightHaptic } from '../../utils/hapticFeedback';
import ProfileNavTabPanel from '../ProfileNavTabPanel';
import type { AppNavTab } from '../../utils/enabledModules';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Moon, X } from 'lucide-react';
import type { User, Shift, PunchRecord, Language } from '../../types';
import { useApp } from '../../context/AppContext';
import { getTranslations, getDateLocale } from '../../utils/translations';
import { usePunchPresenceVerification } from '../../hooks/usePunchPresenceVerification';
import { TimeInputField } from '../ui/TimeInputField';
import { safeFormatDate } from '../../utils/safeDateFormat';
import MobileHome from './MobileHome';
import { calculateUserStats } from '../../utils/stats';
import { isUserInRestaurantRange, getCurrentPositionCoords } from '../../utils/geo';
import { readGeofenceEnvConfig } from '../../utils/geofencePunch';

const Timesheets = lazy(() => import('../Timesheets'));
const HolidayRequests = lazy(() => import('../HolidayRequests'));
const Statistics = lazy(() => import('../Statistics'));
const SettingsPage = lazy(() => import('../SettingsPage'));
const WeeklyShiftsTable = lazy(() => import('../WeeklyShiftsTable'));

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
  } catch {
    return null;
  }
}

function getPunchPair(
  shiftId: string,
  userId: string,
  dateStr: string,
  isLunchSlot: boolean,
  punchRecords: PunchRecord[]
) {
  const punchIn = punchRecords.find((p) => {
    if (p.type !== 'in') return false;
    if (shiftId && p.shift_id) return p.shift_id === shiftId;
    if (p.user_id !== userId) return false;
    const d = new Date(p.timestamp);
    if (!isValid(d)) return false;
    return format(d, 'yyyy-MM-dd') === dateStr && (isLunchSlot ? d.getHours() < 16 : d.getHours() >= 16);
  });
  const punchOut = punchRecords.find((p) => {
    if (p.type !== 'out') return false;
    if (shiftId && p.shift_id) return p.shift_id === shiftId;
    if (p.user_id !== userId) return false;
    const d = new Date(p.timestamp);
    if (!isValid(d)) return false;
    return format(d, 'yyyy-MM-dd') === dateStr && (isLunchSlot ? d.getHours() < 16 : d.getHours() >= 16);
  });
  return { punchIn, punchOut };
}

function actualEndFromPunches(punchIn: PunchRecord | undefined, punchOut: PunchRecord | undefined): string | null {
  if (!punchIn) return null;
  const clockOutRaw = (punchIn as { clock_out_time?: string | null }).clock_out_time ?? null;
  if (clockOutRaw) return punchTimeHHMM(clockOutRaw);
  if (punchOut?.timestamp) return punchTimeHHMM(punchOut.timestamp);
  return null;
}

export interface MobileStaffDashboardProps {
  user: User;
  language: Language;
  todayStr: string;
  now: Date;
  myShifts: Shift[];
  punchRecords: PunchRecord[];
  onTabChange?: (tab: AppNavTab) => void;
  greetingText: string;
  /** Se true, mostra la barra icone fissa (di default la barra è nel genitore `StaffPersonalDashboard`). */
  showMobileBottomNav?: boolean;
  activeTab: AppNavTab;
  /** Se passati dal genitore (es. stesso calcolo KPI della Home), sovrascrivono gli stat interni. */
  weeklyMinutes?: number;
  monthlyMinutes?: number;
  monthDaysWorked?: number;
  weekCapMinutes?: number;
}

export default function MobileStaffDashboard({
  user,
  language,
  todayStr,
  now,
  myShifts,
  punchRecords,
  onTabChange,
  greetingText,
  showMobileBottomNav: _showMobileBottomNav = false,
  activeTab,
  weeklyMinutes: weeklyMinutesProp,
  monthlyMinutes: monthlyMinutesProp,
  monthDaysWorked: monthDaysWorkedProp,
  weekCapMinutes: weekCapMinutesProp,
}: MobileStaffDashboardProps) {
  const t = getTranslations(language);
  const tv = t as Record<string, string>;
  const locale = getDateLocale(language);
  const { 
    addPunchRecord, 
    updatePunchRecord, 
    showError, 
    showSuccess, 
    featureFlags,
    breakRules,
    geofenceEffectiveConfig,
  } = useApp();
  const { requestProof, modal: presenceModal } = usePunchPresenceVerification(language);
  const [punchBusy, setPunchBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [closeModal, setCloseModal] = useState<{
    shiftId: string;
    punchInId: string;
    plannedEnd: string;
    actualStart: string;
  } | null>(null);
  const [clockOutInput, setClockOutInput] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    return calculateUserStats(user, myShifts, punchRecords, now, breakRules, {
      autoBreaksFeatureEnabled: featureFlags['auto_breaks'] !== false,
    });
  }, [user, myShifts, punchRecords, now, breakRules, featureFlags]);

  const todayWorkShifts = useMemo(
    () =>
      myShifts
        .filter(
          (s) =>
            s.date === todayStr && (s.approval_status === 'confirmed' || s.approval_status === 'approved')
        )
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [myShifts, todayStr]
  );

  const enriched = useMemo(() => {
    return todayWorkShifts.map((s) => {
      const isLunchSlot = s.type === 'lunch' || timeToMins(s.start_time) < 16 * 60;
      const { punchIn, punchOut } = getPunchPair(s.id, user.id, todayStr, isLunchSlot, punchRecords);
      const actualStart = punchIn ? punchTimeHHMM(punchIn.calculated_time || punchIn.timestamp) : null;
      const actualEnd = actualEndFromPunches(punchIn, punchOut);
      return { shift: s, isLunchSlot, punchIn, punchOut, actualStart, actualEnd };
    });
  }, [todayWorkShifts, punchRecords, user.id, todayStr]);

  const inProgress = useMemo(() => enriched.find((e) => e.punchIn && !e.actualEnd) ?? null, [enriched]);

  let elapsedLabel: string | null = null;
  if (inProgress?.punchIn) {
    const start = new Date(inProgress.punchIn.calculated_time || inProgress.punchIn.timestamp).getTime();
    const diff = Math.max(0, Date.now() - start);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const sec = Math.floor((diff % 60000) / 1000);
    elapsedLabel = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  void tick;

  const shiftForStart = useMemo(() => {
    const nowM = now.getHours() * 60 + now.getMinutes();
    for (const e of enriched) {
      if (e.punchIn) continue;
      const startM = timeToMins(e.shift.start_time);
      // Finestra più ampia per il debug o flessibilità: 2 ore prima o durante il turno
      if (Math.abs(nowM - startM) <= 120 || (nowM >= startM - 60 && nowM <= timeToMins((e.shift.end_time || '23:59').slice(0, 5)) + 60)) {
        return e.shift;
      }
    }
    for (const e of enriched) {
      if (!e.punchIn) return e.shift;
    }
    return null;
  }, [enriched, now]);

  const canStart = !!shiftForStart && !punchBusy;
  const canEnd =
    !!inProgress &&
    !inProgress.actualEnd &&
    !punchBusy;

  const checkGeofence = useCallback(async () => {
    if (featureFlags['geofence_punch'] === false) return true;
    const config = geofenceEffectiveConfig || readGeofenceEnvConfig();
    if (!config) return true;
    try {
      const pos = await getCurrentPositionCoords();
      const { inRange } = isUserInRestaurantRange(pos.lat, pos.lng, config);
      if (!inRange) {
        showError?.(t.punch_error_geofence || 'Sei troppo lontano dal ristorante.');
        return false;
      }
      return true;
    } catch (err) {
      showError?.(t.punch_error_geo_denied || 'Impossibile verificare la posizione.');
      return false;
    }
  }, [featureFlags, geofenceEffectiveConfig, showError, t]);

  const handleStart = useCallback(async () => {
    if (!shiftForStart) return;
    if (featureFlags['maintenance_mode'] === true && user.role !== 'admin') {
      showError?.(t.maintenance_mode_active || 'Sistema in manutenzione.');
      return;
    }
    if (!(await checkGeofence())) return;
    lightHaptic();
    setPunchBusy(true);
    try {
      let presenceProof: string | undefined;
      try {
        presenceProof = (await requestProof(user.id)) || undefined;
      } catch (e) {
        if (e instanceof Error && e.message === 'presence_cancelled') {
          showError?.(t.punch_presence_cancelled);
          return;
        }
        throw e;
      }
      const res = await addPunchRecord(user.id, 'in', {
        shift_id: shiftForStart.id,
        presenceProof,
      });
      if (res && typeof res === 'object' && 'error' in res && res.error) {
        showError?.(res.error);
        return;
      }
      showSuccess?.(t.home_punched);
    } catch {
      showError?.(t.punch_save_error);
    } finally {
      setPunchBusy(false);
    }
  }, [shiftForStart, user.id, addPunchRecord, requestProof, showError, showSuccess, t, checkGeofence]);

  const handleEnd = useCallback(async () => {
    if (!inProgress?.shift) return;
    if (featureFlags['maintenance_mode'] === true && user.role !== 'admin') {
      showError?.(t.maintenance_mode_active || 'Sistema in manutenzione.');
      return;
    }
    if (!(await checkGeofence())) return;
    lightHaptic();
    setPunchBusy(true);
    try {
      let presenceProof: string | undefined;
      try {
        presenceProof = (await requestProof(user.id)) || undefined;
      } catch (e) {
        if (e instanceof Error && e.message === 'presence_cancelled') {
          showError?.(t.punch_presence_cancelled);
          return;
        }
        throw e;
      }
      const res = await addPunchRecord(user.id, 'out', {
        shift_id: inProgress.shift.id,
        presenceProof,
      });
      if (res && typeof res === 'object' && 'error' in res && res.error) {
        showError?.(res.error);
        return;
      }
      showSuccess?.(t.home_toast_exit_registered);
    } catch {
      showError?.(t.punch_save_error);
    } finally {
      setPunchBusy(false);
    }
  }, [inProgress, user.id, addPunchRecord, requestProof, showError, showSuccess, t, checkGeofence]);

  const openDinnerClose = useCallback(() => {
    if (!inProgress?.punchIn || !inProgress.actualStart) return;
    lightHaptic();
    setClockOutInput((inProgress.shift.end_time || '').slice(0, 5));
    setCloseModal({
      shiftId: inProgress.shift.id,
      punchInId: inProgress.punchIn.id,
      plannedEnd: (inProgress.shift.end_time || '').slice(0, 5),
      actualStart: inProgress.actualStart,
    });
  }, [inProgress]);

  const handleConfirmClose = useCallback(async () => {
    if (!closeModal || !clockOutInput) return;
    if (featureFlags['maintenance_mode'] === true && user.role !== 'admin') {
      showError?.(t.maintenance_mode_active || 'Sistema in manutenzione.');
      return;
    }
    if (!(await checkGeofence())) return;
    lightHaptic();
    setClosingLoading(true);
    try {
      const [h, m] = clockOutInput.split(':').map(Number);
      const base = parseISO(todayStr);
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
  }, [closeModal, clockOutInput, todayStr, updatePunchRecord, showSuccess, showError, t, checkGeofence]);

  const statsLabels = {
    title: tv.mobile_dash_numbers ?? 'I miei numeri',
    week: tv.mobile_dash_this_week ?? 'Questa settimana',
    month: tv.mobile_dash_this_month ?? 'Questo mese',
    daysWorked: tv.mobile_dash_days_worked ?? 'Giorni lavorati',
  };

  const shiftTimeHint =
    inProgress && elapsedLabel
      ? `${inProgress.shift.start_time.slice(0, 5)} – ${inProgress.shift.end_time?.slice(0, 5) ?? '…'} · ${inProgress.shift.type === 'lunch' ? t.lunch : t.dinner}`
      : null;

  const tabSpinner = (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <MobileHome
            greetingText={greetingText}
            todayLabel={safeFormatDate(todayStr, 'EEEE d MMMM', { locale })}
            statsLabels={statsLabels}
            weeklyMinutes={weeklyMinutesProp ?? stats.weeklyMinutes}
            monthlyMinutes={monthlyMinutesProp ?? stats.monthlyMinutes}
            monthDaysWorked={monthDaysWorkedProp ?? stats.monthDaysWorked}
            weekCapMinutes={weekCapMinutesProp ?? 40 * 60}
            inProgress={inProgress}
            elapsedLabel={elapsedLabel}
            todayWorkShiftsCount={todayWorkShifts.length}
            noShiftsHint={t.no_shifts_scheduled}
            tapStartHint={tv.mobile_dash_tap_start ?? 'Tocca Inizia per timbrare l’entrata.'}
            shiftTimeHint={shiftTimeHint}
            statusInShift={t.home_status_in_shift}
            todayShiftLabel={t.home_todays_shifts}
            inProgressLabel={t.legend_in_progress}
            nextShiftLabel={t.home_next_shift}
            savingLabel={t.saving}
            startLabel={tv.mobile_dash_start ?? 'Inizia'}
            endLabel={tv.mobile_dash_end ?? 'Fine turno'}
            canStart={canStart}
            canEnd={canEnd}
            punchBusy={punchBusy}
            onStart={() => void handleStart()}
            onEnd={() => void handleEnd()}
            onNavigateToTimesheet={() => onTabChange?.('timesheet')}
            todayWorkShifts={todayWorkShifts}
            detailLabel={t.detail_link}
          />
        );
      case 'turni':
        return (
          <Suspense fallback={tabSpinner}>
            <WeeklyShiftsTable filterUserId={user.id} />
          </Suspense>
        );
      case 'ferie':
        return (
          <Suspense fallback={tabSpinner}>
            <HolidayRequests />
          </Suspense>
        );
      case 'timesheet':
        return (
          <Suspense fallback={tabSpinner}>
            <Timesheets />
          </Suspense>
        );
      case 'reports':
        return (
          <Suspense fallback={tabSpinner}>
            <Statistics />
          </Suspense>
        );
      case 'profile':
        return <ProfileNavTabPanel onLogout={() => {}} />;
      case 'settings':
        return (
          <Suspense fallback={tabSpinner}>
            <SettingsPage />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-0 flex-col font-sans">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>

      {presenceModal}

      <AnimatePresence>
        {closeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setCloseModal(null);
                setClockOutInput('');
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="modal-glass-panel w-full max-w-sm rounded-2xl p-6"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-neutral-100 tracking-tight">
                    <Moon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    {t.home_modal_close_dinner}
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-500 dark:text-neutral-400">
                    {safeFormatDate(todayStr, 'd MMM', { locale })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCloseModal(null);
                    setClockOutInput('');
                  }}
                  className="rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-neutral-800"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-neutral-300">
                {t.home_label_exit_time}
              </label>
              <TimeInputField
                size="hero"
                value={clockOutInput}
                onChange={setClockOutInput}
                aria-label={t.home_label_exit_time}
                className="w-full tabular-nums"
                autoFocus
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCloseModal(null);
                    setClockOutInput('');
                  }}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 dark:border-white/10 dark:text-neutral-300"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  disabled={!/^\d{2}:\d{2}$/.test((clockOutInput || '').trim()) || closingLoading}
                  onClick={() => void handleConfirmClose()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {closingLoading ? t.saving : (
                    <>
                      <LogOut className="h-4 w-4" />
                      {t.home_btn_register}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
