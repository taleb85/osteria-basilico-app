import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { User, Shift } from '../types';
import { format } from 'date-fns';
import { calculateRoundedPunchTime } from '../utils/timeCalculations';
import { database } from '../lib/database';
import { getTranslations } from '../utils/translations';

interface StaffKioskViewProps {
  user: User;
  onClose: () => void;
}

export default function StaffKioskView({ user, onClose }: StaffKioskViewProps) {
  const { shifts, punchRecords, effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);
  const [showSuccess, setShowSuccess] = useState(false);
  const [punchedTime, setPunchedTime] = useState('');
  const [calculatedTime, setCalculatedTime] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayShifts = shifts.filter(
    (shift) => shift.user_id === user.id && shift.date === today
  );

  const getShiftPunchStatus = (shift: Shift) => {
    const shiftHour = parseInt(shift.start_time.split(':')[0]);
    const isLunchShift = shiftHour < 16;

    const relevantPunches = punchRecords.filter((record) => {
      if (record.user_id !== user.id || record.type !== 'in') return false;
      if (format(new Date(record.timestamp), 'yyyy-MM-dd') !== today) return false;

      const punchHour = parseInt(format(new Date(record.timestamp), 'HH'));
      const isPunchDuringLunch = punchHour < 16;
      return isLunchShift === isPunchDuringLunch;
    });

    const hasPunchIn = relevantPunches.length > 0;
    return { hasPunchIn, isCompleted: hasPunchIn };
  };

  const handlePunchIn = async (shift: Shift) => {
    const actualTime = new Date();
    const roundedTime = calculateRoundedPunchTime(actualTime, shift.start_time);

    await database.punchRecords.insert({
      user_id: user.id,
      type: 'in',
      timestamp: actualTime.toISOString(),
      shift_id: shift.id,
    });

    const actualTimeStr = format(actualTime, 'HH:mm');
    const roundedTimeStr = format(roundedTime, 'HH:mm');

    setPunchedTime(actualTimeStr);
    setCalculatedTime(roundedTimeStr);
    setShowSuccess(true);

    setTimeout(() => {
      onClose();
    }, 2000);
  };

  useEffect(() => {
    if (todayShifts.length === 0) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [todayShifts.length, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-100 z-50 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-2xl">
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-24 h-24 bg-gradient-to-br from-accent to-accent-dark rounded-xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-accent/25"
            >
              <Clock className="w-12 h-12 text-white" strokeWidth={2.5} />
            </motion.div>
            <h1 className="text-4xl font-black text-gray-900 mb-2">
              {t.welcome_greeting} <span className="uppercase">{user.first_name}</span>
            </h1>
            <p className="text-gray-500 text-sm uppercase tracking-widest font-semibold">
              {t.punch_title_kiosk}
            </p>
          </div>

          {todayShifts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="surface-glass p-12 text-center"
            >
              <p className="text-2xl font-bold text-gray-900 mb-6">
                {t.no_shift_today}
              </p>
              <p className="text-gray-500 mb-8">
                {t.auto_return_seconds}
              </p>
              <button
                onClick={onClose}
                className="bg-gray-900 text-white rounded-2xl px-8 py-4 font-bold uppercase tracking-wider hover:bg-black transition-all"
              >
                {t.logout}
              </button>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {todayShifts.map((shift, index) => {
                const status = getShiftPunchStatus(shift);
                return (
                  <motion.div
                    key={shift.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="surface-glass p-8"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2">
                          {shift.type === 'lunch' ? t.lunch.toUpperCase() : t.dinner.toUpperCase()}
                        </h3>
                        <p className="text-gray-600 font-semibold text-lg">
                          {t.expected_time} {shift.start_time} - {shift.end_time}
                        </p>
                      </div>
                      <button
                        onClick={() => handlePunchIn(shift)}
                        disabled={status.hasPunchIn}
                        className={`px-8 py-4 rounded-2xl font-black uppercase tracking-wider transition-all shadow-lg ${
                          status.hasPunchIn
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-accent text-white hover:bg-accent-hover hover:-translate-y-0.5 shadow-accent/25'
                        }`}
                      >
                        {status.hasPunchIn ? t.entry_ok : t.entry_btn}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-6 w-full bg-gray-900 text-white rounded-2xl py-4 font-bold uppercase tracking-wider hover:bg-black transition-all flex items-center justify-center space-x-2"
          >
            <X className="w-5 h-5" />
            <span>Chiudi</span>
          </button>
        </motion.div>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm dark:bg-black/60"
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="modal-glass-panel max-w-md rounded-2xl p-12 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="w-24 h-24 bg-accent rounded-xl mx-auto mb-6 flex items-center justify-center"
              >
                <CheckCircle className="w-16 h-16 text-white" strokeWidth={2.5} />
              </motion.div>
              <h2 className="text-3xl font-black text-gray-900 mb-3">
                {t.entry_registered}
              </h2>
              <p className="text-xl text-gray-600 font-semibold mb-2">
                {t.registered_at} {punchedTime}
              </p>
              {punchedTime !== calculatedTime && (
                <p className="text-base text-accent font-bold mb-2">
                  {t.hours_calc_from}: {calculatedTime}
                </p>
              )}
              <p className="text-lg text-accent font-bold">
                {t.good_work_comma} <span className="uppercase">{user.first_name}</span>!
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
