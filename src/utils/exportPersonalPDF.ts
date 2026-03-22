import jsPDF from 'jspdf';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { User, Shift } from '../types';
import { getNetShiftMinutes, type BreakMinutesComputeOptions, type BreakRule } from './breakRules';
import { getResolvedStartEndForHours, type PunchRecordLike } from './shiftResolvedClockTimes';
import { isPurelyManagementRole } from './permissions';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
/** #2D5A27 */
const ACCENT: [number, number, number] = [45, 90, 39];
const LIGHT: [number, number, number] = [220, 252, 231];
const WEEKEND_BG: [number, number, number] = [248, 250, 252];
const HOLIDAY_BG: [number, number, number] = [254, 243, 199];

function fmtHM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function exportPersonalPDF(
  user: User,
  monthDate: Date,
  allShifts: Shift[],
  approvedHolidayDates: Set<string>,
  restaurantName = 'Osteria Basilico',
  breakRules: BreakRule[] = [],
  breakComputeOpts?: BreakMinutesComputeOptions,
  punchRecords: PunchRecordLike[] = []
): void {
  if (isPurelyManagementRole(user.role)) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const MARGIN = 12;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  // Column setup: Mon–Sun
  const COL_W = CONTENT_W / 7;
  const ROW_H = 28;
  const HEADER_H = 8;

  // Header bg
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, PAGE_W, 22, 'F');

  // Restaurant name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(restaurantName, MARGIN, 13);

  // Employee name + month
  const monthLabel = format(monthDate, 'MMMM yyyy', { locale: it }).toUpperCase();
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 240, 235);
  doc.text(`${user.first_name.toUpperCase()} ${(user.last_name ?? '').toUpperCase()} · ${monthLabel}`, MARGIN, 19);

  // Print date (right)
  doc.setFontSize(7);
  const ts = `Stampato il ${format(new Date(), 'd MMM yyyy HH:mm', { locale: it })}`;
  doc.text(ts, PAGE_W - MARGIN - doc.getTextWidth(ts), 19);

  // Day column headers
  let y = 26;
  DAY_LABELS.forEach((label, i) => {
    const x = MARGIN + i * COL_W;
    const isWeekend = i >= 5;
    doc.setFillColor(isWeekend ? 241 : 248, isWeekend ? 245 : 250, isWeekend ? 249 : 252);
    doc.rect(x, y, COL_W, HEADER_H, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(x, y, COL_W, HEADER_H, 'S');
    doc.setTextColor(isWeekend ? 148 : 71, isWeekend ? 160 : 85, isWeekend ? 184 : 105);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(label, x + COL_W / 2 - doc.getTextWidth(label) / 2, y + 5.5);
  });
  y += HEADER_H;

  // Build weeks
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const firstDow = (getDay(monthStart) + 6) % 7; // Mon=0
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group into weeks (Mon-based)
  type Week = (Date | null)[];
  const weeks: Week[] = [];
  let week: Week = Array(firstDow).fill(null);
  for (const day of days) {
    week.push(day);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  // Month's shifts for this user
  const monthStr = format(monthDate, 'yyyy-MM');
  const myShifts = allShifts.filter(
    (s) =>
      s.user_id === user.id &&
      s.date.startsWith(monthStr) &&
      !s.notes?.startsWith('__OPEN__')
  );

  // Monthly totals
  let totalMins = 0;
  let totalDays = 0;

  // Render each week row
  for (const week of weeks) {
    for (let col = 0; col < 7; col++) {
      const day = week[col];
      const x = MARGIN + col * COL_W;
      const isWeekend = col >= 5;

      if (!day) {
        // Empty cell
        doc.setFillColor(250, 250, 250);
        doc.rect(x, y, COL_W, ROW_H, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(x, y, COL_W, ROW_H, 'S');
        continue;
      }

      const dateStr = format(day, 'yyyy-MM-dd');
      const dayShifts = myShifts.filter((s) => s.date === dateStr);
      const isHoliday = approvedHolidayDates.has(dateStr);
      const isCurrentDay = format(new Date(), 'yyyy-MM-dd') === dateStr;

      // Cell background
      if (isHoliday) {
        doc.setFillColor(...HOLIDAY_BG);
      } else if (dayShifts.length > 0) {
        doc.setFillColor(...LIGHT);
      } else if (isWeekend) {
        doc.setFillColor(...WEEKEND_BG);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(x, y, COL_W, ROW_H, 'F');

      // Today ring
      if (isCurrentDay) {
        doc.setDrawColor(...ACCENT);
        doc.setLineWidth(0.8);
        doc.rect(x + 0.4, y + 0.4, COL_W - 0.8, ROW_H - 0.8, 'S');
        doc.setLineWidth(0.2);
      }

      // Cell border
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.rect(x, y, COL_W, ROW_H, 'S');

      // Day number
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(isWeekend ? 100 : 30, isWeekend ? 116 : 41, isWeekend ? 139 : 59);
      doc.text(String(day.getDate()), x + 2.5, y + 5.5);

      if (isHoliday) {
        // Ferie label
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 120, 0);
        doc.text('FERIE', x + COL_W / 2 - doc.getTextWidth('FERIE') / 2, y + ROW_H / 2 + 2);
      } else if (dayShifts.length > 0) {
        // Shift times
        dayShifts.slice(0, 2).forEach((s, si) => {
          const { start, end } = getResolvedStartEndForHours(s, punchRecords);
          const mins = getNetShiftMinutes(s, start, end, user, breakRules, breakComputeOpts);
          totalMins += mins;
          totalDays++;
          const timeStr = `${start}–${end}`;
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(17, 94, 89);
          doc.text(timeStr, x + 2, y + 12 + si * 6);
          const hStr = fmtHM(mins);
          doc.setFontSize(5.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(80, 150, 120);
          doc.text(hStr, x + 2, y + 16.5 + si * 6);
        });
      }
    }
    y += ROW_H;
  }

  // Summary footer
  y += 6;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, y, CONTENT_W, 18, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(MARGIN, y, CONTENT_W, 18, 2, 2, 'S');

  const summaryItems = [
    { label: 'Turni', value: String(totalDays) },
    { label: 'Ore totali', value: fmtHM(totalMins) },
    { label: 'Media/turno', value: totalDays > 0 ? fmtHM(Math.round(totalMins / totalDays)) : '—' },
  ];
  summaryItems.forEach((item, i) => {
    const sx = MARGIN + i * (CONTENT_W / 3) + 8;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, sx, y + 7);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ACCENT);
    doc.text(item.value, sx, y + 15);
  });

  // Save
  const fileName = `${user.first_name.toLowerCase()}_${format(monthDate, 'yyyy-MM')}.pdf`;
  doc.save(fileName);
}
