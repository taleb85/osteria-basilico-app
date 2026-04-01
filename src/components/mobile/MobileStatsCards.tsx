/** Due card affiancate: ore settimana (vs tetto) e mese (ore + giorni lavorati). */

function fmtHoursShort(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0h';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
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
    <div className="grid grid-cols-2 gap-4">
      {/* CARD SETTIMANA */}
      <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
        <p className="text-xs font-medium text-slate-400 uppercase mb-1">
          {labels.week}
        </p>
        <p className="text-xl font-bold text-slate-900 dark:text-neutral-100 mb-3 tabular-nums">
          {fmtHoursShort(weekWorkedMins)} <span className="text-slate-300 dark:text-neutral-700 font-normal">/</span>{' '}
          {fmtHoursShort(weekCapMins)}
        </p>
        <div className="w-full bg-slate-100 dark:bg-neutral-800 rounded-full h-2">
          <div
            className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* CARD MESE */}
      <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
        <p className="text-xs font-medium text-slate-400 uppercase mb-1">
          {labels.month}
        </p>
        <p className="text-xl font-bold text-slate-900 dark:text-neutral-100 mb-1 tabular-nums">
          {fmtHoursShort(monthWorkedMins)}
        </p>
        <p className="text-xs font-medium text-slate-500 dark:text-neutral-400">
          {monthDaysWorked} {labels.daysWorked}
        </p>
      </div>
    </div>
  );
}
