import { useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Clock, Users } from 'lucide-react';
import UnifiedShiftGrid, { type GridMode } from './UnifiedShiftGrid';
import { useT } from '../hooks/useT';
import { useAppUser } from '../context/AppContext';

export default function UnifiedShiftsPage() {
  const t = useT();
  const { currentUser, isSessionElevated } = useAppUser();
  const [gridMode, setGridMode] = useState<GridMode>('planning');

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

      {/* Quick summary — interattive: clicca per cambiare modalità */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button type="button" onClick={() => setGridMode('planning')}
          className={`rounded-lg border p-2 text-left transition-all ${
            gridMode === 'planning'
              ? 'border-cyan-400/40 bg-cyan-500/10 backdrop-blur-sm'
              : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
          }`}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <LayoutGrid className="h-3 w-3 text-cyan-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">{t.unified_planning ?? 'Planning'}</span>
          </div>
          <p className="text-xs font-bold text-white/70">
            {t.unified_planning_desc ?? 'Crea e modifica turni'}
          </p>
        </button>
        <button type="button" onClick={() => setGridMode('realtime')}
          className={`rounded-lg border p-2 text-left transition-all ${
            gridMode === 'realtime'
              ? 'border-accent/40 bg-accent/10 backdrop-blur-sm'
              : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
          }`}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Clock className="h-3 w-3 text-accent" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">{t.unified_realtime ?? 'Real-time'}</span>
          </div>
          <p className="text-xs font-bold text-white/70">
            {t.unified_realtime_desc ?? 'Timbrature e presenze'}
          </p>
        </button>
      </div>

      {/* Unified Grid */}
      <div className={`rounded-xl border bg-transparent p-3 transition-all ${
        gridMode === 'planning'
          ? 'border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.12)]'
          : 'border-accent/30'
      }`}>
        <UnifiedShiftGrid
          mode={gridMode}
          onModeChange={setGridMode}
        />
      </div>
    </motion.div>
  );
}
