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
      <div className="p-5 rounded-2xl border border-white/10" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <p className="text-xs font-medium text-white/50 uppercase mb-1">
          {labels.week}
        </p>
        <p className="text-xl font-bold text-white mb-3 tabular-nums">
          {fmtHoursShort(weekWorkedMins)} <span className="text-white/30 font-normal">/</span>{' '}
          {fmtHoursShort(weekCapMins)}
        </p>
        <div className="w-full bg-white/15 rounded-full h-2">
          <div
            className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* CARD MESE */}
      <div className="p-5 rounded-2xl border border-white/10" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <p className="text-xs font-medium text-white/50 uppercase mb-1">
          {labels.month}
        </p>
        <p className="text-xl font-bold text-white mb-1 tabular-nums">
          {fmtHoursShort(monthWorkedMins)}
        </p>
        <p className="text-xs font-medium text-white/60">
          {monthDaysWorked} {labels.daysWorked}
        </p>
      </div>
    </div>
  );
}
