/** Due card affiancate: ore settimana (vs tetto) e mese (ore + giorni lavorati). */

function fmtHoursShort(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0h';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export interface MobileStatsCardsProps {
  weekWorkedMins: number;
  weekCapMins: number;
  monthWorkedMins: number;
  monthDaysWorked: number;
  labels: {
    title: string;
    week: string;
    month: string;
    daysWorked: string;
  };
}

export default function MobileStatsCards({
  weekWorkedMins,
  weekCapMins,
  monthWorkedMins,
  monthDaysWorked,
  labels,
}: MobileStatsCardsProps) {
  const pct = weekCapMins > 0 ? Math.min(100, Math.round((weekWorkedMins / weekCapMins) * 100)) : 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xl dark:border-white/10 dark:bg-neutral-900/90 dark:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.45)]">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{labels.week}</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-neutral-100">
          {fmtHoursShort(weekWorkedMins)} <span className="text-slate-400 dark:text-neutral-500">/</span>{' '}
          {fmtHoursShort(weekCapMins)}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/90 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] font-semibold text-slate-400 dark:text-neutral-500">{pct}%</p>
      </div>
      <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-xl dark:border-white/10 dark:bg-neutral-900/90 dark:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.45)]">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-400">{labels.month}</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-neutral-100">{fmtHoursShort(monthWorkedMins)}</p>
        <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-neutral-300">
          {labels.daysWorked}: <span className="tabular-nums text-slate-900 dark:text-white">{monthDaysWorked}</span>
        </p>
      </div>
    </div>
  );
}
