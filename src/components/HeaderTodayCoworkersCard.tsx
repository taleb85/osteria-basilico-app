import { useMemo } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslations, getDateLocale } from '../utils/translations';
import { isUserVisibleOnTeamSchedule } from '../utils/permissions';
import type { Shift } from '../types';

function timeSlotLabel(s: Shift): string {
  const a = (s.start_time || '').slice(0, 5);
  const b = (s.end_time || '').slice(0, 5);
  if (!a) return '';
  return b ? `${a}–${b}` : a;
}

/**
 * Scheda sotto l’header: colleghi con turno pubblicato oggi (stesso giorno del calendario locale).
 */
export default function HeaderTodayCoworkersCard() {
  const { currentUser, shifts, users, effectiveLanguage } = useApp();
  const tv = getTranslations(effectiveLanguage) as Record<string, string>;
  const dateLoc = getDateLocale(effectiveLanguage) ?? it;

  const rows = useMemo(() => {
    if (!currentUser) return [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const byUser = new Map<string, Shift[]>();
    for (const s of shifts) {
      if (s.date !== todayStr) continue;
      if (s.approval_status !== 'approved' && s.approval_status !== 'confirmed') continue;
      if (s.notes?.startsWith('__OPEN__')) continue;
      if (s.user_id === currentUser.id) continue;
      const u = users.find((x) => x.id === s.user_id);
      if (!u || !isUserVisibleOnTeamSchedule(u)) continue;
      const list = byUser.get(s.user_id) ?? [];
      list.push(s);
      byUser.set(s.user_id, list);
    }
    const out: { userId: string; name: string; slots: string }[] = [];
    for (const [userId, list] of byUser) {
      const u = users.find((x) => x.id === userId);
      if (!u) continue;
      const sorted = [...list].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
      const slots = sorted.map(timeSlotLabel).filter(Boolean).join(' · ');
      const name = (u.first_name ?? '').trim() || u.email?.split('@')[0] || '—';
      out.push({ userId, name, slots });
    }
    out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return out;
  }, [currentUser, shifts, users]);

  if (!currentUser) return null;

  const title = tv.header_coworkers_today_title ?? 'In turno oggi';
  const empty = tv.header_coworkers_today_empty ?? 'Nessun altro collega in turno oggi';
  const todayLabel = format(new Date(), 'EEEE d MMMM', { locale: dateLoc });

  return (
    <section className="w-full px-3 py-2.5 sm:px-3.5" aria-label={title}>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Users className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">{title}</p>
          <p className="truncate text-[10px] text-slate-400 dark:text-neutral-500 capitalize" title={todayLabel}>
            {todayLabel}
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="pl-10 text-xs leading-snug text-slate-500 dark:text-neutral-400">{empty}</p>
      ) : (
        <ul className="max-h-[min(40vh,220px)] space-y-2 overflow-y-auto overscroll-contain pl-10 pr-0.5 smooth-touch">
          {rows.map((r) => (
            <li key={r.userId} className="flex min-w-0 flex-col gap-0.5 border-b border-slate-100/90 dark:border-white/10 pb-2 last:border-0 last:pb-0">
              <span className="truncate text-xs font-semibold uppercase tracking-wide text-slate-800 dark:text-neutral-100">{r.name}</span>
              {r.slots ? (
                <span className="font-mono text-[11px] tabular-nums text-slate-600 dark:text-neutral-400">{r.slots}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
