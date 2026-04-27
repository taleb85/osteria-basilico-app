import { useState, useEffect } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, RotateCcw } from 'lucide-react';
import { Shift, User } from '../types';
import { calculateShiftMinutes, formatMinutesToHoursAndMinutes } from '../utils/timeCalculations';
import { getPunchPairForShift, getDefaultApprovalClockHHMM, type PunchRecordLike } from '../utils/shiftResolvedClockTimes';
import { useT } from '../hooks/useT';
import { TimeInputField } from './ui/TimeInputField';

interface ApproveShiftModalProps {
  shift: Shift;
  punchRecords: PunchRecordLike[];
  userName: string;
  onClose: () => void;
  onApprove: (shiftId: string, updatedStartTime: string, updatedEndTime: string) => void | Promise<void>;
  onRevertToPending?: (shiftId: string) => void;
  currentUser: User;
}

export default function ApproveShiftModal({ shift, punchRecords, userName, onClose, onApprove, onRevertToPending, currentUser }: ApproveShiftModalProps) {
  useBodyScrollLock(true);
  const t = useT();
  const pair = getPunchPairForShift(shift, punchRecords);
  const defaults = getDefaultApprovalClockHHMM(shift, punchRecords);
  const [startTime, setStartTime] = useState(defaults.start);
  const [endTime, setEndTime] = useState(defaults.end);

  useEffect(() => {
    const d = getDefaultApprovalClockHHMM(shift, punchRecords);
    setStartTime(d.start);
    setEndTime(d.end);
  }, [shift, punchRecords]);

  const handleApprove = async () => {
    await onApprove(shift.id, startTime, endTime);
    onClose();
  };

  const handleRevert = () => {
    if (onRevertToPending) {
      onRevertToPending(shift.id);
      onClose();
    }
  };

  const totalMinutes = calculateShiftMinutes(`${startTime}:00`, `${endTime}:00`);
  const formattedTime = formatMinutesToHoursAndMinutes(totalMinutes);
  const isAlreadyApproved = shift.approval_status === 'approved';
  const canRevertToPending = isAlreadyApproved && onRevertToPending && !['waiter', 'bartender'].includes(currentUser.role);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="modal-glass-panel flex max-h-[min(90vh,40rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-shrink-0 items-center justify-between bg-gradient-to-br from-yellow-400 to-yellow-500 p-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Check className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">{t.approve_shift}</h2>
                <p className="text-yellow-100 text-sm font-semibold">{userName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center active:bg-white/80"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-4">
              <p className="text-amber-300 text-sm font-bold mb-2">{t.check_and_edit_times}</p>
              <p className="text-amber-300/75 text-xs">
                {t.times_based_on_punches}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-white/15 bg-white/8 px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/60 mb-1">{t.home_label_planned}</p>
                <p className="font-bold tabular-nums text-white/90">
                  {pair.plannedStart} → {pair.plannedEnd}
                </p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/8 px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/60 mb-1">{t.ts_label_punched}</p>
                <p className="font-bold tabular-nums text-white/90">
                  {pair.actualStart ?? '—'} → {pair.actualEnd ?? '—'}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-white/60 font-semibold">{t.approve_shift_edit_hint}</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-white/70 text-xs font-bold uppercase tracking-wider mb-2">
                  {t.entry}
                </label>
                <TimeInputField
                  value={startTime}
                  onChange={setStartTime}
                  aria-label={t.entry}
                  className="w-full border-white/20 bg-white/10 px-2"
                />
              </div>

              <div>
                <label className="block text-white/70 text-xs font-bold uppercase tracking-wider mb-2">
                  {t.exit}
                </label>
                <TimeInputField
                  value={endTime}
                  onChange={setEndTime}
                  aria-label={t.exit}
                  className="w-full border-white/20 bg-white/10 px-2"
                />
              </div>
            </div>

            <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-center justify-between">
              <span className="text-white/80 text-sm font-bold">{t.total_hours_label}</span>
              <span className="text-accent text-2xl font-black">{formattedTime}</span>
            </div>

            {canRevertToPending && (
              <div className="mb-4 rounded-xl border border-white/15 bg-white/8 p-4">
                <p className="mb-3 text-sm font-bold text-white/90">
                  Questo turno è già approvato. Vuoi riportarlo in sospeso?
                </p>
                <button
                  type="button"
                  onClick={handleRevert}
                  className="flex w-full items-center justify-center space-x-2 rounded-xl bg-slate-700 py-3 font-black uppercase tracking-wider text-white transition-all hover:bg-slate-600 active:bg-slate-600/80"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Riporta in Sospeso</span>
                </button>
              </div>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-200 text-white/90 rounded-xl py-4 font-black uppercase tracking-wider hover:bg-slate-300 transition-all active:bg-slate-300/80"
              >
                {isAlreadyApproved ? t.close : t.cancel}
              </button>
              {!isAlreadyApproved && (
                <button
                  type="button"
                  onClick={handleApprove}
                  className="flex-1 bg-accent text-white rounded-xl py-4 font-black uppercase tracking-wider hover:bg-accent-hover transition-all flex items-center justify-center space-x-2 active:bg-accent-hover/80"
                >
                  <Check className="w-5 h-5" />
                  <span>{t.approve}</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
