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
      className="flex flex-col gap-3 px-4 py-4 pb-12 relative shift-mobile-safe"
      style={{ transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined, transition: pullDistance === 0 ? 'transform 0.25s ease-out' : undefined }}
    >
      {/* Pull-to-refresh indicator */}
      {onRefresh && pullDistance > 0 && (
        <div
          className="absolute -top-10 left-0 right-0 flex justify-center pointer-events-none"
          style={{ opacity: indicatorOpacity }}
        >
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${isTriggered ? 'bg-accent text-white' : 'bg-slate-100 text-slate-500'}`}>
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

      {/* ── Il tuo turno oggi (ULTRA-CLEAN) ──────────────────────────────── */}
      <section className="shift-card-ultra px-6 py-6 mt-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">
              {todayShiftLabel}
            </p>
            {shiftRange ? (
              <p className="text-5xl font-medium shift-time-clean text-black leading-tight tracking-tight">
                {shiftRange}
              </p>
            ) : (
              <p className="text-base font-medium text-slate-400">
                {noShiftsHint}
              </p>
            )}
            {shiftTimeHint && (
              <p className="text-xs font-medium text-slate-500 mt-2">
                {shiftTimeHint}
              </p>
            )}
          </div>

          {/* Badge stato (ULTRA-CLEAN) */}
          {inProgress ? (
            <span className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-medium text-black">
              <span className="w-2 h-2 rounded-full bg-black" />
              {inProgressLabel}
            </span>
          ) : todayWorkShiftsCount > 0 ? (
            <span className="px-3 py-1.5 text-[10px] font-medium text-slate-600">
              {nextShiftLabel}
            </span>
          ) : null}
        </div>

        {/* Tempo trascorso (ULTRA-CLEAN: solo testo pulito) */}
        {inProgress && elapsedLabel && (
          <div className="flex items-center gap-3 mb-5 px-4 py-4 rounded-xl"
            style={{ 
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: 'none',
              boxShadow: '0 8px 32px 0 rgba(11, 53, 115, 0.08)',
            }}
          >
            <Clock className="w-6 h-6 text-slate-700 shrink-0" strokeWidth={1.5} />
            <span className="text-4xl shift-time-clean font-medium text-black">
              {elapsedLabel}
            </span>
          </div>
        )}

        {/* Lista turni del giorno (ULTRA-CLEAN) */}
        {!inProgress && todayWorkShifts.length > 1 && (
          <div className="flex flex-col shift-gap-ultra mb-5">
            {todayWorkShifts.slice(1).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3 shift-separator-ultra">
                <span className="text-xl font-medium shift-time-clean text-black">
                  {s.start_time.slice(0, 5)} – {s.end_time?.slice(0, 5) ?? '…'}
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
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
              className="w-full h-14 bg-[#0B3573] hover:bg-[#0a2f5f] text-white rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-[#0B3573]/15 transition-all active:scale-95 disabled:opacity-60"
            >
              <Play className="w-5 h-5 fill-current" />
              <span className="text-base font-bold uppercase tracking-wider">
                {punchBusy ? savingLabel : startLabel}
              </span>
            </button>
          ) : (
            todayWorkShiftsCount > 0 && (
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 py-3">
                {tapStartHint}
              </p>
            )
          )
        )}
      </section>

      {/* ── I miei numeri ───────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-800">
            {statsLabels.title}
          </h2>
          {onNavigateToTimesheet && (
            <button
              onClick={onNavigateToTimesheet}
              className="text-[10px] font-bold text-blue-600 flex items-center gap-0.5 hover:opacity-80 transition-opacity"
            >
              {detailLabel} <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Ore settimana */}
          <div className={`${cardCls} px-4 py-3`} style={cardStyle}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              {statsLabels.week}
            </p>
            <p className="text-xl font-black text-slate-800 tabular-nums leading-none mb-2">
              {fmtH(weeklyMinutes)}
            </p>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-700 ease-out"
                style={{ width: `${weekPct}%` }}
              />
            </div>
            <p className="text-[8px] text-slate-400 mt-1 tabular-nums">
              / {fmtH(weekCapMinutes)}
            </p>
          </div>

          {/* Ore mese */}
          <div className={`${cardCls} px-4 py-3`} style={cardStyle}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">
              {statsLabels.month}
            </p>
            <p className="text-xl font-black text-slate-800 tabular-nums leading-none mb-1">
              {fmtH(monthlyMinutes)}
            </p>
            <p className="text-[10px] text-slate-400 tabular-nums">
              {monthDaysWorked} {statsLabels.daysWorked}
            </p>
          </div>
        </div>
      </section>

      {/* ── Colleghi in turno oggi ───────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ 
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: 'none',
          boxShadow: '0 8px 32px 0 rgba(11, 53, 115, 0.08)',
        }}
      >
        <HeaderTodayCoworkersCard />
      </div>

    </div>
  );
}
