import { describe, test, expect } from 'vitest';
import { generateICalFeed, buildShiftsCalendarEvents } from '../utils/calendarExport';
import { exportUserData, isEmailValid, isPhoneValid } from '../utils/gdpr';
import { buildSlackMessage, buildTeamsMessage } from '../utils/webhooks';
import { validateFile, getMaxFileSize, getAllowedTypes } from '../utils/documentStorage';
import { computeLabourCostDashboard } from '../utils/labourCostDashboard';
import { MOCK_USER, MOCK_SHIFT } from '../__mocks__/data';

describe('calendarExport', () => {
  test('generateICalFeed produces valid VCALENDAR', () => {
    const events = buildShiftsCalendarEvents([{ id: 's1', date: '2026-05-10', start_time: '10:00', end_time: '16:00' }], 'MARIO');
    const ical = generateICalFeed(events);
    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('END:VCALENDAR');
    expect(ical).toContain('BEGIN:VEVENT');
    expect(ical).toContain('SUMMARY:Turno: MARIO');
    expect(ical).toContain('DTSTART:20260510');
    expect(ical).toContain('DTEND:20260510');
  });

  test('buildShiftsCalendarEvents returns events array', () => {
    const events = buildShiftsCalendarEvents([{ id: 's1', date: '2026-05-10', start_time: '18:00', end_time: '23:30', department: 'sala', notes: 'test' }], 'MARIO');
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('Turno: MARIO');
    expect(events[0].location).toBe('sala');
  });

  test('generateICalFeed handles empty events', () => {
    const ical = generateICalFeed([]);
    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('END:VCALENDAR');
    expect(ical).not.toContain('BEGIN:VEVENT');
  });
});

describe('gdpr', () => {
  test('isEmailValid returns true for valid emails', () => {
    expect(isEmailValid('test@example.com')).toBe(true);
    expect(isEmailValid('user+tag@domain.co.uk')).toBe(true);
  });

  test('isEmailValid returns false for invalid emails', () => {
    expect(isEmailValid('')).toBe(false);
    expect(isEmailValid('notanemail')).toBe(false);
    expect(isEmailValid('@domain.com')).toBe(false);
  });

  test('isPhoneValid returns true for valid phones', () => {
    expect(isPhoneValid('+39 333 1234567')).toBe(true);
    expect(isPhoneValid('3331234567')).toBe(true);
  });

  test('isPhoneValid returns false for invalid phones', () => {
    expect(isPhoneValid('')).toBe(false);
    expect(isPhoneValid('abc')).toBe(false);
  });
});

describe('webhooks', () => {
  test('buildSlackMessage returns formatted message', () => {
    const msg = buildSlackMessage({ event: 'shift.created', tenantId: 't1', data: { user: 'MARIO' }, timestamp: new Date().toISOString() });
    expect(msg.text).toContain('shift.created');
    expect(msg.blocks).toHaveLength(2);
  });

  test('buildTeamsMessage returns formatted message', () => {
    const msg = buildTeamsMessage({ event: 'punch.created', tenantId: 't1', data: { time: '10:00' }, timestamp: new Date().toISOString() });
    expect(msg.title).toContain('punch.created');
    expect(msg.sections).toHaveLength(1);
  });
});

describe('documentStorage', () => {
  test('validateFile accepts valid PDF', () => {
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    expect(validateFile(file)).toBeNull();
  });

  test('validateFile rejects oversized file', () => {
    const bigContent = new Array(getMaxFileSize() + 1).fill('a').join('');
    const file = new File([bigContent], 'big.pdf', { type: 'application/pdf' });
    expect(validateFile(file)).not.toBeNull();
  });

  test('getAllowedTypes includes PDF', () => {
    expect(getAllowedTypes()).toContain('application/pdf');
  });

  test('getMaxFileSize returns positive number', () => {
    expect(getMaxFileSize()).toBeGreaterThan(0);
  });
});

describe('labourCostDashboard', () => {
  test('computeLabourCostDashboard returns summary', () => {
    const result = computeLabourCostDashboard({
      users: [MOCK_USER],
      shifts: [MOCK_SHIFT],
      punchRecords: [],
      dateRange: { start: '2026-05-01', end: '2026-05-31' },
    });
    expect(result.rows).toHaveLength(1);
    expect(result.totalShiftCount).toBe(1);
    expect(result.totalPlannedMinutes).toBeGreaterThan(0);
  });

  test('computeLabourCostDashboard returns empty for no data', () => {
    const result = computeLabourCostDashboard({ users: [], shifts: [], punchRecords: [], dateRange: { start: '2026-01-01', end: '2026-01-31' } });
    expect(result.rows).toHaveLength(0);
    expect(result.totalActualCost).toBe(0);
  });
});
