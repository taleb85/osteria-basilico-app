import { useState } from 'react';
import { X, Calendar, FileText, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { getTranslations } from '../utils/translations';

interface RequestHolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const formatDiscursiveDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = d.toLocaleString('en-US', { month: 'long' });
  const getSuffix = (n: number) => {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  return `${day}${getSuffix(day)} of ${month}`;
};

export default function RequestHolidayModal({ isOpen, onClose, userId }: RequestHolidayModalProps) {
  const { addHolidayRequest, currentUser, effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setStartDate('');
    setEndDate('');
    setReason('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addHolidayRequest({
        user_id: userId,
        start_date: startDate,
        end_date: endDate,
        type: 'ferie',
        requester_email: currentUser?.email ?? '',
        ...((reason ?? '').trim() && { reason: (reason ?? '').trim() }),
      });

      const requesterName = currentUser
        ? `${currentUser.first_name} ${currentUser.last_name}`.trim() || 'Employee'
        : 'Employee';

      const displayStart = formatDiscursiveDate(startDate);
      const displayEnd = formatDiscursiveDate(endDate);

      const mailSubject = encodeURIComponent(`Holiday Request - ${requesterName}`);
      const mailBody = encodeURIComponent(
        `Hi, hope you are well,\nI'd like to request a week of holiday that goes from the ${displayStart} until the ${displayEnd}.\nLooking forward to hear from you.\n\nKind Regards`
      );

      try {
        window.location.href = `mailto:info@osteriabasilico.co.uk?subject=${mailSubject}&body=${mailBody}`;
      } catch { /* silently ignore */ }

      handleClose();
    } catch {
      alert(t.holiday_request_send_error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm rounded-xl bg-white border border-slate-100 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-slate-900 placeholder:text-slate-500 transition-all';
  const labelCls = 'block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
        onClick={handleClose}
      >
        <motion.form
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className="card-factorial p-6 w-full max-w-md bg-white"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-slate-900 font-semibold text-base">Nuova richiesta</h3>
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  <Calendar className="w-3 h-3 inline mr-1" />Data inizio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate && e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  <Calendar className="w-3 h-3 inline mr-1" />Data fine
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  min={startDate}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>
                <FileText className="w-3 h-3 inline mr-1" />Motivazione{' '}
                <span className="text-slate-300 normal-case font-normal">(opzionale)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Es. Visita medica, ferie estive…"
                className={`${inputCls} resize-none h-20`}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !startDate || !endDate}
              className="w-full h-10 rounded-xl bg-accent text-white text-xs font-bold uppercase tracking-wider hover:bg-accent-hover transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  {t.request_holiday ?? 'Invia richiesta'}
                </>
              )}
            </button>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  );
}
