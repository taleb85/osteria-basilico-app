import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Moon, Play, Square, UtensilsCrossed, X } from 'lucide-react';
import type { User, Shift, PunchRecord, Language } from '../../types';
import { useApp } from '../../context/AppContext';
import { getTranslations, getDateLocale } from '../../utils/translations';
import { usePunchPresenceVerification } from '../../hooks/usePunchPresenceVerification';
import { TimeInputField } from '../ui/TimeInputField';
import { safeFormatDate } from '../../utils/safeDateFormat';
import type { AppNavTab } from '../../utils/enabledModules';
import MobileStatsCards from './MobileStatsCards';
import MobileBottomNav from './MobileBottomNav';

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
  weeklyMinutes: number;
  monthlyMinutes: number;
  monthDaysWorked: number;
  weekCapMinutes: number;
  visibleNavTabs: AppNavTab[];
  onTabChange?: (tab: AppNavTab) => void;
  greetingText: string;
  /** Se true, mostra la barra icone fissa (la BottomNav globale va nascosta su mobile da App). */
  showMobileBottomNav?: boolean;
  activeTab: AppNavTab;
}

export default function MobileStaffDashboard({
  user,
  language,
  todayStr,
  now,
  myShifts,
  punchRecords,
  weeklyMinutes,
  monthlyMinutes,
  monthDaysWorked,
  weekCapMinutes,
  visibleNavTabs,
  onTabChange,
  greetingText,
  showMobileBottomNav = true,
  activeTab,
}: MobileStaffDashboardProps) {
  const t = getTranslations(language);
  const tv = t as Record<string, string>;
  const locale = getDateLocale(language);
  const { addPunchRecord, updatePunchRecord, showError, showSuccess } = useApp();
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

  const todayWorkShifts = useMemo(
    () =>
      myShifts
        .filter(
          (s) =>
            s.date === todayStr &&
            (s.approval_status === 'confirmed' || s.approval_status === 'approved') &&
            s.approval_status !== 'absent'
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

  const WINDOW_MIN = 60;
  const nowM = now.getHours() * 60 + now.getMinutes();

  const shiftForStart = useMemo(() => {
    for (const e of enriched) {
      if (e.punchIn) continue;
      const startM = timeToMins(e.shift.start_time);
      if (Math.abs(nowM - startM) <= WINDOW_MIN || (nowM >= startM - 30 && nowM <= timeToMins((e.shift.end_time || '23:59').slice(0, 5)) + 30)) {
        return e.shift;
      }
    }
    for (const e of enriched) {
      if (!e.punchIn) return e.shift;
    }
    return null;
  }, [enriched, nowM]);

  const canStart = !!shiftForStart && !punchBusy;
  const canPause =
    !!inProgress &&
    inProgress.shift.type === 'lunch' &&
    !inProgress.actualEnd &&
    !punchBusy;
  const canEndDinner =
    !!inProgress &&
    (inProgress.shift.type === 'dinner' || timeToMins(inProgress.shift.start_time) >= 16 * 60) &&
    !inProgress.actualEnd &&
    !punchBusy;

  const handleStart = useCallback(async () => {
    if (!shiftForStart) return;
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
  }, [shiftForStart, user.id, addPunchRecord, requestProof, showError, showSuccess, t]);

  const handlePauseOut = useCallback(async () => {
    if (!inProgress?.shift || inProgress.shift.type !== 'lunch') return;
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
      showSuccess?.(tv.mobile_dash_pause_done ?? 'Pausa registrata.');
    } catch {
      showError?.(t.punch_save_error);
    } finally {
      setPunchBusy(false);
    }
  }, [inProgress, user.id, addPunchRecord, requestProof, showError, showSuccess, t, tv.mobile_dash_pause_done]);

  const openDinnerClose = useCallback(() => {
    if (!inProgress?.punchIn || !inProgress.actualStart) return;
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
  }, [closeModal, clockOutInput, todayStr, updatePunchRecord, showSuccess, showError, t]);

  const statsLabels = {
    title: tv.mobile_dash_numbers ?? 'I miei numeri',
    week: tv.mobile_dash_this_week ?? 'Questa settimana',
    month: tv.mobile_dash_this_month ?? 'Questo mese',
    daysWorked: tv.mobile_dash_days_worked ?? 'Giorni lavorati',
  };

  const navLabels = {
    home: t.sidebar_dashboard,
    calendar: t.sidebar_shifts,
    coffee: tv.mobile_nav_break ?? t.sidebar_holidays,
    profile: (tv.bottom_nav_profile_short ?? t.sidebar_profile) as string,
  };

  return (
    <div className="flex min-h-0 flex-col gap-4 pb-4 font-sans">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100">{greetingText}</h1>
        <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-neutral-400">
          {safeFormatDate(todayStr, 'EEEE d MMMM', { locale })}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">
          {statsLabels.title}
        </p>
        <MobileStatsCards
          weekWorkedMins={weeklyMinutes}
          weekCapMins={weekCapMinutes}
          monthWorkedMins={monthlyMinutes}
          monthDaysWorked={monthDaysWorked}
          labels={statsLabels}
        />
      </div>

      <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-4 shadow-xl dark:border-white/10 dark:bg-neutral-900/95 dark:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.45)]">
        {inProgress && elapsedLabel ? (
          <div className="mb-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
              {t.home_status_in_shift}
            </p>
            <p className="mt-1 font-mono text-5xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
              {elapsedLabel}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              {inProgress.shift.start_time.slice(0, 5)} – {inProgress.shift.end_time?.slice(0, 5) ?? '…'} ·{' '}
              {inProgress.shift.type === 'lunch' ? t.lunch : t.dinner}
            </p>
          </div>
        ) : (
          <p className="mb-3 text-center text-sm font-medium text-slate-600 dark:text-neutral-300">
            {todayWorkShifts.length === 0 ? t.no_shifts_scheduled : tv.mobile_dash_tap_start ?? 'Tocca Inizia per timbrare l’entrata.'}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            disabled={!canStart}
            onClick={() => void handleStart()}
            className="flex h-24 flex-col items-center justify-center gap-1 rounded-3xl bg-[#2D5A27] text-white shadow-lg shadow-[#2D5A27]/35 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#3d7a34] dark:shadow-black/30"
          >
            <Play className="h-8 w-8 opacity-95" strokeWidth={2.2} fill="currentColor" />
            <span className="text-sm font-bold">{tv.mobile_dash_start ?? 'Inizia'}</span>
          </button>

          <button
            type="button"
            disabled={!canPause}
            onClick={() => void handlePauseOut()}
            className="flex h-24 flex-col items-center justify-center gap-1 rounded-3xl bg-amber-400 text-amber-950 shadow-lg shadow-amber-500/30 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-amber-500 dark:text-amber-950"
          >
            <UtensilsCrossed className="h-8 w-8" strokeWidth={2.2} />
            <span className="text-sm font-bold">{tv.mobile_dash_pause ?? 'Pausa'}</span>
          </button>

          <button
            type="button"
            disabled={!canEndDinner}
            onClick={openDinnerClose}
            className="flex h-24 flex-col items-center justify-center gap-1 rounded-3xl bg-red-600 text-white shadow-lg shadow-red-600/35 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-red-700"
          >
            <Square className="h-8 w-8" strokeWidth={2.2} />
            <span className="text-sm font-bold">{tv.mobile_dash_end ?? 'Fine turno'}</span>
          </button>
        </div>
        {punchBusy && (
          <p className="mt-2 text-center text-[11px] font-semibold text-slate-500 dark:text-neutral-400">{t.saving}</p>
        )}
      </div>

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
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-neutral-100">
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

      {showMobileBottomNav && onTabChange && (
        <MobileBottomNav
          activeTab={activeTab}
          onNavigate={onTabChange}
          visibleTabs={visibleNavTabs}
          labels={navLabels}
        />
      )}
    </div>
  );
}
