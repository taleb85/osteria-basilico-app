import { it } from 'date-fns/locale';
import { Palmtree, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { HolidayRequest } from '../../types';
import { safeFormatDate } from '../../utils/safeDateFormat';

interface MobileRequestListProps {
  requests: HolidayRequest[];
  t?: Record<string, string>;
}

export default function MobileRequestList({ requests, t = {} }: MobileRequestListProps) {
  const locale = it;

  const STATUS_CONFIG = {
    approved: {
      label: t.holiday_status_approved ?? 'Approvata',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/30',
    },
    pending: {
      label: t.holiday_status_pending ?? 'In attesa',
      icon: AlertCircle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/15',
      border: 'border-amber-500/30',
    },
    rejected: {
      label: t.holiday_status_rejected ?? 'Rifiutata',
      icon: XCircle,
      color: 'text-red-400',
      bg: 'bg-red-500/15',
      border: 'border-red-500/30',
    },
  } as const;

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
          <Palmtree className="w-8 h-8 text-white/50" />
        </div>
        <p className="text-white/60 font-medium">{t.no_requests_made ?? 'Nessuna richiesta effettuata'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 pb-content">
      {requests.map((req) => {
        const config = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
        const Icon = config.icon;
        
        return (
          <div 
            key={req.id}
            className="rounded-3xl p-5 border border-white/10 flex flex-col gap-4" style={{ background: 'rgba(255, 255, 255, 0.16)' }}
          >
            <div className="flex justify-between items-start">
              <div className="flex flex-col">
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-1">
                  Richiesta del {safeFormatDate(req.created_at, 'd MMM yyyy', { locale })}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-white">
                    {safeFormatDate(req.start_date, 'd MMM', { locale })} – {safeFormatDate(req.end_date, 'd MMM', { locale })}
                  </p>
                </div>
              </div>
              
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${config.bg} ${config.border} ${config.color}`}>
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[11px] font-black uppercase tracking-wider">
                  {config.label}
                </span>
              </div>
            </div>

            {req.reason && (
              <div className="pt-3 border-t border-white/10">
                <p className="text-xs text-white/60 leading-relaxed italic">
                  "{req.reason}"
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
