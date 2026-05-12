import { type Shift, type PunchAuditEntry } from '../types';
import { type PunchRecordLike } from '../utils/shiftResolvedClockTimes';
import { computeDrawerTimbratureDisplay, type DrawerTimbratureMode } from '../utils/weeklyShiftsHelpers';
import { useT } from '../hooks/useT';

interface ShiftDrawerTimbratureProps {
  shift: Shift;
  punchRecords: PunchRecordLike[];
  punchAudits: PunchAuditEntry[];
}

/** Rende la card "Timbrature" (punch in/out) nel drawer dettaglio turno.
 *  Mostra orari effettivi (timestamp dispositivo) o valori congelati,
 *  con etichetta che indica la modalità (dispositivo / manuale / congelato).
 */
export default function ShiftDrawerTimbrature({
  shift,
  punchRecords,
  punchAudits,
}: ShiftDrawerTimbratureProps) {
  const t = useT();
  const timbrature = computeDrawerTimbratureDisplay(shift, punchRecords, punchAudits);

  const hasIn = timbrature.inTime !== '—';
  const hasOut = timbrature.outTime !== '—';

  const timbCard =
    hasIn && hasOut
      ? 'border-2 border-l-4 border-cyan-600/25 border-l-brand-electric bg-cyan-600/8'
      : hasIn
        ? 'border-2 border-l-4 border-amber-300/80 border-l-review bg-amber-500/10'
        : 'border-2 border-l-4 border-neutral-500 border-l-white/30 bg-white/8';
  const labelCls =
    hasIn && hasOut
      ? 'text-cyan-300'
      : hasIn
        ? 'text-amber-400'
        : 'text-white/40';

  return (
    <div className={`rounded-xl p-3.5 ${timbCard}`}>
      <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${labelCls}`}>
        {t.wst_punches_section_title}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {/* ── Entrata ── */}
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/50">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${hasIn ? 'bg-cyan-600' : 'bg-white/25'}`}
              aria-hidden
            />
            {t.wst_punch_in_label}
          </p>
          <p className={`text-sm font-bold tabular-nums ${hasIn ? 'text-white' : 'text-white/40'}`}>
            {timbrature.inTime}
          </p>
          <PunchModeLabel mode={timbrature.inMode} t={t} />
        </div>

        {/* ── Uscita ── */}
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/50">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${hasOut ? 'bg-rose-500' : 'bg-white/25'}`}
              aria-hidden
            />
            {t.wst_punch_out_label}
          </p>
          <p className={`text-sm font-bold tabular-nums ${hasOut ? 'text-white' : 'text-white/40'}`}>
            {timbrature.outTime}
          </p>
          <PunchModeLabel mode={timbrature.outMode} t={t} />
        </div>
      </div>
    </div>
  );
}

// ── Sub-component: etichetta modalità ─────────────────────────────────────

function PunchModeLabel({
  mode,
  t,
}: {
  mode: DrawerTimbratureMode | null;
  t: Record<string, string>;
}) {
  if (!mode) return null;
  const cls =
    mode === 'device'
      ? 'mt-0.5 text-[11px] font-medium leading-snug text-white/50'
      : mode === 'manual'
        ? 'mt-0.5 text-[11px] font-medium leading-snug text-white/50'
        : 'mt-0.5 text-[11px] font-medium leading-snug text-cyan-300';
  const label =
    mode === 'device'
      ? t.wst_punch_mode_device
      : mode === 'manual'
        ? t.wst_punch_mode_manual
        : t.wst_punch_mode_frozen;
  return <p className={cls}>{label}</p>;
}
