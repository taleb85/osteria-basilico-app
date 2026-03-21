import { format, parseISO, subDays, startOfWeek, endOfWeek } from 'date-fns';
import type { Language, User, Shift, HolidayRequest } from '../types';
import { isManagementRole } from './permissions';
import { formatTrans, getDateLocale } from './translations';

/** Se il manager ha un reparto, limita notifiche ai dipendenti dello stesso reparto (stesso `user.department`). Senza reparto = tutti. */
function matchesManagerDepartment(manager: User, employeeUserId: string, users: User[]): boolean {
  const md = manager.department?.trim();
  if (!md) return true;
  const u = users.find((x) => x.id === employeeUserId);
  const ed = u?.department?.trim();
  if (!ed) return true;
  return ed === md;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotifType =
  | 'new_shift'
  | 'holiday_pending'
  | 'holiday_approved'
  | 'holiday_rejected'
  | 'open_shift'
  | 'approval_needed';

export type NotifSeverity = 'info' | 'success' | 'warning';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  severity: NotifSeverity;
  /** ISO date string for sorting (YYYY-MM-DD or full ISO) */
  timestamp: string;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

const KEY = (userId: string) => `notif_seen_${userId}`;

export function getSeenIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(KEY(userId));
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

export function markAllSeen(userId: string, ids: string[]): void {
  try {
    const existing = getSeenIds(userId);
    ids.forEach((id) => existing.add(id));
    // Keep only the most recent 500 to avoid unbounded growth
    const arr = [...existing].slice(-500);
    localStorage.setItem(KEY(userId), JSON.stringify(arr));
  } catch {
    // ignore
  }
}

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Genera l'elenco completo di notifiche rilevanti per l'utente corrente,
 * partendo dai dati già in memoria (zero richieste extra al DB).
 */
export function generateNotifications(
  currentUser: User,
  shifts: Shift[],
  holidays: HolidayRequest[],
  users: User[],
  t: Record<string, string>,
  language: Language
): AppNotification[] {
  const notifications: AppNotification[] = [];
  const isManager = isManagementRole(currentUser.role);
  const today = format(new Date(), 'yyyy-MM-dd');
  const twoWeeksAgo = format(subDays(new Date(), 14), 'yyyy-MM-dd');
  const dateLocale = getDateLocale(language);

  if (!isManager) {
    // Turni assegnati visibili (non draft, non open) negli ultimi 14 giorni o futuri
    const myShifts = shifts.filter(
      (s) =>
        s.user_id === currentUser.id &&
        s.date >= twoWeeksAgo &&
        !s.notes?.startsWith('__OPEN__') &&
        s.approval_status !== 'draft'
    );
    const byWeek = new Map<string, Shift[]>();
    for (const s of myShifts) {
      try {
        const d = parseISO(s.date);
        const ws = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const arr = byWeek.get(ws) ?? [];
        arr.push(s);
        byWeek.set(ws, arr);
      } catch {
        /* skip malformed date */
      }
    }
    const sortedWeekKeys = [...byWeek.keys()].sort((a, b) => a.localeCompare(b));
    for (const weekStart of sortedWeekKeys) {
      const group = (byWeek.get(weekStart) ?? []).sort((a, b) => a.date.localeCompare(b.date));
      if (group.length === 0) continue;
      const startD = parseISO(weekStart);
      const endD = endOfWeek(startD, { weekStartsOn: 1 });
      const rangeLabel = `${format(startD, 'd MMM', { locale: dateLocale })} – ${format(endD, 'd MMM', { locale: dateLocale })}`;
      const parts = group.map((s) => {
        let day: string;
        try {
          day = format(parseISO(s.date), 'EEE d', { locale: dateLocale });
        } catch {
          day = s.date;
        }
        return `${day} ${(s.start_time || '').slice(0, 5)}–${(s.end_time || '').slice(0, 5)}`;
      });
      let body = `${rangeLabel}: ${parts.join(' · ')}`;
      if (body.length > 240) body = `${body.slice(0, 237)}…`;
      notifications.push({
        id: `shift_week_${weekStart}`,
        type: 'new_shift',
        title: t.notif_shift_assigned,
        body,
        severity: 'info',
        timestamp: group[group.length - 1]!.date,
      });
    }

    const myHolidays = holidays.filter((h) => h.user_id === currentUser.id);
    for (const h of myHolidays) {
      if (h.status === 'approved') {
        notifications.push({
          id: `holiday_ok_${h.id}`,
          type: 'holiday_approved',
          title: t.notif_holiday_approved_title,
          body: `${h.start_date} → ${h.end_date}`,
          severity: 'success',
          timestamp: h.created_at,
        });
      } else if (h.status === 'rejected') {
        notifications.push({
          id: `holiday_ko_${h.id}`,
          type: 'holiday_rejected',
          title: t.notif_holiday_rejected_title,
          body: `${h.start_date} → ${h.end_date}`,
          severity: 'warning',
          timestamp: h.created_at,
        });
      }
    }
  } else {
    const pending = holidays.filter(
      (h) => h.status === 'pending' && matchesManagerDepartment(currentUser, h.user_id, users)
    );
    for (const h of pending) {
      const who = users.find((u) => u.id === h.user_id)?.first_name ?? t.notif_employee_fallback;
      notifications.push({
        id: `hol_pending_${h.id}`,
        type: 'holiday_pending',
        title: t.notif_holiday_request_title,
        body: `${who} · ${h.start_date} – ${h.end_date}`,
        severity: 'warning',
        timestamp: h.created_at,
      });
    }

    const openShifts = shifts.filter((s) => s.notes?.startsWith('__OPEN__') && s.date >= today);
    if (openShifts.length > 0) {
      const body =
        openShifts.length === 1
          ? t.notif_open_shifts_one
          : formatTrans(t.notif_open_shifts_many, { n: openShifts.length });
      notifications.push({
        id: `open_shifts_${today}`,
        type: 'open_shift',
        title: t.notif_open_shifts_title,
        body,
        severity: 'warning',
        timestamp: today,
      });
    }

    const needApproval = shifts.filter(
      (s) =>
        s.approval_status === 'confirmed' &&
        s.date <= today &&
        !s.notes?.startsWith('__OPEN__') &&
        matchesManagerDepartment(currentUser, s.user_id, users)
    );
    if (needApproval.length > 0) {
      const body =
        needApproval.length === 1
          ? t.notif_approval_one
          : formatTrans(t.notif_approval_many, { n: needApproval.length });
      notifications.push({
        id: `approvals_${today}`,
        type: 'approval_needed',
        title: t.notif_approval_title,
        body,
        severity: 'info',
        timestamp: today,
      });
    }
  }

  return notifications.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
