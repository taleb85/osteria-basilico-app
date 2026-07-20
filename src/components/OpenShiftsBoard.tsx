import { useState, useEffect } from 'react';
import { Calendar, Clock, UserPlus, AlertCircle } from 'lucide-react';
import { getOpenShifts, claimOpenShift, releaseOpenShift, type OpenShift } from '../utils/openShifts';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

interface OpenShiftsBoardProps {
  tenantId: string;
  currentUserId: string;
  canRelease?: boolean;
}

export default function OpenShiftsBoard({ tenantId, currentUserId, canRelease }: OpenShiftsBoardProps) {
  const [shifts, setShifts] = useState<OpenShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadShifts(); }, [tenantId]);

  const loadShifts = async () => {
    setLoading(true);
    const data = await getOpenShifts(tenantId);
    setShifts(data);
    setLoading(false);
  };

  const handleClaim = async (shiftId: string) => {
    setError('');
    setSuccess('');
    setClaimingId(shiftId);
    const result = await claimOpenShift(shiftId, currentUserId);
    setClaimingId(null);
    if (result.ok) {
      setSuccess('Turno assegnato!');
      setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    } else {
      setError(result.error);
      setShifts((prev) => prev.filter((s) => s.id !== shiftId));
    }
  };

  const handleRelease = async (shiftId: string) => {
    setError('');
    setSuccess('');
    await releaseOpenShift(shiftId);
    setSuccess('Turno rilasciato');
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
  };

  const fmtDate = (d: string) => {
    try { return format(parseISO(d), 'EEE d MMM', { locale: it }); } catch { return d; }
  };

  if (loading) {
    return <div className="py-8 text-center text-[11px] text-white/50">Caricamento turni aperti…</div>;
  }

  if (shifts.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-[11px] text-white/40">Nessun turno aperto disponibile</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/15 px-3 py-2 text-[11px] text-red-300">
          <AlertCircle className="h-3 w-3 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[11px] text-emerald-300">{success}</div>
      )}
      {shifts.map((shift) => (
        <div key={shift.id}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <div className="flex shrink-0 flex-col items-center justify-center rounded-lg bg-accent/20 px-2.5 py-1.5">
            <Calendar className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">{fmtDate(shift.date)}</span>
              {shift.department && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">{shift.department}</span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/60">
              <Clock className="h-3 w-3" />
              {shift.start_time?.slice(0, 5)}–{shift.end_time?.slice(0, 5)}
              {shift.skills && <span className="text-white/40">· {shift.skills}</span>}
            </div>
          </div>
          <button
            type="button"
            disabled={claimingId === shift.id}
            onClick={() => handleClaim(shift.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {claimingId === shift.id ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <UserPlus className="h-3 w-3" />
            )}
            Prendi
          </button>
          {canRelease && (
            <button type="button" onClick={() => handleRelease(shift.id)}
              className="text-[10px] text-red-400 hover:text-red-300 transition-colors">
              Rilascia
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
