import { useMemo } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations, getDateLocale, formatTrans } from '../utils/translations';
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
    return 'bg-gradient-to-br from-emerald-500 to-amber-500 shadow-sm dark:from-emerald-400 dark:to-amber-400';
  }
  if (hasD) {
    return 'bg-amber-500 shadow-sm dark:bg-amber-400';
  }
  return 'bg-emerald-500 shadow-sm dark:bg-emerald-400';
}

/** Anello: pranzo/cena (turni ≤16:00) + viola per cambio guardia (>16:00). */
function shiftRingOuterClass(shifts: Shift[]): string {
  const early = shifts.filter((s) => !isCambioGuardiaShift(s));
  const late = shifts.filter((s) => isCambioGuardiaShift(s));
  if (late.length === 0) {
    return lunchDinnerRingClass(early.length ? early : shifts);
  }
  if (early.length === 0) {
    return 'bg-violet-500 shadow-sm dark:bg-violet-400';
  }
  const types = new Set(early.map(effectiveShiftType));
  const hasL = types.has('lunch');
  const hasD = types.has('dinner');
  if (hasL && hasD) {
    return 'bg-gradient-to-br from-emerald-500 via-amber-500 to-violet-600 shadow-sm dark:from-emerald-400 dark:via-amber-400 dark:to-violet-500';
  }
  if (hasD) {
    return 'bg-gradient-to-br from-amber-500 to-violet-600 shadow-sm dark:from-amber-400 dark:to-violet-500';
  }
  return 'bg-gradient-to-br from-emerald-500 to-violet-600 shadow-sm dark:from-emerald-400 dark:to-violet-500';
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
 * Striscia sotto l’header: titolo + data e subito dopo l’elenco orizzontale colleghi in turno oggi.
 */
export default function HeaderTodayCoworkersCard() {
  const { currentUser, shifts, users, effectiveLanguage } = useApp();
  const t = getTranslations(effectiveLanguage);
  const tv = t as Record<string, string>;
  const dateLoc = getDateLocale(effectiveLanguage) ?? it;

  const rows = useMemo(() => {
    if (!currentUser) return [];
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
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return out;
  }, [currentUser, shifts, users]);

  if (!currentUser) return null;

  const title = tv.header_coworkers_today_title ?? 'In turno oggi';
  const empty = tv.header_coworkers_today_empty ?? 'Nessun altro collega in turno oggi';
  const todayShort = format(new Date(), 'EEE d MMM', { locale: dateLoc });
  const summaryTpl = tv.header_coworkers_today_summary ?? '{n}';
  const lunchL = t.lunch ?? 'Pranzo';
  const dinnerL = t.dinner ?? 'Cena';
  const cambioL = tv.header_coworkers_cambio_guardia ?? 'Cambio guardia';
  const multiShiftsTpl = tv.header_coworkers_multi_shifts ?? '{n} turni';

  return (
    <section className="w-full px-2 py-1 sm:px-2.5 sm:py-1.5" aria-label={title}>
      {rows.length === 0 ? (
        <div className="flex items-start gap-1.5">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent/70" strokeWidth={2} aria-hidden />
          <p className="min-w-0 text-[11px] leading-snug text-slate-500 dark:text-neutral-400">{empty}</p>
        </div>
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 shrink-0 items-start gap-2 sm:items-center">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent sm:mt-0 dark:bg-accent/15">
              <Users className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-neutral-500">{title}</p>
              <p className="mt-0.5 text-[11px] text-slate-700 dark:text-neutral-200">
                <span className="font-semibold tabular-nums">
                  {formatTrans(summaryTpl, { n: String(rows.length) })}
                </span>
                <span className="font-normal text-slate-400 dark:text-neutral-500"> · </span>
                <span className="capitalize text-slate-500 dark:text-neutral-400">{todayShort}</span>
              </p>
            </div>
          </div>

          <ul
            id="header-coworkers-today-list"
            aria-label={title}
            className="smooth-scroll flex min-w-0 flex-1 flex-nowrap gap-3.5 overflow-x-auto overscroll-contain pb-1 sm:border-l sm:border-slate-100 sm:pl-3 dark:sm:border-white/10"
          >
            {rows.map((r) => {
              const u = users.find((x) => x.id === r.userId);
              const avatarSrc =
                (u && (readProfileAvatarFromStorage(r.userId) ?? u.avatar_url ?? null)) || null;
              const focus = readAvatarFocus(r.userId);
              const initial = (r.name.charAt(0) || '?').toUpperCase();
              const ringTitle = shiftRingTitle(r.shifts, lunchL, dinnerL, cambioL);
              const timeCaption = shiftTimeCaption(r.shifts, multiShiftsTpl);
              return (
                <li
                  key={r.userId}
                  className="flex w-[4.85rem] shrink-0 flex-col items-center gap-0.5 text-center sm:w-[5.25rem]"
                >
                  <div
                    className={`shrink-0 rounded-lg p-[2.5px] ${shiftRingOuterClass(r.shifts)}`}
                    title={`${ringTitle}${timeCaption ? ` · ${timeCaption}` : ''}`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[0.4rem] bg-slate-100 dark:bg-neutral-800 sm:h-11 sm:w-11">
                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt=""
                          className="h-full w-full object-cover"
                          style={{ objectPosition: avatarFocusToObjectPosition(focus) }}
                          draggable={false}
                        />
                      ) : (
                        <span className="text-sm font-bold text-slate-500 dark:text-neutral-400" aria-hidden>
                          {initial}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="block w-full truncate text-[9px] font-semibold uppercase leading-tight tracking-wide text-slate-800 dark:text-neutral-100 sm:text-[10px]">
                    {r.name}
                  </span>
                  {timeCaption ? (
                    <span className="block w-full truncate text-[8px] font-semibold tabular-nums text-slate-500 dark:text-neutral-400">
                      {timeCaption}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
