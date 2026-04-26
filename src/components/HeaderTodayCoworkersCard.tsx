import { useMemo } from 'react';
import { format, isValid } from 'date-fns';
import { Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useT } from '../hooks/useT';
import { getTranslations, formatTrans } from '../utils/translations';
import { isUserVisibleOnTeamSchedule } from '../utils/permissions';
import {
  readProfileAvatarFromStorage,
  readAvatarFocus,
  avatarFocusToObjectPosition,
} from '../utils/profilePhotoStorage';
import type { Shift } from '../types';

function startMinutes(s: Shift): number {
  const t = (s.start_time || '00:00').slice(0, 5);
  const [hs, ms] = t.split(':');
  const h = parseInt(hs || '0', 10);
  const m = parseInt(ms || '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** Inizio strettamente dopo le 16:00 → cambio guardia (es. 16:01–23:59). */
function isCambioGuardiaShift(s: Shift): boolean {
  return startMinutes(s) > 16 * 60;
}

/** Allinea al tabellone: tipo da `shift.type`, altrimenti da ora di inizio (solo turni “di giorno”). */
function effectiveShiftType(s: Shift): 'lunch' | 'dinner' {
  if (s.type === 'lunch' || s.type === 'dinner') return s.type;
  const h = parseInt((s.start_time || '12:00').slice(0, 2), 10);
  return !Number.isNaN(h) && h >= 17 ? 'dinner' : 'lunch';
}

function lunchDinnerRingClass(shifts: Shift[]): string {
  const types = new Set(shifts.map(effectiveShiftType));
  const hasL = types.has('lunch');
  const hasD = types.has('dinner');
  if (hasL && hasD) {
    return 'bg-brand-500';
  }
  if (hasD) {
    return 'bg-violet-500';
  }
  return 'bg-amber-500';
}

/** Anello: pranzo/cena (turni ≤16:00) + viola per cambio guardia (>16:00). */
function shiftRingOuterClass(shifts: Shift[]): string {
  if (shifts.length > 1) {
    return 'bg-brand-500';
  }
  const early = shifts.filter((s) => !isCambioGuardiaShift(s));
  const late = shifts.filter((s) => isCambioGuardiaShift(s));
  if (late.length === 0) {
    return lunchDinnerRingClass(early.length ? early : shifts);
  }
  if (early.length === 0) {
    return 'bg-violet-500';
  }
  return 'bg-brand-500';
}

function shiftRingTitle(
  shifts: Shift[],
  lunchLabel: string,
  dinnerLabel: string,
  cambioLabel: string
): string {
  const early = shifts.filter((s) => !isCambioGuardiaShift(s));
  const late = shifts.filter((s) => isCambioGuardiaShift(s));
  const parts: string[] = [];
  if (early.length) {
    const types = new Set(early.map(effectiveShiftType));
    if (types.has('lunch') && types.has('dinner')) {
      parts.push(`${lunchLabel} + ${dinnerLabel}`);
    } else if (types.has('dinner')) {
      parts.push(dinnerLabel);
    } else {
      parts.push(lunchLabel);
    }
  }
  if (late.length) {
    parts.push(cambioLabel);
  }
  return parts.join(' · ');
}

type Row = { userId: string; name: string; shifts: Shift[] };

function shiftTimeCaption(shifts: Shift[], multiLabel: string): string {
  if (shifts.length === 0) return '';
  if (shifts.length === 1) {
    const s = shifts[0];
    const a = (s.start_time || '').slice(0, 5);
    const b = (s.end_time || '').slice(0, 5);
    return a && b ? `${a}–${b}` : a || b || '—';
  }
  return multiLabel.replace('{n}', String(shifts.length));
}

/**
 * Striscia sotto l’header: titolo e subito dopo l’elenco orizzontale colleghi in turno oggi.
 */
export default function HeaderTodayCoworkersCard() {
  const { currentUser, shifts, users, punchRecords, effectiveLanguage, featureFlags } = useApp();
  const t = useT();
  const tv = t as Record<string, string>;

  const isVisibleByAdmin = featureFlags?.visibility_management !== false;

  const rows = useMemo(() => {
    if (!currentUser || !isVisibleByAdmin) return [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const byUser = new Map<string, Shift[]>();
    for (const s of shifts) {
      if (s.date !== todayStr) continue;
      if (s.approval_status === 'absent') continue;
      if (s.approval_status !== 'approved' && s.approval_status !== 'confirmed') continue;
      if (s.notes?.startsWith('__OPEN__')) continue;
      if (s.user_id === currentUser.id) continue;
      const u = users.find((x) => x.id === s.user_id);
      if (!u || !isUserVisibleOnTeamSchedule(u)) continue;
      const list = byUser.get(s.user_id) ?? [];
      list.push(s);
      byUser.set(s.user_id, list);
    }
    const out: Row[] = [];
    for (const [userId, list] of byUser) {
      const u = users.find((x) => x.id === userId);
      if (!u) continue;
      const sorted = [...list].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      const name = (u.first_name ?? '').trim() || u.email?.split('@')[0] || '—';
      out.push({ userId, name, shifts: sorted });
    }
    out.sort((a, b) => {
      const aStart = a.shifts[0]?.start_time || '99:99';
      const bStart = b.shifts[0]?.start_time || '99:99';
      return aStart.localeCompare(bStart);
    });
    return out;
  }, [currentUser, shifts, users]);

  const getPunchForShift = (shiftId: string, userId: string, dateStr: string, isLunchShift: boolean) => {
    const punchIn = punchRecords.find((p) => {
      if (p.type !== 'in') return false;
      if (shiftId && p.shift_id) return p.shift_id === shiftId;
      if (p.user_id !== userId) return false;
      const d = new Date(p.timestamp);
      if (!isValid(d)) return false;
      return format(d, 'yyyy-MM-dd') === dateStr && (isLunchShift ? d.getHours() < 16 : d.getHours() >= 16);
    });
    const punchOut = punchRecords.find((p) => {
      if (p.type !== 'out') return false;
      if (shiftId && p.shift_id) return p.shift_id === shiftId;
      if (p.user_id !== userId) return false;
      const d = new Date(p.timestamp);
      if (!isValid(d)) return false;
      return format(d, 'yyyy-MM-dd') === dateStr && (isLunchShift ? d.getHours() < 16 : d.getHours() >= 16);
    });
    return { punchIn, punchOut };
  };

  if (!currentUser || !isVisibleByAdmin) return null;

  const title = tv.header_coworkers_today_title ?? 'In turno oggi';
  const empty = tv.header_coworkers_today_empty ?? 'Nessun altro collega in turno oggi';
  const summaryTpl = tv.header_coworkers_today_summary ?? '{n}';
  const lunchL = t.lunch ?? 'Pranzo';
  const dinnerL = t.dinner ?? 'Cena';
  const cambioL = tv.header_coworkers_cambio_guardia ?? 'Cambio guardia';
  const multiShiftsTpl = tv.header_coworkers_multi_shifts ?? '{n} turni';

  return (
    <section className="w-full px-3 py-2 sm:px-4 sm:py-3" aria-label={title}>
      {rows.length === 0 ? (
        <div className="flex items-start gap-1.5 px-1">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/60" strokeWidth={2} aria-hidden />
          <p className="min-w-0 text-[11px] leading-snug text-white/60">{empty}</p>
        </div>
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] font-bold text-white/60 uppercase tracking-widest">
              <span className="text-white/60 mr-1">
                {formatTrans(summaryTpl, { n: String(rows.length) })}
              </span>
              · {title}
            </p>
          </div>

          <ul
            id="header-coworkers-today-list"
            aria-label={title}
            className="smooth-scroll flex min-w-0 flex-1 flex-nowrap gap-4 overflow-x-auto overscroll-contain pb-2 no-scrollbar"
          >
            {rows.map((r) => {
              const u = users.find((x) => x.id === r.userId);
              const avatarSrc =
                (u && (readProfileAvatarFromStorage(r.userId) ?? u.avatar_url ?? null)) || null;
              const focus = readAvatarFocus(r.userId);
              const initial = (r.name.charAt(0) || '?').toUpperCase();
              const ringTitle = shiftRingTitle(r.shifts, lunchL, dinnerL, cambioL);
              const timeCaption = shiftTimeCaption(r.shifts, multiShiftsTpl);
              const isPunchedIn = r.shifts.some(s => {
                const isDinner = effectiveShiftType(s) === 'dinner';
                const { punchIn, punchOut } = getPunchForShift(s.id, s.user_id, format(new Date(), 'yyyy-MM-dd'), !isDinner);
                return !!punchIn && !punchOut;
              });

              return (
                <li
                  key={r.userId}
                  className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 text-center"
                >
                  <div
                    className="relative shrink-0 rounded-xl surface-glass-sm"
                    title={`${ringTitle}${timeCaption ? ` · ${timeCaption}` : ''}`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-slate-50">
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt=""
                          role="presentation"
                          className="h-full w-full object-cover"
                          style={{ objectPosition: avatarFocusToObjectPosition(focus) }}
                          draggable={false}
                        />
                      ) : (
                        <span className="text-lg font-bold text-white/60" aria-hidden>
                          {initial}
                        </span>
                      )}
                    </div>
                    {/* Shift Type Indicator */}
                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full shadow-sm z-10 ${shiftRingOuterClass(r.shifts)}`}></div>
                    {isPunchedIn && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-brand-500 border-2 border-white rounded-full shadow-sm z-10"></div>
                    )}
                  </div>
                  <div className="min-w-0 w-full px-0.5">
                    <span className="block truncate text-[11px] font-black uppercase tracking-tight text-white/60" title={r.name}>{r.name}
                    </span>
                    {timeCaption ? (
                      <span className="block truncate text-[11px] font-bold tabular-nums text-white/60 mt-0.5" title={timeCaption}>{timeCaption}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
