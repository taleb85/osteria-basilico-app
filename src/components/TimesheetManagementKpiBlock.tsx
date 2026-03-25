import { useMemo, useState } from 'react';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, TrendingUp, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Language } from '../types';
import { getTranslations } from '../utils/translations';
import { formatMinutesToHoursAndMinutes } from '../utils/timeCalculations';
import { getNetShiftMinutes } from '../utils/breakRules';
import { getResolvedStartEndForHours } from '../utils/shiftResolvedClockTimes';
import { isFeatureEnabled } from '../utils/enabledFeatures';

function formatEurAmount(amount: number, lang: Language): string {
  const loc = lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : lang === 'fr' ? 'fr-FR' : 'it-IT';
  return new Intl.NumberFormat(loc, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

type Props = {
  visibleWeekDays: Date[];
  showDetailPanels: boolean;
};

/**
 * Riepilogo ore approvate / costo / turni in attesa nel periodo visibile in Presenze (settimana o periodo in vista mese).
 * Stessa logica che era in Ore; i pannelli espandibili sono opzionali (`stats.detail_panels`).
 */
export default function TimesheetManagementKpiBlock({ visibleWeekDays, showDetailPanels }: Props) {
  const { users, shifts, currentUser, effectiveLanguage, breakRules, featureFlags, punchRecords } = useApp();
  const t = getTranslations(effectiveLanguage);
  const tv = t as Record<string, string>;
  const [activeWidget, setActiveWidget] = useState<'approved' | 'pending' | null>(null);

  const breakComputeOpts = useMemo(
    () => ({ autoBreaksFeatureEnabled: featureFlags['auto_breaks'] !== false }),
    [featureFlags]
  );

  const showEstimatedCostWidget =
    !!currentUser && isFeatureEnabled(currentUser, 'view_estimated_cost');

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (visibleWeekDays.length === 0) {
      const n = new Date();
      return { rangeStart: startOfDay(n), rangeEnd: endOfDay(n) };
    }
    const first = visibleWeekDays[0]!;
    const last = visibleWeekDays[visibleWeekDays.length - 1]!;
    return { rangeStart: startOfDay(first), rangeEnd: endOfDay(last) };
  }, [visibleWeekDays]);

  const approvedMins = useMemo(() => {
    return shifts
      .filter(
        (s) =>
          s.approval_status === 'approved' &&
          isWithinInterval(new Date(s.date), { start: rangeStart, end: rangeEnd })
      )
      .reduce((sum, s) => {
        const { start, end } = getResolvedStartEndForHours(s, punchRecords);
        if (!start || !end || start === end) return sum;
        const u = users.find((x) => x.id === s.user_id);
        return sum + getNetShiftMinutes(s, start, end, u ?? undefined, breakRules, breakComputeOpts);
      }, 0);
  }, [shifts, punchRecords, rangeStart, rangeEnd, users, breakRules, breakComputeOpts]);

  const pendingShifts = useMemo(() => {
    return shifts
      .filter(
        (s) =>
          s.approval_status === 'confirmed' &&
          isWithinInterval(new Date(s.date), { start: rangeStart, end: rangeEnd })
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [shifts, rangeStart, rangeEnd]);
  const pendingCount = pendingShifts.length;

  const approvedShifts = useMemo(() => {
    return shifts
      .filter(
        (s) =>
          s.approval_status === 'approved' &&
          isWithinInterval(new Date(s.date), { start: rangeStart, end: rangeEnd })
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [shifts, rangeStart, rangeEnd]);

  const estimatedCostStats = useMemo(() => {
    let totalEur = 0;
    let shiftsWithRate = 0;
    let shiftsWithoutRate = 0;
    for (const s of approvedShifts) {
      const { start, end } = getResolvedStartEndForHours(s, punchRecords);
      if (!start || !end || start === end) continue;
      const u = users.find((x) => x.id === s.user_id);
      if (!u || u.status !== 'active') continue;
      const mins = getNetShiftMinutes(s, start, end, u ?? undefined, breakRules, breakComputeOpts);
      const raw = u?.hourly_rate_eur;
      const rate = typeof raw === 'string' ? parseFloat(raw) : raw;
      if (rate != null && Number.isFinite(rate) && rate >= 0) {
        totalEur += (mins / 60) * rate;
        shiftsWithRate += 1;
      } else {
        shiftsWithoutRate += 1;
      }
    }
    return { totalEur, shiftsWithRate, shiftsWithoutRate };
  }, [approvedShifts, punchRecords, users, breakRules, breakComputeOpts]);

  if (!currentUser) return null;

  return (
    <>
      <div
        className={`grid grid-cols-1 gap-2 mb-3 sm:gap-2.5 ${showEstimatedCostWidget ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
      >
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onClick={() => setActiveWidget(activeWidget === 'approved' ? null : 'approved')}
          className={`surface-glass surface-ghost-interactive flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all sm:gap-3 sm:py-2 ${
            activeWidget === 'approved'
              ? 'border-accent ring-2 ring-accent/20 dark:border-accent dark:ring-accent/30'
              : 'hover:border-accent/40 dark:hover:border-accent/50'
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 dark:bg-accent/20">
            <CheckCircle2 className="h-4 w-4 text-accent dark:text-accent-light" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{t.stats_approved_hours}</p>
            <p className="text-lg font-bold leading-tight text-slate-900 dark:text-neutral-100 sm:text-xl">
              {approvedMins > 0 ? formatMinutesToHoursAndMinutes(approvedMins) : '—'}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-neutral-400 sm:text-[11px]">{t.stats_approved_shifts_count.replace('{n}', String(approvedShifts.length))}</p>
          </div>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform dark:text-neutral-500 ${activeWidget === 'approved' ? 'rotate-180 text-accent dark:text-accent-light' : ''}`}
          />
        </motion.button>

        {showEstimatedCostWidget && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`flex items-center gap-2.5 rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 shadow-none dark:border-white/10 dark:bg-transparent sm:gap-3 sm:py-2 ${
              estimatedCostStats.shiftsWithRate === 0 ? 'opacity-75' : ''
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 ring-1 ring-inset ring-violet-200/80 dark:bg-violet-950/50 dark:ring-violet-700/40">
              <TrendingUp className="h-4 w-4 text-violet-500 dark:text-violet-300" />
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{t.stats_estimated_cost}</p>
              {estimatedCostStats.shiftsWithRate + estimatedCostStats.shiftsWithoutRate === 0 ? (
                <>
                  <p className="text-lg font-bold leading-tight text-slate-400 dark:text-neutral-400 sm:text-xl">—</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-neutral-400 sm:text-[11px]">
                    {tv.stats_no_approved_for_cost ?? t.stats_no_approved_shifts}
                  </p>
                </>
              ) : estimatedCostStats.shiftsWithRate === 0 ? (
                <>
                  <p className="text-lg font-bold leading-tight text-slate-400 dark:text-neutral-400 sm:text-xl">—</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-neutral-400 sm:text-[11px]">
                    {tv.stats_hourly_rate_not_set ?? t.stats_base_salary_not_set}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold leading-tight text-slate-900 tabular-nums dark:text-neutral-100 sm:text-xl">
                    {formatEurAmount(estimatedCostStats.totalEur, effectiveLanguage)}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-neutral-400 sm:text-[11px]">
                    {estimatedCostStats.shiftsWithoutRate > 0
                      ? tv.stats_partial_hourly_rates?.replace('{n}', String(estimatedCostStats.shiftsWithoutRate)) ??
                        `${estimatedCostStats.shiftsWithoutRate} turni senza tariffa`
                      : tv.stats_cost_from_rates ?? ''}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => {
            if (pendingCount > 0) {
              window.dispatchEvent(
                new CustomEvent('osteria-navigate', {
                  detail: { tab: 'timesheet', anchor: 'timesheet-section-main-grid' },
                })
              );
            } else {
              setActiveWidget(activeWidget === 'pending' ? null : 'pending');
            }
          }}
          className={`surface-glass surface-ghost-interactive flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all sm:gap-3 sm:py-2 ${
            activeWidget === 'pending' && pendingCount === 0
              ? 'border-amber-400 ring-2 ring-amber-200 dark:border-amber-500 dark:ring-amber-900/50'
              : pendingCount > 0
                ? 'border-amber-200 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-600'
                : 'hover:border-slate-300 dark:hover:border-white/20'
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
              pendingCount > 0
                ? 'bg-amber-50 ring-amber-200/80 dark:bg-amber-950/45 dark:ring-amber-800/40'
                : 'bg-slate-50 ring-slate-200/80 dark:bg-neutral-800 dark:ring-white/10'
            }`}
          >
            <AlertCircle
              className={`h-4 w-4 ${pendingCount > 0 ? 'text-amber-500 dark:text-amber-300' : 'text-slate-400 dark:text-neutral-400'}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{t.stats_pending_shifts}</p>
            <p
              className={`text-lg font-bold leading-tight sm:text-xl ${pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-neutral-100'}`}
            >
              {pendingCount}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-neutral-400 sm:text-[11px]">{t.stats_confirmed_not_approved}</p>
          </div>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform dark:text-neutral-500 ${
              activeWidget === 'pending' && pendingCount === 0 ? 'rotate-180 text-amber-500 dark:text-amber-400' : ''
            }`}
          />
        </motion.button>
      </div>

      {showDetailPanels && (
        <AnimatePresence>
          {activeWidget === 'approved' && (
            <motion.div
              key="approved-panel-ts"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-4"
            >
              <div className="bg-accent/5 dark:bg-accent/15 border border-accent/20 dark:border-accent/35 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-accent/10 dark:border-accent/25">
                  <CheckCircle2 className="w-4 h-4 text-accent dark:text-accent-light" />
                  <span className="text-sm font-semibold text-accent-dark dark:text-accent-light">{t.stats_approved_shifts_in_period}</span>
                  <span className="ml-auto text-xs text-accent-dark dark:text-accent-light bg-accent/10 dark:bg-accent/25 px-2 py-0.5 rounded-full font-bold">
                    {approvedShifts.length}
                  </span>
                </div>
                {approvedShifts.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-400 dark:text-neutral-400 text-center">{t.stats_no_approved_shifts}</p>
                ) : (
                  <div className="divide-y divide-accent/10 dark:divide-accent/20 max-h-[320px] overflow-y-auto">
                    {approvedShifts.map((s) => {
                      const u = users.find((x) => x.id === s.user_id);
                      const { start: rs, end: re } = getResolvedStartEndForHours(s, punchRecords);
                      const mins = getNetShiftMinutes(s, rs, re, u ?? undefined, breakRules, breakComputeOpts);
                      const ps = (s.start_time || '').slice(0, 5);
                      const pe = (s.end_time || '').slice(0, 5);
                      return (
                        <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/5 dark:hover:bg-accent/10 transition-colors">
                          <div className="w-7 h-7 rounded-full bg-accent/15 dark:bg-accent/25 flex items-center justify-center flex-shrink-0">
                            <span className="text-[11px] font-bold text-accent dark:text-accent-light">{(u?.first_name?.[0] ?? '?').toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-neutral-100 truncate">
                              {u?.first_name ?? '—'} {u?.last_name ?? ''}
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-neutral-400">
                              {format(new Date(s.date), 'EEE d MMM', { locale: it })} · {rs} – {re}
                              {s.approved_at && (rs !== ps || re !== pe) ? (
                                <span className="text-slate-400 dark:text-neutral-400">
                                  {' '}
                                  ({t.stats_planned_abbr} {ps}–{pe})
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-accent dark:text-accent-light tabular-nums">{formatMinutesToHoursAndMinutes(mins)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeWidget === 'pending' && (
            <motion.div
              key="pending-panel-ts"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-4"
            >
              <div className="bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/50 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-100 dark:border-amber-800/40">
                  <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">{t.stats_shifts_awaiting_approval}</span>
                  <span className="ml-auto text-xs text-amber-700 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full font-bold border border-amber-200 dark:border-amber-800/50">
                    {pendingCount}
                  </span>
                </div>
                {pendingShifts.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-slate-400 dark:text-neutral-400 text-center">{t.stats_no_pending_shifts}</p>
                ) : (
                  <div className="divide-y divide-amber-100 dark:divide-amber-900/40 max-h-[320px] overflow-y-auto">
                    {pendingShifts.map((s) => {
                      const u = users.find((x) => x.id === s.user_id);
                      const mins = getNetShiftMinutes(
                        s,
                        (s.start_time || '').slice(0, 5),
                        (s.end_time || '').slice(0, 5),
                        u ?? undefined,
                        breakRules,
                        breakComputeOpts
                      );
                      return (
                        <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50/80 dark:hover:bg-amber-950/40 transition-colors">
                          <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950/55 flex items-center justify-center flex-shrink-0 ring-1 ring-amber-200/60 dark:ring-amber-800/40">
                            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">{(u?.first_name?.[0] ?? '?').toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-neutral-100 truncate">
                              {u?.first_name ?? '—'} {u?.last_name ?? ''}
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-neutral-400">
                              {format(new Date(s.date), 'EEE d MMM', { locale: it })} · {(s.start_time || '').slice(0, 5)} –{' '}
                              {(s.end_time || '').slice(0, 5)}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatMinutesToHoursAndMinutes(mins)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </>
  );
}
