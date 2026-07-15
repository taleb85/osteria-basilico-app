import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import UnifiedShiftGrid from './UnifiedShiftGrid';
import { useT } from '../hooks/useT';
import { useAppUser } from '../context/AppContext';

export default function UnifiedShiftsPage() {
  const t = useT();
  const { currentUser, isSessionElevated } = useAppUser();

  if (!currentUser) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full mx-auto px-4 pb-6 pt-3 font-sans"
    >
      {/* Admin badge */}
      {isSessionElevated && (
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[9px] font-bold text-amber-300 uppercase tracking-wider">
            <Users className="h-2.5 w-2.5" />
            Admin
          </span>
        </div>
      )}

      {/* Unified Grid */}
      <div className="rounded-xl border border-white/10 bg-transparent p-3 shadow-sm">
        <UnifiedShiftGrid
          mode="realtime"
          onModeChange={() => {}}
        />
      </div>
    </motion.div>
  );
}
