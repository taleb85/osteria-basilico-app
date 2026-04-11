import { format, parseISO, isValid, startOfMonth, endOfMonth } from 'date-fns';
import type { PunchRecord, User } from '../types';

export type PunchMonthCsvRow = {
  data: string;
  nomeDipendente: string;
  entrata: string;
  uscita: string;
  oreTotali: string;
  sede: string;
};

function userDisplayName(u: User): string {
  return [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || u.id;
}

function recordDateKey(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'yyyy-MM-dd') : '';
}

function recordTimeStr(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'HH:mm') : '';
}

function minutesBetween(a: string, b: string): number {
  const da = parseISO(a);
  const db = parseISO(b);
  if (!isValid(da) || !isValid(db) || db <= da) return 0;
  return Math.round((db.getTime() - da.getTime()) / 60000);
}

function formatHoursMinutes(totalMins: number): string {
  if (totalMins <= 0) return '0:00';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/**
 * Record del mese indicato (`yyyy-MM`), accoppiati IN→OUT per giorno e dipendente.
 */
export function buildPunchMonthRows(
  yearMonth: string,
  punchRecords: PunchRecord[],
  users: User[],
  tenantName: string
): PunchMonthCsvRow[] {
  const [y, mo] = yearMonth.split('-').map((x) => parseInt(x, 10));
  if (!y || !mo) return [];
  const monthStart = startOfMonth(new Date(y, mo - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const startMs = monthStart.getTime();
  const endMs = monthEnd.getTime() + 86400000 - 1;

  const byUser = new Map<string, User>();
  for (const u of users) byUser.set(u.id, u);

  const filtered = punchRecords.filter((p) => {
    const t = parseISO(p.timestamp);
    if (!isValid(t)) return false;
    const ms = t.getTime();
    return ms >= startMs && ms <= endMs;
  });

  const groups = new Map<string, PunchRecord[]>();
  for (const p of filtered) {
    const dk = recordDateKey(p.timestamp);
    if (!dk) continue;
    const key = `${p.user_id}|${dk}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  const rows: PunchMonthCsvRow[] = [];
  for (const [key, list] of groups) {
    const [userId, data] = key.split('|');
    const u = byUser.get(userId);
    const nome = u ? userDisplayName(u) : userId;
    const sorted = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    let totalMins = 0;
    let firstIn: string | null = null;
    let lastOut: string | null = null;
    let pendingIn: string | null = null;

    for (const r of sorted) {
      if (r.type === 'in') {
        if (!firstIn) firstIn = r.timestamp;
        pendingIn = r.timestamp;
      } else if (r.type === 'out' && pendingIn) {
        totalMins += minutesBetween(pendingIn, r.timestamp);
        lastOut = r.timestamp;
        pendingIn = null;
      }
    }

    rows.push({
      data,
      nomeDipendente: nome,
      entrata: firstIn ? recordTimeStr(firstIn) : '',
      uscita: lastOut ? recordTimeStr(lastOut) : '',
      oreTotali: formatHoursMinutes(totalMins),
      sede: tenantName,
    });
  }

  rows.sort((a, b) => {
    const c = a.data.localeCompare(b.data);
    if (c !== 0) return c;
    return a.nomeDipendente.localeCompare(b.nomeDipendente);
  });
  return rows;
}

/** CSV con separatore `;` e intestazioni italiane (Excel EU). */
export function exportPunchMonthToCsv(
  yearMonth: string,
  punchRecords: PunchRecord[],
  users: User[],
  tenantName: string
): string {
  const rows = buildPunchMonthRows(yearMonth, punchRecords, users, tenantName);
  const header = ['Data', 'Nome', 'Entrata', 'Uscita', 'Totale Ore', 'Sede'];
  const esc = (s: string) => {
    const t = String(s ?? '');
    if (/[;"\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
    return t;
  };
  const lines = [
    header.join(';'),
    ...rows.map((r) =>
      [r.data, r.nomeDipendente, r.entrata, r.uscita, r.oreTotali, r.sede].map(esc).join(';')
    ),
  ];
  return lines.join('\r\n');
}

export function downloadPunchMonthCsv(
  yearMonth: string,
  punchRecords: PunchRecord[],
  users: User[],
  tenantName: string,
  filename?: string
): void {
  const csv = exportPunchMonthToCsv(yearMonth, punchRecords, users, tenantName);
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `timbrature_${yearMonth}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
