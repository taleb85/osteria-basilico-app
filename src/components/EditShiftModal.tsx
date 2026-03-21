import { useState } from 'react';
import { X, Save, Copy, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { Shift } from '../types';
import { format, addDays, parseISO } from 'date-fns';
import { getTranslations } from '../utils/translations';
import { hasShiftConflictSameDay } from '../utils/timeCalculations';

interface EditShiftModalProps {
  shift: Shift;
  onClose: () => void;
}

/** Normalizza a HH:mm. Non usa new Date(). */
function toHHmm(val: string): string {
  const trimmed = (val || '').trim().slice(0, 5);
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) return trimmed;
  if (trimmed.length >= 4) return `${trimmed.slice(0, 2).padStart(2, '0')}:${trimmed.slice(-2)}`;
  return trimmed || '';
}

export default function EditShiftModal({ shift, onClose }: EditShiftModalProps) {
  const { users, shifts, updateShift, deleteShift, copyShift, effectiveLanguage, showError } = useApp();
  const t = getTranslations(effectiveLanguage);
  const [tempShifts, setTempShifts] = useState({
    start_time: (shift.start_time || '').trim().slice(0, 5),
    end_time: (shift.end_time || '').trim().slice(0, 5),
    date: shift.date,
    user_id: shift.user_id,
    type: shift.type,
    approval_status: shift.approval_status,
  });

  const user = users.find((u) => u.id === shift.user_id);

  const handleSave = () => {
    const startNorm = toHHmm(tempShifts.start_time);
    const endNorm = toHHmm(tempShifts.end_time);
    if (!startNorm) return;
    const finalUserId = tempShifts.user_id ?? shift.user_id;
    const finalDate = tempShifts.date ?? shift.date;
    const others = shifts.filter(s => s.id !== shift.id && s.user_id === finalUserId && s.date === finalDate);
    if (others.length >= 2) {
      showError(t.max_two_shifts_same_day);
      return;
    }
    if (hasShiftConflictSameDay(others, { start_time: startNorm, end_time: endNorm })) {
      showError(t.shift_overlap_same_day);
      return;
    }
    updateShift(shift.id, {
      start_time: startNorm,
      end_time: endNorm,
      date: tempShifts.date,
    });
    onClose();
  };

  const handleDelete = () => {
    if (confirm(t.delete_shift_confirm)) {
      deleteShift(shift.id);
      onClose();
    }
  };

  const handleCopy = () => {
    const nextDay = format(addDays(parseISO(shift.date), 1), 'yyyy-MM-dd');
    copyShift(shift, nextDay);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-[#1a1a1a] rounded-[40px] w-full max-w-lg border border-slate-200 dark:border-white/5 overflow-hidden"
        >
          <div className="bg-accent p-6 relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <h2 className="text-white text-2xl font-black uppercase tracking-wider">
              {t.edit_shift}
            </h2>
            <p className="text-white/80 text-sm mt-1">
              <span className="uppercase">{user?.first_name}</span>
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="text-slate-600 dark:text-gray-400 text-xs uppercase tracking-[0.2em] font-bold mb-2 block">
                Data
              </label>
              <input
                type="date"
                value={tempShifts.date}
                onChange={(e) => setTempShifts((s) => ({ ...s, date: e.target.value }))}
                className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 focus:border-accent outline-none font-bold text-slate-900 dark:text-gray-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-600 dark:text-gray-400 text-xs uppercase tracking-[0.2em] font-bold mb-2 block">
                  {t.start}
                </label>
                <input
                  type="time"
                  value={tempShifts.start_time}
                  onChange={(e) => setTempShifts((s) => ({ ...s, start_time: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 focus:border-accent outline-none font-bold text-slate-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="text-slate-600 dark:text-gray-400 text-xs uppercase tracking-[0.2em] font-bold mb-2 block">
                  Fine {!tempShifts.end_time && <span className="text-amber-600">(da completare)</span>}
                </label>
                <input
                  type="time"
                  value={tempShifts.end_time}
                  onChange={(e) => setTempShifts((s) => ({ ...s, end_time: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 focus:border-accent outline-none font-bold text-slate-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleSave}
                className="flex-1 bg-accent text-white rounded-2xl py-4 font-black uppercase tracking-wider flex items-center justify-center space-x-2 hover:bg-accent-hover hover:shadow-lg transition-shadow"
              >
                <Save className="w-5 h-5" />
                <span>{t.save}</span>
              </button>
              <button
                onClick={handleCopy}
                className="w-14 h-14 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                <Copy className="w-5 h-5 text-slate-700 dark:text-gray-100" />
              </button>
              <button
                onClick={handleDelete}
                className="w-14 h-14 bg-red-900/20 rounded-2xl flex items-center justify-center hover:bg-red-900/30 transition-colors border border-red-500/30"
              >
                <Trash2 className="w-5 h-5 text-red-400" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
