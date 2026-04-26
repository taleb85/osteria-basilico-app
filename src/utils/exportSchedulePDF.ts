import { addDays, format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import type { jsPDF } from 'jspdf';
import { User, Shift, type Language } from '../types';
import { getNetShiftMinutes, type BreakMinutesComputeOptions, type BreakRule } from './breakRules';
import { isPurelyManagementRole } from './permissions';
import { getResolvedStartEndForHours, type PunchRecordLike } from './shiftResolvedClockTimes';

const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [255, 255, 255];
const GRAY_STRIPE: [number, number, number] = [242, 242, 242]; // #f2f2f2
const GRID_COLOR: [number, number, number] = [119, 119, 119]; // #777
const SEP_MID: [number, number, number] = [187, 187, 187]; // #bbb

const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 8;
const NAME_W = 22;
const TOT_W = 14;
const HEADER_ROW = 8;

/**
 * Criterio mattina/sera (come `WeeklyShiftsTable`): inizio < 16:00 = mattina.
 */
function isEveningSlot(s: Shift): boolean {
  const t = (s.start_time || '').trim();
  const h = parseInt(t.split(':')[0] ?? '0', 10);
  return !Number.isNaN(h) && h >= 16;
}

function isShiftAbsent(s: Shift): boolean {
  return String(s.approval_status).toLowerCase() === 'absent';
}

function plannedStartMinutes(s: Shift): number {
  const t = (s.start_time || '').replace(/:+/g, ':').trim().slice(0, 5);
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10) || 0));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10) || 0));
  return h * 60 + min;
}

function splitDayShiftsLunchEvening(rowShifts: Shift[]): {
  lunch: Shift | null;
  evening: Shift | null;
  extra: number;
} {
  const work = rowShifts.filter((s) => !isShiftAbsent(s));
  const lunchList = work
    .filter((s) => !isEveningSlot(s))
    .sort((a, b) => plannedStartMinutes(a) - plannedStartMinutes(b));
  const eveningList = work
    .filter((s) => isEveningSlot(s))
    .sort((a, b) => plannedStartMinutes(a) - plannedStartMinutes(b));
  const lunch = lunchList[0] ?? null;
  const evening = eveningList[0] ?? null;
  const shown = (lunch ? 1 : 0) + (evening ? 1 : 0);
  const extra = Math.max(0, work.length - shown);
  return { lunch, evening, extra };
}

function cleanTimeFormat(time: string): string {
  if (!time) return '—';
  let cleaned = time.replace(/:+/g, ':').trim();
  if (/^\d{4}$/.test(cleaned)) {
    cleaned = `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`;
  }
  return /^\d{2}:\d{2}$/.test(cleaned) ? cleaned : '—';
}

function dayHeaderLabel(d: Date): string {
  return format(d, 'EEE d', { locale: enUS }).toUpperCase();
}

function rowHeightForEmployeeCount(employeeCount: number): number {
  if (employeeCount <= 10) return 18;
  if (employeeCount <= 14) return 14;
  if (employeeCount <= 18) return 11;
  return 9;
}

function totalWeekMinutesToHHmm(
  shifts: Shift[],
  user: User,
  breakRules: BreakRule[],
  breakComputeOpts: BreakMinutesComputeOptions | undefined,
  punchRecords: PunchRecordLike[]
): string {
  const mins = shifts.reduce((sum, s) => {
    const { start, end } = getResolvedStartEndForHours(s, punchRecords);
    return sum + getNetShiftMinutes(s, start, end, user, breakRules, breakComputeOpts);
  }, 0);
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function drawNameColumnWrapped(
  doc: jsPDF,
  user: User,
  leftMm: number,
  rowTopY: number,
  nameColWidthMm: number,
  nameFontSize: number,
  rowHeight: number
): void {
  const full = [user.first_name, user.last_name]
    .map((s) => (s ?? '').trim())
    .filter((s) => s.length > 0)
    .join(' ')
    .toUpperCase() || '—';
  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(nameFontSize);
  const innerW = Math.max(6, nameColWidthMm - 2);
  const lines: string[] = doc.splitTextToSize(full, innerW) as string[];
  const lineH = Math.max(2.2, nameFontSize * 0.4);
  const maxByHeight = Math.max(1, Math.min(3, Math.floor((rowHeight - 2) / lineH)));
  const maxLines = maxByHeight;
  let toShow = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = toShow[maxLines - 1] ?? '';
    last = last.replace(/\s+$/g, '') + '…';
    while (last.length > 1 && doc.getTextWidth(last) > innerW) {
      last = last.slice(0, -2) + '…';
    }
    toShow = [...toShow.slice(0, maxLines - 1), last];
  }
  const blockH = toShow.length * lineH;
  const y0 = rowTopY + (rowHeight - blockH) / 2 + lineH * 0.75;
  toShow.forEach((line, li) => {
    doc.text(line, leftMm + 1, y0 + li * lineH);
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function exportSchedulePDF(
  weekStart: Date,
  weekDays: Date[],
  activeUsers: User[],
  shifts: Shift[],
  options: {
    restaurantName?: string;
    filterLabel?: string;
    includeOpen?: boolean;
    breakRules?: BreakRule[];
    breakComputeOpts?: BreakMinutesComputeOptions;
    punchRecords?: PunchRecordLike[];
    language?: Language;
  } = {}
): Promise<void> {
  const {
    restaurantName = '',
    filterLabel = '',
    includeOpen = false,
    breakRules = [],
    breakComputeOpts,
    punchRecords = [],
  } = options;
  const { jsPDF } = await import('jspdf');

  const scheduleUsers = activeUsers.filter((u) => !isPurelyManagementRole(u.role));
  const employeeCount = scheduleUsers.length;
  const rowHeight = rowHeightForEmployeeCount(employeeCount);
  const shiftFontSize = Math.max(7, rowHeight * 0.55);
  const nameFontSize = Math.max(6, rowHeight * 0.45);

  const weekChunks: Date[][] = [];
  for (let i = 0; i < weekDays.length; i += 7) {
    weekChunks.push(weekDays.slice(i, i + 7));
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const CONTENT_W = PAGE_W - MARGIN * 2;

  weekChunks.forEach((weekDaysChunk, chunkIdx) => {
    if (chunkIdx > 0) {
      doc.addPage();
    }

    const chunkStart = weekDaysChunk[0];
    const numDays = weekDaysChunk.length;
    const chunkEnd = addDays(chunkStart, numDays);
    const chunkStartStr = format(chunkStart, 'yyyy-MM-dd');
    const chunkEndStr = format(chunkEnd, 'yyyy-MM-dd');
    const weekShifts = shifts.filter(
      (s) =>
        s.date >= chunkStartStr &&
        s.date < chunkEndStr &&
        (includeOpen || !s.notes?.startsWith('__OPEN__'))
    );

    const dayColWidth = (PAGE_W - MARGIN * 2 - NAME_W - TOT_W) / numDays;
    if (dayColWidth <= 0) {
      return;
    }

    const startLabel = format(chunkStart, 'd MMM yyyy', { locale: enUS });
    const endLabel = format(addDays(chunkEnd, -1), 'd MMM yyyy', { locale: enUS });
    const topParts: string[] = [];
    if (restaurantName) topParts.push(restaurantName);
    topParts.push(`${startLabel} – ${endLabel}`);
    if (filterLabel) topParts.push(filterLabel);
    const topLine = topParts.join(' · ');

    let y = MARGIN + 5;
    doc.setTextColor(...BLACK);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(topLine, MARGIN, y);
    y = MARGIN + 12;

    const tableTopY = y;
    const totColumnLeftX = MARGIN + NAME_W + numDays * dayColWidth;

    // — Header row (black bg, white, 9pt bold) —————————————————
    doc.setFillColor(...BLACK);
    doc.rect(MARGIN, tableTopY, CONTENT_W, HEADER_ROW, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const headMidY = tableTopY + HEADER_ROW * 0.55 + 1.5;
    doc.text('EMPLOYEE', MARGIN + 1, headMidY);
    weekDaysChunk.forEach((day, i) => {
      const x = MARGIN + NAME_W + i * dayColWidth;
      const label = dayHeaderLabel(day);
      const tw = doc.getTextWidth(label);
      doc.text(label, x + (dayColWidth - tw) / 2, headMidY);
    });
    const totW = doc.getTextWidth('TOT');
    doc.text('TOT', totColumnLeftX + (TOT_W - totW) / 2, headMidY);

    y = tableTopY + HEADER_ROW;

    // — Data ——————————————————————————————————————————————————
    scheduleUsers.forEach((user, rowIdx) => {
      const cellY = y;
      const isStripe = rowIdx % 2 === 0;
      doc.setFillColor(...(isStripe ? GRAY_STRIPE : WHITE));
      doc.rect(MARGIN, cellY, CONTENT_W, rowHeight, 'F');

      drawNameColumnWrapped(doc, user, MARGIN, cellY, NAME_W, nameFontSize, rowHeight);

      const userShifts: Shift[] = [];
      weekDaysChunk.forEach((day, i) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayShifts = weekShifts.filter(
          (s) => s.user_id === user.id && s.date === dateStr
        );
        userShifts.push(...dayShifts);

        const x = MARGIN + NAME_W + i * dayColWidth;
        const { lunch, evening, extra } = splitDayShiftsLunchEvening(dayShifts);
        const hasBoth = lunch && evening;
        const topBaselineSingle = (cy: number) => cy + 2 + shiftFontSize * 0.3;
        const topBaselineDouble = (cy: number) => cy + 3 + shiftFontSize * 0.3;
        const bottomBaseline = (cy: number) => cy + rowHeight - 3;
        const writeTime = (s: Shift, baselineY: number) => {
          const { start, end } = getResolvedStartEndForHours(s, punchRecords);
          const timeStr = `${cleanTimeFormat(start)}–${cleanTimeFormat(end)}`;
          doc.setTextColor(...BLACK);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(shiftFontSize);
          doc.text(timeStr, x + 2, baselineY);
        };

        if (hasBoth) {
          writeTime(lunch, topBaselineDouble(cellY));
          const midY = cellY + rowHeight / 2;
          doc.setDrawColor(...SEP_MID);
          doc.setLineWidth(0.2);
          doc.line(x, midY, x + dayColWidth, midY);
          writeTime(evening, bottomBaseline(cellY));
        } else if (lunch) {
          writeTime(lunch, topBaselineSingle(cellY));
        } else if (evening) {
          writeTime(evening, bottomBaseline(cellY));
        }

        if (extra > 0) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(Math.max(6, shiftFontSize - 1.5));
          doc.setTextColor(...GRID_COLOR);
          const tag = `+${extra}`;
          doc.text(tag, x + dayColWidth - 1.5 - doc.getTextWidth(tag), cellY + rowHeight - 1.2);
        }
      });

      const weekTotal = totalWeekMinutesToHHmm(
        userShifts,
        user,
        breakRules,
        breakComputeOpts,
        punchRecords
      );
      if (weekTotal) {
        doc.setTextColor(...BLACK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(shiftFontSize);
        const wtw = doc.getTextWidth(weekTotal);
        const vert = cellY + rowHeight / 2 + shiftFontSize * 0.3;
        doc.text(weekTotal, totColumnLeftX + (TOT_W - wtw) / 2, vert);
      }

      y += rowHeight;
    });

    const tableBottomY = y;
    const tableH = tableBottomY - tableTopY;

    // — Grid: #777, TOT col thick left black —————————————————
    doc.setDrawColor(...GRID_COLOR);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, tableTopY, CONTENT_W, tableH, 'S');
    for (let v = 0; v <= numDays; v++) {
      const vx = MARGIN + NAME_W + v * dayColWidth;
      doc.line(vx, tableTopY, vx, tableBottomY);
    }
    doc.line(MARGIN + CONTENT_W, tableTopY, MARGIN + CONTENT_W, tableBottomY);

    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.8);
    doc.line(totColumnLeftX, tableTopY, totColumnLeftX, tableBottomY);
    for (let r = 0; r < scheduleUsers.length; r++) {
      const hy = tableTopY + HEADER_ROW + r * rowHeight;
      doc.setDrawColor(...GRID_COLOR);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, hy, MARGIN + CONTENT_W, hy);
    }
  });

  const anchorDate = weekDays[0] ?? weekStart;
  const fileName = `${format(anchorDate, 'dd-MM-yyyy')}.pdf`;
  doc.save(fileName);
}
