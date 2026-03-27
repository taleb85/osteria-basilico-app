import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import type { Shift, PunchRecord } from '../../types';
import { safeFormatDate } from '../../utils/safeDateFormat';
import { getResolvedStartEndForHours } from '../../utils/shiftResolvedClockTimes';
import { getNetShiftMinutes } from '../../utils/breakRules';

interface MobileTimesheetProps {
  shifts: Shift[];
  punchRecords: PunchRecord[];
  user: any;
  breakRules: any;
  breakComputeOpts: any;
}

const STATUS_CONFIG = {
  approved: {
    label: 'Approvato',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-100 dark:border-emerald-500/20',
  },
  confirmed: {
    label: 'Pendente',
    icon: AlertCircle,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-100 dark:border-amber-500/20',
  },
  absent: {
    label: 'Assente',
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-500/10',
    border: 'border-red-100 dark:border-red-500/20',
  },
} as const;

export default function MobileTimesheet({ shifts, punchRecords, user, breakRules, breakComputeOpts }: MobileTimesheetProps) {
  const locale = it;

  const history = shifts
    .filter(s => s.date <= format(new Date(), 'yyyy-MM-dd'))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 bg-slate-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-500 dark:text-neutral-400 font-medium uppercase tracking-wider text-xs">Nessuno storico disponibile</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-24">
      {history.map((shift) => {
        const status = (shift.approval_status as keyof typeof STATUS_CONFIG) || 'confirmed';
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.confirmed;
        const Icon = config.icon;
        
        const { start, end } = getResolvedStartEndForHours(shift, punchRecords);
        const mins = getNetShiftMinutes(shift, start, end, user, breakRules, breakComputeOpts);
        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;

        return (
          <div 
            key={shift.id}
            className="bg-white dark:bg-neutral-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-white/5 flex flex-col gap-4"
          >
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                  {safeFormatDate(shift.date, 'EEEE d MMMM', { locale })}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-slate-900 dark:text-neutral-100 tabular-nums">
                    {hours}h {remainingMins > 0 ? `${remainingMins}m` : ''}
                  </p>
                </div>
              </div>
              
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${config.bg} ${config.border} ${config.color}`}>
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {config.label}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-white/5">
              <p className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                {shift.start_time.slice(0, 5)} – {shift.end_time?.slice(0, 5) ?? '…'}
              </p>
              <p className="text-[11px] text-slate-400 italic">
                {shift.type === 'lunch' ? 'Pranzo' : 'Cena'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
