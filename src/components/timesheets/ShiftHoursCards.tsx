import { format } from 'date-fns';
import { Check, Lock, AlertTriangle } from 'lucide-react';
import { formatTrans } from '../../utils/translations';
import type { PunchRecordSource } from '../../types';

interface ShiftData {
  id: string;
  status: string;
  plannedStart: string;
  plannedEnd: string;
  plannedMins: number;
  breakMinutes: number;
  breakMinutesActual: number;
  actualStart: string | null;
  actualEnd: string | null;
  actualEndFull?: string;
  actualMins: number;
  deltaMins: number;
  punched: boolean;
  isCrossDay?: boolean;
  nightRolloverOk?: boolean;
  punchInSource?: PunchRecordSource | null;
  punchOutSource?: PunchRecordSource | null;
}

interface ShiftHoursCardsProps {
  /** Dati shift */
  shift: ShiftData;
  
  /** Shift completo dal DB (per toggle deduct_break) */
  fullShift?: { id: string; deduct_break?: boolean } | null;
  
  /** Classi CSS per card pianificato */
  plannedCardBoxClass: string;
  plannedCardLabelCls: string;
  plannedCardMainCls: string;
  plannedCardSubCls: string;
  
  /** Colore delta ore (blu = +, rosso = -, grigio = neutro) */
  deltaColor: string;
  
  /** Review sheet settimanale (nasconde toggle pausa) */
  isEmployeeWeekReviewSheet: boolean;
  
  /** Permessi: può modificare settings turno */
  canTeamTimesheetOps: boolean;
  
  /** Turno congelato (payroll) */
  isFrozen: boolean;
  
  /** Turno absent */
  isAbsent: boolean;
  
  /** Saving state toggle */
  deductBreakSaving: boolean;
  
  /** Handler toggle deduct_break */
  onDeductBreakChange: (shiftId: string, newValue: boolean) => void;
  
  /** Funzione helper: formatta minuti → "Xh Ym" */
  fmtHM: (mins: number) => string;
  
  /** Funzione helper: formatta detrazione pausa "Xm" */
  fmtBreakDeductionShort: (mins: number) => string;
  
  /** Funzione helper: label sorgente timbratura */
  punchSourceLabel: (source: PunchRecordSource | null | undefined, t: Record<string, string>) => string;
  
  /** Traduzione */
  t: Record<string, string>;
  tv: Record<string, string>;
}

/**
 * Cards riepilogo ore turno: pianificato vs timbrato + toggle "Deduci pausa".
 * 
 * Estratto da Timesheets.tsx (righe 4908-5080) per ridurre complessità drawer.
 */
export function ShiftHoursCards({
  shift: s,
  fullShift,
  plannedCardBoxClass,
  plannedCardLabelCls,
  plannedCardMainCls,
  plannedCardSubCls,
  deltaColor,
  isEmployeeWeekReviewSheet,
  canTeamTimesheetOps,
  isFrozen,
  isAbsent,
  deductBreakSaving,
  onDeductBreakChange,
  fmtHM,
  fmtBreakDeductionShort,
  punchSourceLabel,
  t,
  tv,
}: ShiftHoursCardsProps) {
  return (
    <div className="border-b border-slate-100 p-3 sm:p-5 shrink-0">
      <div className="mb-3 grid grid-cols-2 gap-3 items-stretch">
        {/* Card Pianificato */}
        <div className={`${plannedCardBoxClass} overflow-hidden min-h-[90px]`}>
          <p className={`mb-1 text-[10px] font-semibold uppercase ${plannedCardLabelCls}`}>{t.ts_label_planned}</p>
          <div className="flex items-start gap-2">
            {(s.status === 'confirmed' || s.status === 'approved') && (
              <span className="flex shrink-0 flex-col items-center justify-center gap-1 pr-1">
                {s.status === 'confirmed' && (
                  <Check className="h-4 w-4 text-[#3366CC]" strokeWidth={2.5} aria-hidden />
                )}
                {s.status === 'approved' && (
                  <Lock className="h-4 w-4 text-emerald-600" strokeWidth={2.5} aria-hidden />
                )}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-base font-bold tabular-nums ${plannedCardMainCls}`}>
                {s.plannedStart}–{s.plannedEnd}
              </p>
              <p className={`mt-0.5 text-[11px] ${plannedCardSubCls}`}>
                {fmtHM(s.plannedMins)}
                {s.breakMinutes > 0 ? (
                  <span className="opacity-80">
                    {' '}
                    (−{fmtBreakDeductionShort(s.breakMinutes)})
                  </span>
                ) : null}
              </p>
            </div>
          </div>
        </div>
        
        {/* Card Timbrato */}
        <div
          className={`rounded-xl p-3 overflow-hidden border-2 border-l-4 min-h-[90px] ${
            s.punched
              ? s.isCrossDay
                ? 'border-red-200 border-l-error bg-red-50'
                : 'border-[#001A80]/25 border-l-[#3366CC] bg-[#001A80]/8'
              : 'border-amber-400/90 border-l-review bg-amber-50 animate-pulse'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <p className={`text-[10px] font-semibold uppercase ${
              s.punched
                ? s.isCrossDay
                  ? 'text-red-600'
                  : 'text-[#001A80]'
                : 'text-amber-800/90'
            }`}>{t.ts_label_punched}</p>
            {(s.punched && !s.actualEnd) || !s.punched ? (
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" title={t.data_missing} />
            ) : null}
          </div>
          {s.punched ? (
            <>
              <p className="text-base font-bold tabular-nums text-slate-900">
                {s.actualStart}
                {s.actualEnd ? `–${s.actualEnd}` : ''}
              </p>
              {s.isCrossDay && s.actualEndFull && (
                <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-red-600">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  {formatTrans(t.ts_crossday_out_label, {
                    time: format(new Date(s.actualEndFull), 'dd/MM HH:mm'),
                  })}
                </p>
              )}
              {s.nightRolloverOk && s.actualEndFull && (
                <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                  {formatTrans(t.ts_punch_out_next_calendar_day_hint, {
                    time: format(new Date(s.actualEndFull), 'dd/MM HH:mm'),
                  })}
                </p>
              )}
              <p
                className={`mt-0.5 text-[11px] font-semibold ${s.actualMins > 0 && !s.isCrossDay ? deltaColor : 'text-amber-600'}`}
              >
                {s.isCrossDay ? (
                  <>
                    {t.ts_fix_exit_time_label}
                    {s.breakMinutes > 0 ? (
                      <span className="mt-0.5 block font-semibold text-slate-600">
                        −{fmtBreakDeductionShort(s.breakMinutes)}
                      </span>
                    ) : null}
                  </>
                ) : s.actualMins > 0 ? (
                  <>
                    {s.breakMinutesActual > 0
                      ? `${fmtHM(s.actualMins)} (−${fmtBreakDeductionShort(s.breakMinutesActual)})`
                      : `${fmtHM(s.actualMins)} (${s.deltaMins >= 0 ? '+' : ''}${fmtHM(s.deltaMins)})`}
                  </>
                ) : (
                  <>
                    {t.ts_out_missing_short}
                    {s.breakMinutes > 0 ? (
                      <span className="mt-0.5 block font-semibold text-slate-600">
                        −{fmtBreakDeductionShort(s.breakMinutes)}
                      </span>
                    ) : null}
                  </>
                )}
              </p>
              <div className="mt-2 space-y-0.5 border-t border-[#001A80]/20 pt-2">
                <p className="text-[10px] leading-snug text-slate-600">
                  <span className="font-semibold text-slate-500">{t.ts_punch_source_row_in}</span>{' '}
                  {punchSourceLabel(s.punchInSource, t)}
                </p>
                {s.actualEnd ? (
                  <p className="text-[10px] leading-snug text-slate-600">
                    <span className="font-semibold text-slate-500">{t.ts_punch_source_row_out}</span>{' '}
                    {punchSourceLabel(s.punchOutSource, t)}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-amber-950">{t.ts_status_unpunched}</p>
              {s.breakMinutes > 0 ? (
                <p className="text-[11px] font-semibold text-slate-600">
                  −{fmtBreakDeductionShort(s.breakMinutes)}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Toggle "Deduci pausa" */}
      {!isEmployeeWeekReviewSheet &&
        fullShift &&
        canTeamTimesheetOps &&
        !isFrozen &&
        !isAbsent && (
        <label
          className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 shadow-sm transition-colors mt-4 ${
            deductBreakSaving ? 'pointer-events-none opacity-50' : ''
          } ${
            fullShift.deduct_break !== false
              ? 'border-accent/60 bg-accent/5 hover:bg-accent/10'
              : 'border-slate-300 bg-slate-50/90 hover:bg-slate-50'
          }`}
        >
          <div className="relative shrink-0 mt-0.5">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={fullShift.deduct_break !== false}
              disabled={deductBreakSaving}
              onChange={() => onDeductBreakChange(s.id, !(fullShift.deduct_break !== false))}
            />
            <div className={`h-5 w-9 rounded-full transition-colors duration-200 ${fullShift.deduct_break !== false ? 'bg-accent' : 'bg-slate-200'}`} />
            <div
              className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                fullShift.deduct_break !== false ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-semibold ${fullShift.deduct_break !== false ? 'text-accent' : 'text-slate-800'}`}>{t.deduct_break_label}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              {fullShift.deduct_break !== false
                ? tv.wst_drawer_break_deducted_readout
                : tv.wst_create_shift_no_deduct_badge}
            </p>
          </div>
        </label>
      )}
    </div>
  );
}
