import { useState, useMemo, useCallback } from 'react';
import {
  format, startOfWeek, endOfWeek, isSameWeek,
  eachDayOfInterval, isToday, parseISO,
  addWeeks, startOfDay, endOfDay, isWithinInterval, getISOWeek,
} from 'date-fns';
import { it, es, enUS } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import type { Shift, User } from '../../types';
import { translateDepartmentValue } from '../../utils/departmentLabels';
import { getTranslations } from '../../utils/translations';
import {
  loadPeriodConfig, getPeriodDateRange,
  prevPeriodConfig, nextPeriodConfig, type PeriodConfig,
} from '../../utils/periodConfig';

interface Props {
  shifts: Shift[];
  users: User[];
  currentUserId: string;
  language: string;
}

type NavMode = 'week' | 'period';

function getLocale(lang: string) {
  if (lang === 'es') return es;
  if (lang === 'en') return enUS;
  return it;
}

function getDayLetters(locale: typeof it): string[] {
  const base = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return format(d, 'EEEEE', { locale }).toUpperCase();
  });
}

function shiftMins(s: Shift): number {
  if (!s.start_time || !s.end_time || s.approval_status === 'absent') return 0;
  const [sh, sm] = s.start_time.split(':').map(Number);
  const [eh, em] = s.end_time.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function minsLabel(m: number): string {
  if (m <= 0) return '—';
  return m % 60 > 0 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 60)}h`;
}

function groupByWeeks(list: Shift[]) {
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
  const map: { start: Date; end: Date; shifts: Shift[] }[] = [];
  sorted.forEach(s => {
    const d = parseISO(s.date);
    const start = startOfWeek(d, { weekStartsOn: 1 });
    const end = endOfWeek(d, { weekStartsOn: 1 });
    let week = map.find(w => isSameWeek(w.start, start, { weekStartsOn: 1 }));
    if (!week) { week = { start, end, shifts: [] }; map.push(week); }
    week.shifts.push(s);
  });
  return map;
}

function StatusBadge({ shift, t }: { shift: Shift; t: Record<string, string> }) {
  const isAbsent = shift.approval_status === 'absent';
  const isDraft  = shift.approval_status === 'draft';
  const cls = isAbsent
    ? 'text-red-500 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-500/20 dark:bg-red-500/[0.08]'
    : isDraft
      ? 'text-slate-400 border-slate-200 bg-slate-50 dark:text-white/35 dark:border-white/10 dark:bg-white/[0.04]'
      : 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/20 dark:bg-emerald-500/[0.08]';
  const label = isAbsent
    ? (t.status_absent ?? 'Assente')
    : isDraft
      ? (t.status_draft ?? 'Bozza')
      : (t.shifts_confirmed ?? 'Confermato');
  return (
    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0 ${cls}`}>
      {label}
    </span>
  );
}

/* ── Sezione: turni personali ──────────────────────────────────────────── */
function MyShiftsSection({
  myShifts, locale, dayLetters, language, t,
}: {
  myShifts: Shift[];
  locale: typeof it;
  dayLetters: string[];
  language: string;
  t: Record<string, string>;
}) {
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const weeks = useMemo(() => groupByWeeks(myShifts), [myShifts]);

  if (myShifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <Calendar className="w-6 h-6 text-slate-300 dark:text-white/20 mb-2" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/25">
          Nessun turno
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {weeks.map((week, wIdx) => {
        const weekDays = eachDayOfInterval({ start: week.start, end: week.end });
        const byDay: Record<string, Shift[]> = {};
        week.shifts.forEach(s => {
          const k = format(parseISO(s.date), 'yyyy-MM-dd');
          if (!byDay[k]) byDay[k] = [];
          byDay[k].push(s);
        });
        // ordina ogni giorno per orario di inizio (pranzo → cena)
        Object.keys(byDay).forEach(k => {
          byDay[k].sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
        });
        const totalMins = week.shifts.reduce((acc, s) => acc + shiftMins(s), 0);
        const confirmed = week.shifts.filter(s => s.approval_status !== 'absent');
        const restDays = weekDays.filter(d =>
          !(byDay[format(d, 'yyyy-MM-dd')] ?? []).some(s => s.approval_status !== 'absent')
        ).length;

        const isDayInThisWeek = selectedDayKey !== null && weekDays.some(d => format(d, 'yyyy-MM-dd') === selectedDayKey);

        return (
          <div key={wIdx}>
            <div
              className="rounded-2xl border border-slate-100 dark:border-white/[0.08] overflow-hidden shadow-sm dark:shadow-none"
              style={
                typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                  ? { background: 'transparent' }
                  : { background: '#ffffff' }
              }
            >
              <div className="grid grid-cols-7 gap-1 px-2 pt-3 pb-2">
                {weekDays.map((day, i) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayShifts = byDay[key] ?? [];
                  const hasShift = dayShifts.length > 0;
                  const first = dayShifts[0];
                  const isAbsent = first?.approval_status === 'absent';
                  const isToday_ = isToday(day);
                  const shiftCount = hasShift && !isAbsent ? dayShifts.length : 0;
                  const isSelected = selectedDayKey === key;
                  const blockCls = hasShift && !isAbsent
                    ? 'bg-[#3366CC]/[0.18] border border-[#3366CC]/[0.30]'
                    : isAbsent
                      ? 'bg-red-500/[0.08] border border-red-500/[0.18]'
                      : 'border border-slate-50 bg-slate-50/30 dark:border-white/[0.04] dark:bg-white/[0.02]';
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-1 cursor-pointer"
                      onClick={() => {
                        if (selectedDayKey === key) {
                          setListOpen(o => !o);
                        } else {
                          setSelectedDayKey(key);
                          setListOpen(true);
                        }
                      }}
                    >
                      <span className={`text-[8px] font-bold ${isToday_ ? 'text-[#3366CC]' : 'text-slate-400 dark:text-white/25'}`}>
                        {dayLetters[i]}
                      </span>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        isToday_ ? 'bg-[#3366CC] text-white shadow-[0_0_12px_rgba(51,102,204,0.4)]' : 'text-slate-500 dark:text-white/55'
                      }`}>
                        {format(day, 'd')}
                      </div>
                      <div className={`w-full rounded-lg flex flex-col items-center justify-center py-1.5 px-0.5 min-h-[38px] transition-all ${blockCls} ${
                        isSelected ? 'ring-2 ring-[#3366CC]/60 ring-offset-1' : ''
                      }`}>
                        {shiftCount > 0 && (
                          <span className="text-[13px] font-black text-[#3366CC] dark:text-[#93c5fd] leading-none drop-shadow-sm">
                            {shiftCount}
                          </span>
                        )}
                        {isAbsent && <span className="text-[10px] font-bold text-red-500 dark:text-red-400 opacity-80">—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer stats + freccia espandi settimana */}
              <div className="border-t border-slate-50 dark:border-white/[0.06] mx-3 pt-2.5 pb-3 flex items-center justify-around">
                {[
                  { label: t.shift_plural ?? 'Turni', value: confirmed.length.toString() },
                  { label: 'Ore tot', value: minsLabel(totalMins) },
                  { label: 'Riposi', value: restDays.toString() },
                ].map(({ label, value }, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <span className="text-sm font-black text-slate-800 dark:text-white/90 tabular-nums">{value}</span>
                    <span className="text-[8px] text-slate-400 dark:text-white/30 uppercase font-bold tracking-wider">{label}</span>
                  </div>
                ))}
                {/* Freccia: visibile solo quando un giorno di questa settimana è selezionato */}
                <button
                  type="button"
                  onClick={() => {
                    if (listOpen && isDayInThisWeek) {
                      // se lista aperta con filtro giorno → reset filtro e tieni aperta
                      setSelectedDayKey(null);
                    } else {
                      setListOpen(o => !o);
                    }
                  }}
                  aria-label={listOpen ? 'Chiudi lista turni' : 'Apri lista turni'}
                  className={`flex items-center gap-1 px-2 h-7 rounded-lg border transition-all text-[8px] font-black uppercase tracking-widest ${
                    isDayInThisWeek
                      ? 'border-[#3366CC]/40 text-[#3366CC] dark:text-[#93c5fd]'
                      : 'border-slate-200 dark:border-white/[0.08] text-slate-400 dark:text-white/30'
                  }`}
                >
                  <span>Settimana</span>
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className={`w-3 h-3 transition-transform duration-200 ${listOpen && !isDayInThisWeek ? 'rotate-180' : 'rotate-0'}`}
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3,6 8,11 13,6" />
                  </svg>
                </button>
              </div>
            </div>

            {listOpen && (
            <div className="flex flex-col gap-1.5 mt-2.5">
              {weekDays.map(day => {
                const key = format(day, 'yyyy-MM-dd');
                const dayShifts = byDay[key] ?? [];
                if (!dayShifts.length) return null;
                if (selectedDayKey && selectedDayKey !== key) return null;
                return (
                  <div key={key}>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-2 mb-1.5 text-[#3366CC] dark:text-[#93c5fd] flex items-center gap-2">
                      {format(day, 'EEEE d MMMM', { locale })}
                      {isToday(day) && <span className="h-1 w-1 rounded-full bg-[#3366CC] shadow-[0_0_4px_rgba(51,102,204,0.8)]" />}
                    </p>
                    {dayShifts.map(shift => {
                      const isAbsent = shift.approval_status === 'absent';
                      return (
                        <div key={shift.id}
                          className={`flex items-center justify-between rounded-xl px-3 py-2.5 mb-1 border shadow-sm dark:shadow-none ${
                            isAbsent
                              ? 'border-red-100 dark:border-red-500/[0.08]'
                              : 'border-slate-100 dark:border-white/[0.08]'
                          }`}
                          style={
                            typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                              ? { background: isAbsent ? 'rgba(239,68,68,0.04)' : 'transparent' }
                              : { background: isAbsent ? 'rgba(239,68,68,0.04)' : '#ffffff' }
                          }
                        >
                          <div className="flex flex-col gap-0.5">
                            <p className={`font-black tabular-nums text-base leading-none ${isAbsent ? 'text-slate-300 line-through dark:text-white/25' : 'text-slate-800 dark:text-white/90'}`}>
                              {shift.start_time.slice(0, 5)} – {shift.end_time?.slice(0, 5) ?? '…'}
                            </p>
                            {shift.department && (
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30 mt-0.5">
                                {translateDepartmentValue(shift.department, language as any)}
                              </p>
                            )}
                          </div>
                          <StatusBadge shift={shift} t={t} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Sezione: lista team ───────────────────────────────────────────────── */
function TeamShiftsSection({
  teamShifts, users, locale, language, t,
}: {
  teamShifts: Shift[];
  users: User[];
  locale: typeof it;
  language: string;
  t: Record<string, string>;
}) {
  const weeks = useMemo(() => groupByWeeks(teamShifts), [teamShifts]);
  const userMap = useMemo(() => {
    const m: Record<string, User> = {};
    users.forEach(u => { m[u.id] = u; });
    return m;
  }, [users]);

  if (teamShifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <Users className="w-6 h-6 text-slate-300 dark:text-white/20 mb-2" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/25">
          Nessun turno team
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {weeks.map((week, wIdx) => {
        const weekDays = eachDayOfInterval({ start: week.start, end: week.end });
        const byDay: Record<string, Shift[]> = {};
        week.shifts.forEach(s => {
          const k = format(parseISO(s.date), 'yyyy-MM-dd');
          if (!byDay[k]) byDay[k] = [];
          byDay[k].push(s);
        });
        Object.keys(byDay).forEach(k => {
          byDay[k].sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
        });

        const daysWithShifts = weekDays.filter(d => (byDay[format(d, 'yyyy-MM-dd')] ?? []).length > 0);
        if (daysWithShifts.length === 0) return null;

        return (
          <div key={wIdx}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-2 text-slate-400 dark:text-white/30">
              {format(week.start, 'd MMM', { locale })} – {format(week.end, 'd MMM yyyy', { locale })}
            </p>
            <div className="flex flex-col gap-1.5">
              {weekDays.map(day => {
                const key = format(day, 'yyyy-MM-dd');
                const dayShifts = byDay[key] ?? [];
                if (!dayShifts.length) return null;
                return (
                  <div key={key}>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-2 mb-1.5 text-[#3366CC] dark:text-[#93c5fd] flex items-center gap-2">
                      {format(day, 'EEEE d MMMM', { locale })}
                      {isToday(day) && <span className="h-1 w-1 rounded-full bg-[#3366CC] shadow-[0_0_4px_rgba(51,102,204,0.8)]" />}
                    </p>
                    {dayShifts.map(shift => {
                      const isAbsent = shift.approval_status === 'absent';
                      const u = userMap[shift.user_id];
                      const fullName = u ? `${u.first_name} ${u.last_name}` : '–';
                      return (
                        <div key={shift.id}
                          className={`flex items-center justify-between rounded-xl px-3 py-2.5 mb-1 border shadow-sm dark:shadow-none ${
                            isAbsent
                              ? 'border-red-100 dark:border-red-500/[0.08]'
                              : 'border-slate-100 dark:border-white/[0.08]'
                          }`}
                          style={
                            typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                              ? { background: isAbsent ? 'rgba(239,68,68,0.04)' : 'transparent' }
                              : { background: isAbsent ? 'rgba(239,68,68,0.04)' : '#ffffff' }
                          }
                        >
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-white/50 truncate">
                              {fullName}
                            </p>
                            <p className={`font-black tabular-nums text-sm leading-none ${isAbsent ? 'text-slate-300 line-through dark:text-white/25' : 'text-slate-800 dark:text-white/90'}`}>
                              {shift.start_time.slice(0, 5)} – {shift.end_time?.slice(0, 5) ?? '…'}
                            </p>
                            {shift.department && (
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">
                                {translateDepartmentValue(shift.department, language as any)}
                              </p>
                            )}
                          </div>
                          <StatusBadge shift={shift} t={t} />
                        </div>
                      );
                    })}
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

/* ── Componente principale ─────────────────────────────────────────────── */
export default function ManagementMobileShifts({ shifts, users, currentUserId, language }: Props) {
  const locale = getLocale(language);
  const t = getTranslations(language as 'it' | 'en' | 'es') as Record<string, string>;
  const dayLetters = getDayLetters(locale);

  // ── Navigazione periodo ────────────────────────────────────────────────
  const [navMode, setNavMode] = useState<NavMode>('period');
  const [navOffset, setNavOffset] = useState(0);

  const getRange = useCallback((mode: NavMode, offset: number): { start: Date; end: Date } => {
    const today = new Date();
    if (mode === 'week') {
      const base = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), offset);
      return { start: startOfDay(base), end: endOfDay(endOfWeek(base, { weekStartsOn: 1 })) };
    }
    let cfg: PeriodConfig = loadPeriodConfig();
    if (offset > 0) for (let i = 0; i < offset; i++) cfg = nextPeriodConfig(cfg);
    else if (offset < 0) for (let i = 0; i > offset; i--) cfg = prevPeriodConfig(cfg);
    const r = getPeriodDateRange(cfg);
    return { start: startOfDay(new Date(r.startDate)), end: endOfDay(new Date(r.endDate)) };
  }, []);

  const range = useMemo(() => getRange(navMode, navOffset), [getRange, navMode, navOffset]);

  const rangeLabel = navMode === 'week'
    ? `S.${getISOWeek(range.start)} · ${format(range.start, 'd MMM', { locale })} – ${format(range.end, 'd MMM', { locale })}`
    : `${format(range.start, 'd MMM', { locale })} – ${format(range.end, 'd MMM yy', { locale })}`;

  // ── Filtra i turni per periodo ─────────────────────────────────────────
  const filteredShifts = useMemo(
    () => shifts.filter(s => isWithinInterval(parseISO(s.date), { start: range.start, end: range.end })),
    [shifts, range]
  );

  const myShifts   = useMemo(() => filteredShifts.filter(s => s.user_id === currentUserId), [filteredShifts, currentUserId]);
  const teamShifts = useMemo(() => filteredShifts.filter(s => s.user_id !== currentUserId), [filteredShifts, currentUserId]);

  return (
    <div className="flex flex-col pb-24 pt-1">

      {/* ── Barra navigazione periodo ─────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5 px-4">
        {/* Label periodo fisso */}
        <span className="h-9 inline-flex items-center px-3 rounded-2xl border border-[#3366CC]/40 text-[#3366CC] dark:text-[#93c5fd] text-[9px] font-black uppercase tracking-widest shrink-0">
          Periodo
        </span>

        {/* Frecce + label */}
        <div
          className="flex items-center border border-slate-100 dark:border-white/[0.08] rounded-2xl overflow-hidden flex-1 supports-[backdrop-filter]:backdrop-blur-md"
          style={{ background: 'transparent', boxShadow: 'none' }}
        >
          <button
            type="button"
            onClick={() => setNavOffset(o => o - 1)}
            className="flex items-center justify-center h-9 w-9 text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors shrink-0 border-r border-slate-100 dark:border-white/[0.08]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 flex items-center justify-center gap-1.5 px-2 min-w-0">
            <Calendar className="h-3 w-3 text-slate-400 dark:text-neutral-500 shrink-0" />
            <span className="text-[10px] font-bold text-slate-700 dark:text-neutral-200 tabular-nums truncate">
              {rangeLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setNavOffset(o => o + 1)}
            className="flex items-center justify-center h-9 w-9 text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors shrink-0 border-l border-slate-100 dark:border-white/[0.08]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Contenuto ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-8 px-4">

        {/* I miei turni */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/35">
              I miei turni
            </span>
            {myShifts.length > 0 && (
              <span className="text-[9px] font-black tabular-nums text-slate-300 dark:text-white/20">
                ({myShifts.length})
              </span>
            )}
          </div>
          <MyShiftsSection
            myShifts={myShifts}
            locale={locale}
            dayLetters={dayLetters}
            language={language}
            t={t}
          />
        </section>

        {/* Team */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/35">
              Team
            </span>
            {teamShifts.length > 0 && (
              <span className="text-[9px] font-black tabular-nums text-slate-300 dark:text-white/20">
                ({teamShifts.length})
              </span>
            )}
          </div>
          <TeamShiftsSection
            teamShifts={teamShifts}
            users={users}
            locale={locale}
            language={language}
            t={t}
          />
        </section>

      </div>
    </div>
  );
}
