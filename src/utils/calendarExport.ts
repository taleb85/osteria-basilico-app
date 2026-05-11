import { supabase } from '../lib/supabase';

export interface CalendarEvent {
  uid: string;
  dtstart: string;
  dtend: string;
  summary: string;
  description?: string;
  location?: string;
}

export function generateICalFeed(events: CalendarEvent[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FLOW Work in Motion//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:FLOW Turni',
  ];

  for (const ev of events) {
    const uid = ev.uid ?? `flow-${ev.dtstart}-${Math.random().toString(36).slice(2, 8)}`;
    const start = ev.dtstart.replace(/[-:]/g, '').split('.')[0] + 'Z';
    const end = ev.dtend.replace(/[-:]/g, '').split('.')[0] + 'Z';
    const summary = escapeICalText(ev.summary);
    const desc = ev.description ? escapeICalText(ev.description) : '';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTART:${start}`);
    lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${summary}`);
    if (desc) lines.push(`DESCRIPTION:${desc}`);
    if (ev.location) lines.push(`LOCATION:${escapeICalText(ev.location)}`);
    lines.push(`DTSTAMP:${now}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function escapeICalText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function downloadICalFeed(events: CalendarEvent[], filename = 'flow-turni.ics'): void {
  const content = generateICalFeed(events);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildShiftsCalendarEvents(
  shifts: { id: string; date: string; start_time: string; end_time: string; department?: string; notes?: string }[],
  employeeName: string
): CalendarEvent[] {
  return shifts.map((s) => ({
    uid: `shift-${s.id}`,
    dtstart: `${s.date}T${s.start_time?.slice(0, 5) ?? '00:00'}:00`,
    dtend: `${s.date}T${s.end_time?.slice(0, 5) ?? '00:00'}:00`,
    summary: `Turno: ${employeeName}`,
    description: s.notes ? `Note: ${s.notes}` : undefined,
    location: s.department ?? undefined,
  }));
}
