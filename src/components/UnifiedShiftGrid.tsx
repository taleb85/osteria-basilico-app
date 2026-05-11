import { useState } from 'react';
import { Calendar, Clock, BarChart3, AlertTriangle, Check, Lock } from 'lucide-react';
import type { Shift, PunchRecord } from '../types';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { getTranslations, getDateLocale } from '../utils/translations';
import { formatMinutesToHoursAndMinutes, calculateShiftMinutesGross } from '../utils/timeCalculations';
import { shiftPastPlannedEndWithoutClockIn } from '../utils/shiftResolvedClockTimes';
import { useApp } from '../context/AppContext';

export type GridMode = 'planning' | 'realtime' | 'comparison';

interface UnifiedShiftGridProps {
  mode: GridMode;
  onModeChange: (mode: GridMode) => void;
  filterUserId?: string;
}

interface DayShiftGroup {
  shift: Shift;
  punchIn?: PunchRecord;
  punchOut?: PunchRecord;
  actualMinutes: number;
  deltaMinutes: number;
  hasViolation: boolean;
  isAbsent: boolean;
  isMissingPunch: boolean;
}

export default function UnifiedShiftGrid({ mode, onModeChange, filterUserId }: UnifiedShiftGridProps) {
  const t = useT();
  const {
    currentUser, users, shifts, punchRecords, breakRules, effectiveLanguage,
    showError, showSuccess, featureFlags,
  } = useApp();
  const locale = getDateLocale(effectiveLanguage) ?? it;

  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const prevWeek = () => setWeekStart(d => addDays(d, -7));
  const nextWeek = () => setWeekStart(d => addDays(d, 7));
  const goToday = () => setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));

  const visibleUsers = filterUserId
    ? users.filter(u => u.id === filterUserId)
    : users.filter(u => u.status === 'active');

  const weekDateStrings = weekDays.map(d => format(d, 'yyyy-MM-dd'));

  const weekPunchRecords = punchRecords.filter(pr =>
    weekDateStrings.some(ds => pr.timestamp?.startsWith(ds))
  );

  const weekShifts = shifts.filter(s =>
    weekDateStrings.includes(s.date) &&
    (!filterUserId || s.user_id === filterUserId)
  );

  const MODES: { key: GridMode; icon: ReactNode; label: string }[] = [
    { key: 'planning', icon: <Calendar className="h-3.5 w-3.5" />, label: t.unified_planning ?? 'Planning' },
    { key: 'realtime', icon: <Clock className="h-3.5 w-3.5" />, label: t.unified_realtime ?? 'Real-time' },
    { key: 'comparison', icon: <BarChart3 className="h-3.5 w-3.5" />, label: t.unified_comparison ?? 'Confronto' },
  ];

  const isComparison = mode === 'comparison';
  const isRealtime = mode === 'realtime';
  const isPlanning = mode === 'planning';

  const punchMap = new Map<string, PunchRecord[]>();
  weekPunchRecords.forEach(pr => {
    const key = `${pr.user_id}_${pr.shift_id ?? ''}_${pr.timestamp?.slice(0, 10)}`;
    const existing = punchMap.get(key) ?? [];
    existing.push(pr);
    punchMap.set(key, existing);
  });

  function getPunchForShift(shift: Shift): { in?: PunchRecord; out?: PunchRecord } {
    const shiftPunches = weekPunchRecords.filter(
      pr => pr.shift_id === shift.id || (pr.user_id === shift.user_id && pr.timestamp?.startsWith(shift.date))
    );
    const sorted = [...shiftPunches].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return { in: sorted.find(p => p.type === 'in'), out: sorted.findLast(p => p.type === 'out') };
  }

  function getDayGroup(userId: string, dateStr: string): DayShiftGroup[] {
    const dayShifts = weekShifts.filter(s => s.user_id === userId && s.date === dateStr);
    return dayShifts.map(shift => {
      const { in: punchIn, out: punchOut } = getPunchForShift(shift);
      const plannedMins = calculateShiftMinutesGross(shift.start_time ?? '', shift.end_time ?? '');
      const actualMins = punchIn && punchOut
        ? (new Date(punchOut.timestamp).getTime() - new Date(punchIn.timestamp).getTime()) / 60000
        : 0;
      return {
        shift,
        punchIn,
        punchOut,
        actualMinutes: Math.round(actualMins),
        deltaMinutes: Math.round(actualMins - plannedMins),
        hasViolation: false,
        isAbsent: shift.approval_status === 'absent',
        isMissingPunch: !punchIn && shiftPastPlannedEndWithoutClockIn(shift, punchRecords),
      };
    });
  }

  return (
    <div className="w-full font-sans">
      {/* Header with mode tabs */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
          {MODES.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => onModeChange(m.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                mode === m.key ? 'bg-accent text-white shadow-lg shadow-accent/25' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevWeek} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-white/70 hover:text-white transition-colors text-sm font-bold">&larr;</button>
          <button type="button" onClick={goToday} className="rounded-lg bg-white/10 px-3 py-1.5 text-white/70 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider">Oggi</button>
          <button type="button" onClick={nextWeek} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-white/70 hover:text-white transition-colors text-sm font-bold">&rarr;</button>
          <span className="text-sm font-semibold text-white/60 min-w-[180px] text-center">
            {format(weekStart, 'd MMM', { locale })} — {format(weekEnd, 'd MMM yyyy', { locale })}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-white/10" style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
        <table className="w-full min-w-[720px] table-fixed border-collapse">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 bg-[#0a1628] text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/50 border-b border-white/10" style={{ width: 160, minWidth: 160 }}>
                {t.employee ?? 'Dipendente'}
              </th>
              {weekDays.map((day, i) => (
                <th key={i} className={`px-2 py-2.5 text-center border-b border-white/10 ${
                  isToday(day) ? 'bg-accent/10' : 'bg-[#0a1628]'
                }`} style={{ width: 130, minWidth: 110 }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">{format(day, 'EEE', { locale })}</div>
                  <div className={`text-sm font-black ${isToday(day) ? 'text-accent' : 'text-white/80'}`}>{format(day, 'd')}</div>
                </th>
              ))}
              {(isRealtime || isComparison) && (
                <th className="px-2 py-2.5 text-center border-b border-white/10 bg-[#0a1628]" style={{ width: 100, minWidth: 90 }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/40">{t.total_hours ?? 'Ore'}</div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((user, uIdx) => {
              const totalPlanned = weekDateStrings.reduce((acc, ds) => {
                const groups = getDayGroup(user.id, ds);
                return acc + groups.reduce((s, g) => s + calculateShiftMinutesGross(g.shift.start_time ?? '', g.shift.end_time ?? ''), 0);
              }, 0);
              const totalActual = weekDateStrings.reduce((acc, ds) => {
                const groups = getDayGroup(user.id, ds);
                return acc + groups.reduce((s, g) => s + g.actualMinutes, 0);
              }, 0);

              return (
                <tr key={user.id} className={uIdx % 2 === 0 ? 'bg-white/[0.03]' : ''}>
                  <td className="sticky left-0 z-10 bg-[#0d1b2a] px-3 py-2 border-b border-white/5" style={{ width: 160, minWidth: 160 }}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">
                        {user.first_name} {user.last_name?.[0] ?? ''}
                      </span>
                    </div>
                    {(isRealtime || isComparison) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-semibold text-white/40 tabular-nums">
                          {formatMinutesToHoursAndMinutes(totalPlanned)}P
                        </span>
                        <span className="text-[10px] font-semibold text-white/40">/</span>
                        <span className={`text-[10px] font-bold tabular-nums ${
                          totalActual > totalPlanned ? 'text-accent' : 'text-emerald-400'
                        }`}>
                          {formatMinutesToHoursAndMinutes(totalActual)}E
                        </span>
                      </div>
                    )}
                  </td>
                  {weekDays.map((day, dIdx) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const groups = getDayGroup(user.id, dateStr);
                    const todayFlag = isToday(day);

                    return (
                      <td key={dIdx} className={`px-1.5 py-1 border-b border-white/5 align-top ${
                        todayFlag ? 'bg-accent/[0.04]' : ''
                      }`}>
                        {groups.length === 0 ? (
                          <div className="flex items-center justify-center h-full min-h-[48px]">
                            <span className="text-[10px] text-white/20 font-medium">&mdash;</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {groups.map((g, gIdx) => {
                              const isDraft = g.shift.approval_status === 'draft';
                              const isApproved = g.shift.approval_status === 'approved' && g.shift.approved_at;
                              const isConfirmed = g.shift.approval_status === 'confirmed';

                              let borderColor = 'border-l-cyan-400/70';
                              let bgColor = 'bg-white/[0.06]';
                              if (isDraft) { borderColor = 'border-l-blue-500/50'; bgColor = 'bg-white/[0.03]'; }
                              if (isApproved) { borderColor = 'border-l-emerald-400'; bgColor = 'bg-emerald-500/10'; }
                              if (g.isAbsent) { borderColor = 'border-l-rose-400/60'; bgColor = 'bg-rose-500/10'; }
                              if (g.isMissingPunch) { borderColor = 'border-l-amber-400'; bgColor = 'bg-amber-500/10'; }

                              return (
                                <div
                                  key={gIdx}
                                  className={`rounded-lg border-l-[3px] ${borderColor} ${bgColor} px-2 py-1.5 ${
                                    isDraft ? 'border-dashed opacity-60' : ''
                                  }`}
                                >
                                  {/* Shift time */}
                                  <div className="flex items-center justify-between gap-1">
                                    <span className={`text-[11px] font-bold tabular-nums ${
                                      g.isAbsent ? 'text-rose-400 line-through' : 'text-white'
                                    }`}>
                                      {g.shift.start_time?.slice(0, 5)}-{g.shift.end_time?.slice(0, 5)}
                                    </span>
                                    <div className="flex items-center gap-0.5">
                                      {isApproved && <Lock className="h-2.5 w-2.5 text-emerald-400" />}
                                      {isConfirmed && <Check className="h-2.5 w-2.5 text-cyan-300" />}
                                      {g.isMissingPunch && <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />}
                                    </div>
                                  </div>

                                  {/* Real-time / Comparison data */}
                                  {(isRealtime || isComparison) && g.punchIn && (
                                    <div className="flex items-center justify-between mt-0.5">
                                      <span className="text-[10px] font-medium text-white/50 tabular-nums">
                                        {g.punchIn.timestamp?.slice(11, 16)}
                                        {g.punchOut ? `-${g.punchOut.timestamp?.slice(11, 16)}` : ' →'}
                                      </span>
                                      {isComparison && g.punchOut && (
                                        <span className={`text-[9px] font-bold tabular-nums ${
                                          g.deltaMinutes > 15 ? 'text-accent' : g.deltaMinutes < -15 ? 'text-rose-400' : 'text-emerald-400'
                                        }`}>
                                          {g.deltaMinutes > 0 ? '+' : ''}{g.deltaMinutes}'
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* No punch warning */}
                                  {isRealtime && !g.punchIn && !g.isAbsent && (
                                    <div className="mt-0.5 text-[9px] font-bold text-amber-400/80 uppercase tracking-wider">
                                      No entry
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {(isRealtime || isComparison) && (
                    <td className="px-2 py-1 border-b border-white/5 text-center align-middle">
                      <div className="text-xs font-bold text-white tabular-nums">{formatMinutesToHoursAndMinutes(totalActual)}</div>
                      {isComparison && (
                        <div className={`text-[10px] font-bold tabular-nums ${
                          totalActual > totalPlanned ? 'text-accent' : 'text-emerald-400'
                        }`}>
                          {totalActual > totalPlanned ? '+' : ''}{totalActual - totalPlanned}'
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-white/40">
        <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-dashed border-blue-500/60" /> Draft</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-solid border-cyan-400/60" /> Published</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-solid border-emerald-400/60" /> Approved</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0 border-t-2 border-solid border-amber-400/60" /> Missing punch</span>
        <AlertTriangle className="h-3 w-3 text-amber-400/60" /> Conflict
      </div>
    </div>
  );
}

function useT() {
  const { effectiveLanguage } = useApp();
  return getTranslations(effectiveLanguage);
}
