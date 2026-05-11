import { useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutGrid, Clock, BarChart3, Users } from 'lucide-react';
import UnifiedShiftGrid, { type GridMode } from './UnifiedShiftGrid';
import { useT } from '../hooks/useT';
import { useApp } from '../context/AppContext';

export default function UnifiedShiftsPage() {
  const t = useT();
  const { currentUser, isSessionElevated } = useApp();
  const [gridMode, setGridMode] = useState<GridMode>('planning');

  if (!currentUser) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-[1400px] mx-auto px-4 pb-8 pt-4 font-sans"
    >
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight">
            {t.unified_grid_title ?? 'Pianificazione & Presenze'}
          </h1>
          <p className="text-sm text-white/40 mt-0.5">
            {t.unified_grid_subtitle ?? 'Turni, timbrature e confronto in un\'unica griglia'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSessionElevated && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-[10px] font-bold text-amber-300 uppercase tracking-wider">
              <Users className="h-3 w-3" />
              Admin
            </span>
          )}
        </div>
      </div>

      {/* Quick summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2 mb-1">
            <LayoutGrid className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{t.unified_planning ?? 'Planning'}</span>
          </div>
          <p className="text-lg font-black text-white tabular-nums">
            {t.unified_planning_desc ?? 'Crea e modifica turni'}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-3.5 w-3.5 text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{t.unified_realtime ?? 'Real-time'}</span>
          </div>
          <p className="text-lg font-black text-white tabular-nums">
            {t.unified_realtime_desc ?? 'Timbrature e presenze'}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{t.unified_comparison ?? 'Confronto'}</span>
          </div>
          <p className="text-lg font-black text-white tabular-nums">
            {t.unified_comparison_desc ?? 'Delta pianificato vs reale'}
          </p>
        </div>
      </div>

      {/* Unified Grid */}
      <div className="rounded-2xl border border-white/10 bg-[#0a1628]/80 p-4">
        <UnifiedShiftGrid
          mode={gridMode}
          onModeChange={setGridMode}
        />
      </div>
    </motion.div>
  );
}
