import { type Shift, type PunchAuditEntry } from '../types';
import {
  getPunchPairForShift,
  getResolvedStartEndForHours,
  punchTimeHHMM,
  type PunchRecordLike,
} from './shiftResolvedClockTimes';

// ── Status helpers ──────────────────────────────────────────────────────────

/** Stato turno dal DB (case / spazi / null). */
export function normalizedApprovalStatus(
  status: Shift['approval_status'] | undefined | null
): string {
  return (status ?? '').toString().trim().toLowerCase();
}

export function isShiftDraftLike(
  shift: Pick<Shift, 'approval_status'>
): boolean {
  const s = normalizedApprovalStatus(shift.approval_status);
  return s === 'draft' || s === '';
}

export function isShiftFrozenRecord(
  _shift: Pick<Shift, 'approval_status' | 'approved_at'>
): boolean {
  return false;
}

export function isShiftAbsentRecord(
  shift: Pick<Shift, 'approval_status'>
): boolean {
  return normalizedApprovalStatus(shift.approval_status) === 'absent';
}

// ── Drawer timbrature helpers ───────────────────────────────────────────────

export type DrawerTimbratureMode = 'device' | 'manual' | 'frozen';

function punchAuditTouches(
  audits: PunchAuditEntry[],
  punchId: string | undefined,
  fields: readonly string[]
): boolean {
  if (!punchId) return false;
  return audits.some(
    (a) => a.punch_record_id === punchId && a.field != null && fields.includes(a.field)
  );
}

/** Dettaglio drawer: orari timbratura effettivi (timestamp dispositivo) o valori congelati; modalità da audit. */
export function computeDrawerTimbratureDisplay(
  shift: Shift,
  punchRecords: PunchRecordLike[],
  audits: PunchAuditEntry[]
): {
  inTime: string;
  outTime: string;
  inMode: DrawerTimbratureMode | null;
  outMode: DrawerTimbratureMode | null;
} {
  const pair = getPunchPairForShift(shift, punchRecords);
  const resolved = getResolvedStartEndForHours(shift, punchRecords);
  const inPid = pair.punchIn?.id;
  const outPid = pair.punchOut?.id;

  let inTime = '—';
  let outTime = '—';
  let inMode: DrawerTimbratureMode | null = null;
  let outMode: DrawerTimbratureMode | null = null;

  if (pair.punchIn) {
    inTime = punchTimeHHMM(pair.punchIn.timestamp) ?? '—';
    inMode = punchAuditTouches(audits, inPid, ['timestamp', 'calculated_time'])
      ? 'manual'
      : 'device';
  } else if (resolved.source === 'frozen') {
    const aS = (shift.approved_start_time || '').trim().slice(0, 5);
    if (aS) {
      inTime = aS;
      inMode = 'frozen';
    }
  }

  const clockOut = pair.punchIn?.clock_out_time;
  if (clockOut) {
    outTime = punchTimeHHMM(clockOut) ?? '—';
    outMode = punchAuditTouches(audits, inPid, ['clock_out_time'])
      ? 'manual'
      : 'device';
  } else if (pair.punchOut) {
    outTime = punchTimeHHMM(pair.punchOut.timestamp) ?? '—';
    outMode = punchAuditTouches(audits, outPid, ['timestamp', 'calculated_time'])
      ? 'manual'
      : 'device';
  } else if (resolved.source === 'frozen') {
    const aE = (shift.approved_end_time || '').trim().slice(0, 5);
    if (aE) {
      outTime = aE;
      outMode = 'frozen';
    }
  }

  return { inTime, outTime, inMode, outMode };
}

/** Vero se il turno è aperto (non assegnato) o in richiesta di assegnazione. */
export const OPEN_SHIFTS_BAR_COLLAPSED_KEY =
  'osteria_wst_open_shifts_bar_collapsed';

// ── Open shift helpers ──────────────────────────────────────────────────────

/** Etichetta ruolo breve — allineata allo stile UserAvatarMenu (toolbar). */
export function scheduleDrawerRoleLabel(
  role: string | undefined
): string {
  const m: Record<string, string> = {
    admin: 'Admin',
    proprietario: 'Manager',
    manager: 'Manager',
    assistant_manager: 'Ass. Manager',
    waiter: 'Sala',
    server: 'Sala',
    cook: 'Cucina',
    chef: 'Cucina',
    bartender: 'Bar',
    dishwasher: 'Pulizie',
  };
  return (
    m[(role || '').toLowerCase().trim()] ??
    (role ? role.slice(0, 12) : '')
  );
}

export const isOpenShiftRecord = (s: { notes?: string }) =>
  !!(
    s.notes &&
    (s.notes.startsWith('__OPEN__') ||
      s.notes.startsWith('__OPEN_REQ__') ||
      s.notes.startsWith('__OPEN_EXT__'))
  );

/** Vero se qualcuno ha già richiesto il turno aperto. */
export const isRequestedShift = (s: { notes?: string }) =>
  !!(s.notes && s.notes.startsWith('__OPEN_REQ__'));

/** Vero se il turno aperto è stato assegnato a una persona esterna (non nel sistema). */
export const isExternalAssignedShift = (s: { notes?: string }) =>
  !!(s.notes && s.notes.startsWith('__OPEN_EXT__'));

/** Restituisce il nome della persona esterna assegnata, o stringa vuota. */
export const getExternalAssigneeName = (s: { notes?: string }): string => {
  const n = s.notes ?? '';
  if (!n.startsWith('__OPEN_EXT__:')) return '';
  const parts = n.split(':');
  return parts[1] ?? '';
};

/** Restituisce id e nome del richiedente, o null. */
export const getRequester = (
  s: { notes?: string }
): { id: string; name: string } | null => {
  if (!isRequestedShift(s)) return null;
  // Format: __OPEN_REQ__:userId:nome[:nota]
  const after = (s.notes ?? '').slice('__OPEN_REQ__:'.length);
  const colonIdx = after.indexOf(':');
  if (colonIdx === -1) return null;
  const id = after.slice(0, colonIdx);
  const rest = after.slice(colonIdx + 1);
  const name = rest.split(':')[0] ?? '?';
  return id ? { id, name } : null;
};

/** Estrae la nota pubblica originale dal turno aperto (rimuove i prefissi). */
export const getOpenShiftPublicNote = (s: { notes?: string }): string => {
  const n = s.notes ?? '';
  if (n.startsWith('__OPEN_REQ__:')) {
    const parts = n.split(':');
    // [0]=__OPEN_REQ__, [1]=userId, [2]=nome, [3+]=nota
    return parts.slice(3).join(':');
  }
  if (n.startsWith('__OPEN_EXT__:')) {
    const parts = n.split(':');
    // [0]=__OPEN_EXT__, [1]=nome esterno, [2+]=nota
    return parts.slice(2).join(':');
  }
  return n.replace(/^__OPEN__:?/, '');
};

// ── Time formatting ─────────────────────────────────────────────────────────

/** Formato compatto per mobile: "10:00" -> "10", "10:30" -> "10:30", "___" o vuoto -> "–". */
export function toShortTime(t: string): string {
  const s = (t || '').trim().slice(0, 5);
  if (!/^\d{1,2}:\d{2}$/.test(s)) return '–';
  const [, min] = s.split(':');
  return min === '00' ? s.slice(0, 2) : s;
}

/**
 * Parsifica input rapido stile "10-16" o "10:00-16:00" o "19:30" in {start, end}.
 * Supporta separatori: - – spazio. Digits-only h "1016" → "10:00"-"16:00".
 * Se non c'è end, applica la regola 10→16.
 */
export function parseCellTimeInput(
  raw: string
): { start: string; end: string } | null {
  const v = raw.trim();
  if (!v) return null;

  // Full "10:00-16:00" or "10:30 – 23:00"
  const fullRe = /^(\d{1,2}):(\d{2})\s*[-–\s]\s*(\d{1,2}):(\d{2})$/;
  const fm = v.match(fullRe);
  if (fm) {
    const h1 = parseInt(fm[1], 10),
      m1 = parseInt(fm[2], 10);
    const h2 = parseInt(fm[3], 10),
      m2 = parseInt(fm[4], 10);
    if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return null;
    return {
      start: `${fm[1].padStart(2, '0')}:${fm[2]}`,
      end: `${fm[3].padStart(2, '0')}:${fm[4]}`,
    };
  }
  // Simple hours "10-16" or "10 16"
  const simpleRe = /^(\d{1,2})\s*[-–\s]\s*(\d{1,2})$/;
  const sm = v.match(simpleRe);
  if (sm) {
    const h1 = parseInt(sm[1], 10),
      h2 = parseInt(sm[2], 10);
    if (h1 > 23 || h2 > 23) return null;
    return {
      start: `${sm[1].padStart(2, '0')}:00`,
      end: `${sm[2].padStart(2, '0')}:00`,
    };
  }
  // Compact "1016" → "10:00"-"16:00"
  const compactRe = /^(\d{2})(\d{2})$/;
  const cm = v.match(compactRe);
  if (cm) {
    const h1 = parseInt(cm[1], 10),
      h2 = parseInt(cm[2], 10);
    if (h1 > 23 || h2 > 23) return null;
    return { start: `${cm[1]}:00`, end: `${cm[2]}:00` };
  }
  // Single start "10" or "10:30"
  const singleRe = /^(\d{1,2})(?::(\d{2}))?$/;
  const xm = v.match(singleRe);
  if (xm) {
    const start = `${xm[1].padStart(2, '0')}:${xm[2] ?? '00'}`;
    return { start, end: start === '10:00' ? '16:00' : '' };
  }
  return null;
}

// ── DOM helpers ─────────────────────────────────────────────────────────────

/** Primo antenato con scroll verticale (pannello staff); altrimenti null = viewport. */
export function findVerticalScrollParent(
  el: HTMLElement | null
): Element | null {
  if (typeof window === 'undefined' || !el) return null;
  let p: HTMLElement | null = el.parentElement;
  while (p && p !== document.documentElement) {
    const { overflowY } = window.getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
    p = p.parentElement;
  }
  return null;
}

/** Sentinel sopra la barra date: non più visibile sopra il bordo superiore del root ⇒ barra sticky “agganciata”. */
export function isDateBarStuckPast(
  entry: IntersectionObserverEntry
): boolean {
  if (entry.isIntersecting) return false;
  const rootTop = entry.rootBounds?.top ?? 0;
  return entry.boundingClientRect.bottom < rootTop;
}
