import { addDays, format, subMonths } from 'date-fns';
import type { HolidayRequest, PunchRecord, Shift, User } from '../types';

export type DemoPunchSpec = {
  date: string;
  /** HH:mm come in `shift.start_time` */
  startTime: string;
  inH: number;
  inM: number;
  outH: number;
  outM: number;
};

export interface DemoProfileBuilt {
  shifts: Omit<Shift, 'id'>[];
  punchSpecs: DemoPunchSpec[];
  holidays: Omit<HolidayRequest, 'id' | 'created_at'>[];
  userPatch: Partial<User>;
}

function isoLocal(dateYmd: string, hh: number, mm: number): string {
  const [y, mo, d] = dateYmd.split('-').map(Number);
  return new Date(y, mo - 1, d, hh, mm, 0, 0).toISOString();
}

function shiftTime(hhmm: string): string {
  return hhmm.length <= 5 ? `${hhmm}:00` : hhmm;
}

/**
 * Dati di esempio per un singolo dipendente: turni (confermati / approvati con congelo),
 * timbrature collegate, richieste ferie/permessi, campi profilo (telefono, reparto, tariffa, ore mensili).
 * Date relative a `now` così restano sempre “vicine” alla settimana corrente.
 */
export function buildDemoProfileData(now: Date, userId: string): DemoProfileBuilt {
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  type Entry = {
    offset: number;
    type: 'lunch' | 'dinner';
    start: string;
    end: string;
    approval_status: 'approved' | 'confirmed';
    punch?: boolean;
    freeze?: boolean;
    notes?: string;
  };

  const entries: Entry[] = [
    { offset: -18, type: 'lunch', start: '11:30', end: '15:00', approval_status: 'approved', punch: true, freeze: true },
    { offset: -17, type: 'dinner', start: '18:00', end: '23:30', approval_status: 'confirmed', punch: true },
    { offset: -15, type: 'lunch', start: '11:30', end: '15:00', approval_status: 'confirmed', punch: true },
    { offset: -14, type: 'dinner', start: '18:00', end: '23:00', approval_status: 'approved', freeze: true, notes: 'Chiusura anticipata sala' },
    { offset: -12, type: 'lunch', start: '11:30', end: '15:00', approval_status: 'confirmed' },
    { offset: -11, type: 'dinner', start: '18:00', end: '23:30', approval_status: 'confirmed', punch: true },
    { offset: -10, type: 'lunch', start: '11:30', end: '15:00', approval_status: 'approved', punch: true, freeze: true },
    { offset: -8, type: 'dinner', start: '18:00', end: '23:30', approval_status: 'confirmed' },
    { offset: -7, type: 'lunch', start: '11:30', end: '15:00', approval_status: 'confirmed', punch: true },
    { offset: -5, type: 'dinner', start: '18:00', end: '23:30', approval_status: 'approved', freeze: true },
    { offset: -4, type: 'lunch', start: '11:30', end: '15:00', approval_status: 'confirmed' },
    { offset: -3, type: 'dinner', start: '18:00', end: '23:30', approval_status: 'confirmed', punch: true },
    { offset: -1, type: 'lunch', start: '11:30', end: '15:00', approval_status: 'confirmed', punch: true },
    { offset: 1, type: 'dinner', start: '18:00', end: '23:30', approval_status: 'confirmed' },
    { offset: 2, type: 'lunch', start: '11:30', end: '15:00', approval_status: 'confirmed' },
    { offset: 4, type: 'dinner', start: '18:00', end: '23:30', approval_status: 'confirmed' },
    { offset: 6, type: 'lunch', start: '11:30', end: '15:00', approval_status: 'confirmed' },
  ];

  const approvedAt = new Date(now.getTime() - 86400000).toISOString();
  const shifts: Omit<Shift, 'id'>[] = [];
  const punchSpecs: DemoPunchSpec[] = [];

  for (const e of entries) {
    const d = addDays(day0, e.offset);
    const date = format(d, 'yyyy-MM-dd');
    const row: Omit<Shift, 'id'> = {
      user_id: userId,
      date,
      start_time: shiftTime(e.start),
      end_time: shiftTime(e.end),
      type: e.type,
      approval_status: e.approval_status,
      deduct_break: true,
    };
    if (e.notes) row.notes = e.notes;
    if (e.freeze && e.approval_status === 'approved') {
      row.approved_at = approvedAt;
      row.approved_by = 'Demo · Manager';
      row.approved_start_time = e.start;
      row.approved_end_time = e.end;
    }
    shifts.push(row);
    if (e.punch) {
      punchSpecs.push({
        date,
        startTime: e.start,
        inH: e.start === '11:30' ? 11 : 17,
        inM: e.start === '11:30' ? 27 : 58,
        outH: e.end.startsWith('15') ? 15 : 23,
        outM: e.end.startsWith('15') ? 5 : e.end.startsWith('23:00') ? 2 : 28,
      });
    }
  }

  const h1Start = format(addDays(day0, -40), 'yyyy-MM-dd');
  const h1End = format(addDays(day0, -38), 'yyyy-MM-dd');
  const h2Start = format(addDays(day0, 14), 'yyyy-MM-dd');
  const h2End = format(addDays(day0, 15), 'yyyy-MM-dd');
  const h3Start = format(addDays(day0, 45), 'yyyy-MM-dd');
  const h3End = format(addDays(day0, 47), 'yyyy-MM-dd');

  const holidays: Omit<HolidayRequest, 'id' | 'created_at'>[] = [
    {
      user_id: userId,
      start_date: h1Start,
      end_date: h1End,
      type: 'ferie',
      status: 'approved',
      reason: 'Ferie invernali (demo)',
    },
    {
      user_id: userId,
      start_date: h2Start,
      end_date: h2End,
      type: 'permesso',
      status: 'pending',
      reason: 'Visita medica',
    },
    {
      user_id: userId,
      start_date: h3Start,
      end_date: h3End,
      type: 'ferie',
      status: 'rejected',
      reason: 'Richiesta non copribile in cucina (demo)',
    },
  ];

  const prevMonth = format(subMonths(now, 1), 'yyyy-MM');
  const thisMonth = format(now, 'yyyy-MM');

  const userPatch: Partial<User> = {
    phone: '+39 340 1234567',
    department: 'sala',
    hourly_rate_eur: 11.5,
    monthly_confirmed: {
      [prevMonth]: { minutes: 96 * 60 + 30, shiftsCount: 18 },
      [thisMonth]: { minutes: 52 * 60 + 15, shiftsCount: 9 },
    },
  };

  return { shifts, punchSpecs, holidays, userPatch };
}

export function punchRecordsFromSpecs(
  userId: string,
  shiftId: string,
  spec: DemoPunchSpec
): Array<Omit<PunchRecord, 'id'>> {
  return [
    {
      user_id: userId,
      shift_id: shiftId,
      type: 'in',
      timestamp: isoLocal(spec.date, spec.inH, spec.inM),
      calculated_time: isoLocal(spec.date, spec.inH, spec.inM),
    },
    {
      user_id: userId,
      shift_id: shiftId,
      type: 'out',
      timestamp: isoLocal(spec.date, spec.outH, spec.outM),
      calculated_time: isoLocal(spec.date, spec.outH, spec.outM),
    },
  ];
}
