import { Play, LogOut, ChevronRight, Clock, RotateCcw } from 'lucide-react';
import HeaderTodayCoworkersCard from '../HeaderTodayCoworkersCard';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

export interface MobileHomeProps {
  onRefresh?: () => Promise<void> | void;
  greetingText: string;
  todayLabel: string;
  statsLabels: {
    title: string;
    week: string;
    month: string;
    daysWorked: string;
  };
  weeklyMinutes: number;
  monthlyMinutes: number;
  monthDaysWorked: number;
  weekCapMinutes: number;
  inProgress: any;
  elapsedLabel: string | null;
  todayWorkShiftsCount: number;
  noShiftsHint: string;
  tapStartHint: string;
  shiftTimeHint: string | null;
  statusInShift: string;
  todayShiftLabel: string;
  inProgressLabel: string;
  nextShiftLabel: string;
  savingLabel: string;
  startLabel: string;
  endLabel: string;
  canStart: boolean;
  canEnd: boolean;
  punchBusy: boolean;
  onStart: () => void;
  onEnd: () => void;
  onNavigateToTimesheet?: () => void;
  todayWorkShifts: any[];
  detailLabel?: string;
}

function fmtH(mins: number) {
  if (!Number.isFinite(mins) || mins <= 0) return '0h';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
}

function useDarkMode() {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

export default function MobileHome({
  greetingText,
  todayLabel,
  statsLabels,
  weeklyMinutes,
  monthlyMinutes,
  monthDaysWorked,
  weekCapMinutes,
  inProgress,
  elapsedLabel,
  todayWorkShiftsCount,
  noShiftsHint,
  tapStartHint,
  shiftTimeHint,
  todayShiftLabel,
  inProgressLabel,
  nextShiftLabel,
  savingLabel,
  startLabel,
  endLabel,
  canStart,
  canEnd,
  punchBusy,
  onStart,
  onEnd,
  onNavigateToTimesheet,
  onRefresh,
  todayWorkShifts,
  detailLabel = 'Detail',
}: MobileHomeProps) {
  const dark = useDarkMode();

  const { pullDistance, isRefreshing, isTriggered, indicatorOpacity, indicatorRotation } =
    usePullToRefresh({ onRefresh: onRefresh ?? (() => {}), disabled: !onRefresh });
  const cardCls = dark
    ? 'rounded-2xl border border-white/[0.08]'
    : 'rounded-2xl border bg-white border-slate-100 shadow-sm';
  const cardStyle = dark ? { background: 'transparent' } : {};

  const firstShift = todayWorkShifts[0];
  const shiftRange = firstShift
    ? `${firstShift.start_time.slice(0, 5)} → ${firstShift.end_time?.slice(0, 5) ?? '…'}`
    : null;

  const weekPct = weekCapMinutes > 0
    ? Math.min(100, Math.round((weeklyMinutes / weekCapMinutes) * 100))
    : 0;

  return (
    <div
      className="flex flex-col gap-3 px-4 py-4 pb-12 relative"
      style={{ transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined, transition: pullDistance === 0 ? 'transform 0.25s ease-out' : undefined }}
    >
      {/* Pull-to-refresh indicator */}
      {onRefresh && pullDistance > 0 && (
        <div
          className="absolute -top-10 left-0 right-0 flex justify-center pointer-events-none"
          style={{ opacity: indicatorOpacity }}
        >
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${isTriggered ? 'bg-accent text-white' : 'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-300'}`}>
            <RotateCcw
              className={`h-3.5 w-3.5 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}
              style={{ transform: isRefreshing ? undefined : `rotate(${indicatorRotation}deg)` }}
            />
            {isTriggered ? 'Rilascia per aggiornare' : 'Trascina per aggiornare'}
          </div>
        </div>
      )}

      {/* ── Saluto compatto ─────────────────────────────────────────── */}
      <div className="px-1">
        <h1
          className="text-xl font-extrabold tracking-tight leading-tight"
          style={{
            background: dark
              ? 'linear-gradient(120deg, #93c5fd 0%, #60a5fa 40%, #3b82f6 100%)'
              : 'linear-gradient(120deg, #66AAFF 0%, #3366CC 40%, #001A80 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {greetingText}
        </h1>
        <p
          className="text-sm font-bold capitalize mt-0.5 tracking-wide"
          style={{
            background: dark
              ? 'linear-gradient(120deg, #93c5fd 0%, #60a5fa 40%, #3b82f6 100%)'
              : 'linear-gradient(120deg, #66AAFF 0%, #3366CC 40%, #001A80 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {todayLabel}
        </p>
      </div>

      {/* ── Il tuo turno oggi ───────────────────────────────────────── */}
      <section className={`${cardCls} px-5 py-4 mt-5`} style={cardStyle}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/35 mb-1">
              {todayShiftLabel}
            </p>
            {shiftRange ? (
              <p className="text-2xl font-black text-slate-800 dark:text-white tabular-nums">
                {shiftRange}
              </p>
            ) : (
              <p className="text-base font-bold text-slate-400 dark:text-white/40">
                {noShiftsHint}
              </p>
            )}
            {shiftTimeHint && (
              <p className="text-[10px] font-semibold text-slate-400 dark:text-white/30 mt-0.5">
                {shiftTimeHint}
              </p>
            )}
          </div>

          {/* Badge stato */}
          {inProgress ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              {inProgressLabel}
            </span>
          ) : todayWorkShiftsCount > 0 ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:bg-[#4361EE]/20 dark:text-[#93c5fd]">
              {nextShiftLabel}
            </span>
          ) : null}
        </div>

        {/* Tempo trascorso se in turno */}
        {inProgress && elapsedLabel && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-transparent border border-slate-100 dark:border-white/[0.08]">
            <Clock className="w-4 h-4 text-slate-400 dark:text-white/40 shrink-0" />
            <span className="text-lg font-mono font-semibold text-slate-600 dark:text-white/80 tabular-nums">
              {elapsedLabel}
            </span>
          </div>
        )}

        {/* Lista turni del giorno (se non in corso) */}
        {!inProgress && todayWorkShifts.length > 1 && (
          <div className="flex flex-col gap-1.5 mb-3">
            {todayWorkShifts.slice(1).map((s) => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-transparent border border-slate-100 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${s.type === 'lunch' ? 'bg-amber-400' : 'bg-violet-500'}`} />
                  <span className="text-xs font-bold text-slate-700 dark:text-white/70">
                    {s.start_time.slice(0, 5)} – {s.end_time?.slice(0, 5) ?? '…'}
                  </span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400 dark:text-white/35">
                  {s.type === 'lunch' ? 'Pranzo' : 'Cena'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Bottoni punch */}
        {inProgress ? (
          canEnd && (
            <button
              type="button"
              disabled={punchBusy}
              onClick={onEnd}
              className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-red-600/20 transition-all active:scale-95 disabled:opacity-60"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-base font-bold uppercase tracking-wider">
                {punchBusy ? savingLabel : endLabel}
              </span>
            </button>
          )
        ) : (
          canStart ? (
            <button
              type="button"
              disabled={punchBusy}
              onClick={onStart}
              className="w-full h-14 bg-[#001A80] hover:bg-[#001266] dark:bg-[#4361EE]/30 dark:hover:bg-[#4361EE]/45 dark:border dark:border-[#4361EE]/50 text-white dark:text-[#93c5fd] rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-[#001A80]/15 dark:shadow-none transition-all active:scale-95 disabled:opacity-60"
            >
              <Play className="w-5 h-5 fill-current" />
              <span className="text-base font-bold uppercase tracking-wider">
                {punchBusy ? savingLabel : startLabel}
              </span>
            </button>
          ) : (
            todayWorkShiftsCount > 0 && (
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/30">
                {tapStartHint}
              </p>
            )
          )
        )}
      </section>

      {/* ── I miei numeri ───────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-800 dark:text-white/80">
            {statsLabels.title}
          </h2>
          {onNavigateToTimesheet && (
            <button
              onClick={onNavigateToTimesheet}
              className="text-[10px] font-bold text-blue-600 dark:text-[#93c5fd] flex items-center gap-0.5 hover:opacity-80 transition-opacity"
            >
              {detailLabel} <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Ore settimana */}
          <div className={`${cardCls} px-4 py-3`} style={cardStyle}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/35 mb-1">
              {statsLabels.week}
            </p>
            <p className="text-xl font-black text-slate-800 dark:text-white tabular-nums leading-none mb-2">
              {fmtH(weeklyMinutes)}
            </p>
            <div className="w-full bg-slate-100 dark:bg-white/[0.08] rounded-full h-1.5">
              <div
                className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-700 ease-out"
                style={{ width: `${weekPct}%` }}
              />
            </div>
            <p className="text-[8px] text-slate-400 dark:text-white/25 mt-1 tabular-nums">
              / {fmtH(weekCapMinutes)}
            </p>
          </div>

          {/* Ore mese */}
          <div className={`${cardCls} px-4 py-3`} style={cardStyle}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-white/35 mb-1">
              {statsLabels.month}
            </p>
            <p className="text-xl font-black text-slate-800 dark:text-white tabular-nums leading-none mb-1">
              {fmtH(monthlyMinutes)}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-white/35 tabular-nums">
              {monthDaysWorked} {statsLabels.daysWorked}
            </p>
          </div>
        </div>
      </section>

      {/* ── Colleghi in turno oggi ───────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 dark:border-white/[0.08] overflow-hidden bg-white/80 dark:bg-white/[0.04] supports-[backdrop-filter]:backdrop-blur-xl">
        <HeaderTodayCoworkersCard />
      </div>

    </div>
  );
}
