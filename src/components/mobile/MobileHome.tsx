import { Play, Pause, LogOut, ChevronRight } from 'lucide-react';
import MobileStatsCards from './MobileStatsCards';

export interface MobileHomeProps {
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
  statusInShift,
  savingLabel,
  startLabel,
  endLabel,
  canStart,
  canEnd,
  punchBusy,
  onStart,
  onEnd,
  onNavigateToTimesheet,
  todayWorkShifts,
}: MobileHomeProps) {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 pb-12">
      {/* Header */}
      <header className="flex justify-between items-start mb-1 pt-1">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-neutral-100 leading-tight tracking-tight">{greetingText}</h1>
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${inProgress ? 'animate-pulse bg-[#00D1FF]' : 'bg-slate-300 dark:bg-neutral-600'}`} />
            <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
              {inProgress ? statusInShift : 'Fuori Turno'}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-400 dark:text-neutral-500 capitalize">{todayLabel}</p>
        </div>
      </header>

      {/* Card Timbratura: Design Operativo con angoli 40px */}
      <section className="bg-white dark:bg-neutral-900 rounded-[40px] p-5 shadow-sm border border-slate-100 dark:border-white/5 mb-1">
        <div className="text-center mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">
            {inProgress ? 'Tempo Lavorato' : 'Standby'}
          </p>
          {inProgress && elapsedLabel && (
            <p className="text-4xl font-mono font-medium text-[#94a3b8] tabular-nums leading-none tracking-tight">
              {elapsedLabel}
            </p>
          )}
          {inProgress && shiftTimeHint && (
            <p className="mt-2 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              {shiftTimeHint}
            </p>
          )}
        </div>

        <div className="w-full">
          {inProgress ? (
            <div className="flex flex-col gap-2.5">
              {/* Pulsante FINE TURNO (Rosso) */}
              {canEnd && (
                <button
                  type="button"
                  disabled={punchBusy}
                  onClick={onEnd}
                  className="w-full h-16 bg-red-600 hover:bg-red-700 text-white rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-red-600/20 transition-all active:scale-95"
                >
                  <LogOut className="w-6 h-6" />
                  <span className="text-lg font-bold uppercase tracking-wider">
                    {punchBusy ? savingLabel : endLabel}
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {todayWorkShifts.length > 0 && (
                <div className="w-full mb-4 space-y-1.5">
                  <div className="flex flex-col gap-1.5">
                    {todayWorkShifts.map((s) => (
                      <div key={s.id} className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${s.type === 'lunch' ? 'bg-amber-400' : 'bg-violet-500'}`} />
                          <span className="text-xs font-bold text-slate-700 dark:text-neutral-200">
                            {s.start_time.slice(0, 5)} – {s.end_time?.slice(0, 5) ?? '…'}
                          </span>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400 dark:text-neutral-500">
                          {s.type === 'lunch' ? 'Pranzo' : 'Cena'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="mb-3 text-[9px] font-bold text-slate-400 max-w-[180px] uppercase tracking-wider text-center">
                {todayWorkShiftsCount > 0 ? tapStartHint : noShiftsHint}
              </p>
              {/* Pulsante INIZIA TURNO */}
              {canStart ? (
                <button
                  type="button"
                  disabled={punchBusy}
                  onClick={onStart}
                  className="w-full h-16 bg-[#0052FF] hover:bg-[#0039CC] text-white rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-[#0052FF]/20 transition-all active:scale-95"
                >
                  <Play className="w-6 h-6 fill-white" />
                  <span className="text-lg font-bold uppercase tracking-wider">
                    {punchBusy ? savingLabel : startLabel}
                  </span>
                </button>
              ) : (
                <div className="w-full h-16 bg-slate-100 dark:bg-neutral-800 text-slate-400 rounded-2xl flex items-center justify-center gap-3 border border-dashed border-slate-200 dark:border-white/5 opacity-60">
                  <Play className="w-6 h-6" />
                  <span className="text-lg font-bold uppercase tracking-wider">
                    {startLabel}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Sezione I MIEI NUMERI */}
      <section>
        <div className="mb-3 px-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            {statsLabels.title}
          </h2>
          {onNavigateToTimesheet && (
            <button 
              onClick={onNavigateToTimesheet}
              className="text-xs font-bold text-[#0052FF] flex items-center gap-0.5 hover:opacity-80 transition-opacity"
            >
              Vedi Dettaglio <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
        <MobileStatsCards
          weekWorkedMins={weeklyMinutes}
          weekCapMins={weekCapMinutes}
          monthWorkedMins={monthlyMinutes}
          monthDaysWorked={monthDaysWorked}
          labels={statsLabels}
        />
      </section>
    </div>
  );
}
