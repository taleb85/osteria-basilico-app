import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Clock, Calendar } from 'lucide-react';
import type { Shift } from '../../types';
import { safeFormatDate } from '../../utils/safeDateFormat';
import { translateDepartmentValue } from '../../utils/departmentLabels';

interface MobileShiftsProps {
  shifts: Shift[];
  language: string;
}

export default function MobileShifts({ shifts, language }: MobileShiftsProps) {
  const locale = it;

  if (shifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 bg-slate-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-500 dark:text-neutral-400 font-medium uppercase tracking-wider text-xs">Nessun turno in programma</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-24">
      {shifts.map((shift) => {
        const isAbsent = shift.approval_status === 'absent';
        const isDraft = shift.approval_status === 'draft';
        
        return (
          <div 
            key={shift.id}
            className={`bg-white dark:bg-neutral-900 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-white/5 flex flex-col gap-4 ${isAbsent ? 'opacity-60' : ''}`}
          >
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                  {safeFormatDate(shift.date, 'EEEE d MMMM', { locale })}
                </p>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#2D5A27]" />
                  <p className="text-2xl font-bold text-slate-900 dark:text-neutral-100 tabular-nums">
                    {shift.start_time.slice(0, 5)} – {shift.end_time?.slice(0, 5) ?? '…'}
                  </p>
                </div>
              </div>
              
              {shift.department && (
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-[10px] font-black uppercase tracking-wider border border-slate-200 dark:border-white/10">
                  {translateDepartmentValue(shift.department, language as any)}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-white/5">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${
                  isAbsent ? 'bg-red-500' : isDraft ? 'bg-slate-300' : 'bg-green-500'
                }`} />
                <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
                  {isAbsent ? 'Assente' : isDraft ? 'Bozza' : 'Confermato'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
