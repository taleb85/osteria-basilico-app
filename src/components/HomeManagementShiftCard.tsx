/**
 * Componente estratto da HomePage.tsx per rompere la dipendenza circolare:
 *   ManagementHomePreview → HomePage → MobileStaffDashboard → SettingsPage → ProfileVisibilityHub → … → ManagementHomePreview
 *
 * Importato sia da HomePage.tsx che da ManagementHomePreview.tsx.
 */
import { Moon, Sun, LogOut as LogOutIcon, Check } from 'lucide-react';
import { it } from 'date-fns/locale';
import { safeFormatDate } from '../utils/safeDateFormat';

export interface HomeManagementShiftCardProps {
  e: {
    shift: { id: string; start_time: string; end_time?: string | null; approval_status: string; date?: string };
    user?: { first_name?: string; department?: string; role?: string } | null;
    isDinner: boolean;
    punchIn?: { id: string } | null;
    actualStart: string | null;
    actualEnd: string | null;
    scheduledStart: string;
    scheduledEnd: string;
    scheduledMins: number;
    actualMins: number;
    deltaMins: number;
    isLate: boolean;
    hasMissingOut: boolean;
    isApproved: boolean;
    canApprove: boolean;
    canClose: boolean;
  };
  style: { border: string; bg: string; badge: string; dot: string; label: string };
  isManager: boolean;
  onClose: () => void;
  onApprove: () => void;
  approvingId: string | null;
  t: Record<string, string>;
}

function fmtHM(mins: number): string {
  if (!Number.isFinite(mins)) return '—';
  if (mins === 0) return '0h';
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  const sign = mins < 0 ? '-' : '+';
  return h > 0 ? `${sign}${h}h${m > 0 ? m + 'm' : ''}` : `${sign}${m}m`;
}

/** Esportato per anteprima admin (Cosa vede chi) — stessa UI dei turni in Home gestionale. */
export function HomeManagementShiftCard({ e, style, isManager, onClose, onApprove, approvingId, t }: HomeManagementShiftCardProps) {
  const deltaColor =
    e.deltaMins > 5 ? 'text-black' : e.deltaMins < -5 ? 'text-red-500' : 'text-slate-500';
  const notPunchedLineCls = style.border.includes('[#00C896]')
    ? 'text-brand-900'
    : style.border.includes('slate-400')
      ? 'text-slate-700'
      : style.border.includes('rose-')
        ? 'text-rose-900'
        : style.border.includes('red-')
          ? 'text-red-800'
          : 'text-amber-950';

  return (
    <div className={`rounded-2xl border-l-4 ${style.border} ${style.bg} p-4 shadow-sm backdrop-blur-md`}
      style={{ 
        background: style.bg.includes('white') ? 'rgba(255, 255, 255, 0.85)' : undefined,
        backdropFilter: style.bg.includes('white') ? 'blur(12px)' : undefined,
        WebkitBackdropFilter: style.bg.includes('white') ? 'blur(12px)' : undefined,
        border: style.bg.includes('white') ? '1px solid rgba(255, 255, 255, 0.3)' : undefined,
      }}
    >
      {/* Header: avatar + name + badge */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${style.bg} border ${style.badge.split(' ')[2] ?? 'border-slate-200'} text-slate-700`}>
          {e.user?.first_name?.[0] ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{e.user?.first_name ?? '—'}</p>
          <p className="text-[10px] text-slate-500 truncate">{e.user?.department ?? e.user?.role ?? ''}</p>
          {e.shift.date && (
            <p className="text-[10px] font-semibold text-slate-500 tabular-nums">
              {safeFormatDate(e.shift.date, 'EEE d MMM', { locale: it })}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.badge}`}>{style.label}</span>
          <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-0.5">
            {e.isDinner ? <Moon className="h-2.5 w-2.5 text-amber-500" /> : <Sun className="h-2.5 w-2.5 text-amber-400" />}
            {e.isDinner ? t.dinner : t.lunch}
          </span>
        </div>
      </div>

      {/* Scheduled vs Actual - Glassmorphism */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl px-2.5 py-2"
          style={{ 
            background: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
          }}
        >
          <p className="text-[9px] text-slate-600 uppercase font-semibold mb-0.5">{t.home_label_planned}</p>
          <p className="text-sm font-bold text-black tabular-nums">{e.scheduledStart} → {e.scheduledEnd}</p>
        </div>
        <div className="rounded-xl px-2.5 py-2"
          style={{ 
            background: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
          }}
        >
          <p className="text-[9px] text-slate-600 uppercase font-semibold mb-0.5">{t.ts_label_punched}</p>
          {e.actualStart ? (
            <p className="text-sm font-bold text-black tabular-nums">
              {e.actualStart} → {e.actualEnd ?? <span className="text-red-500">…</span>}
            </p>
          ) : (
            <p className={`text-sm font-semibold italic ${notPunchedLineCls}`}>{t.home_status_not_punched}</p>
          )}
        </div>
      </div>

      {/* Delta */}
      {e.actualMins > 0 && (
        <div className={`text-[11px] font-bold mb-2 ${deltaColor}`}>
          {fmtHM(e.deltaMins)} {t.home_vs_planned}
        </div>
      )}

      {/* Actions */}
      {isManager && (
        <div className="flex gap-1.5 mt-1">
          {e.canClose && (
            <button type="button" onClick={onClose}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors">
              <LogOutIcon className="w-3.5 h-3.5" /> {t.home_btn_close_shift}
            </button>
          )}
          {e.canApprove && (
            <button type="button" onClick={onApprove} disabled={approvingId === e.shift.id}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-colors disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />
              {approvingId === e.shift.id ? '...' : t.home_btn_approve}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
