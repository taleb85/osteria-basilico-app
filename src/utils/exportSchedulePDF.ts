import jsPDF from 'jspdf';
import { format, addDays } from 'date-fns';
import type { Locale } from 'date-fns';
import { User, Shift, type Language } from '../types';
import { getNetShiftMinutes, type BreakMinutesComputeOptions, type BreakRule } from './breakRules';
import { isPurelyManagementRole } from './permissions';
import { getResolvedStartEndForHours, type PunchRecordLike } from './shiftResolvedClockTimes';
import { formatTrans, getDateLocale, getTranslations } from './translations';

// ── Colours ───────────────────────────────────────────────────────────────────

const DEPT_FILL: Record<string, [number, number, number]> = {
  sala:    [240, 253, 250],  // light teal (allinea a reparto Sala, no blu)
  kitchen: [255, 237, 213],  // light orange
  bar:     [220, 230, 218],  // tint basilico (accent light)
};
const DEPT_BORDER: Record<string, [number, number, number]> = {
  sala:    [13, 148, 136], // teal-600
  kitchen: [249, 115, 22],
  bar:     [45, 90, 39],
};
/** Brand Osteria Basilico #2D5A27 = rgb(45, 90, 39) */
const BASILICO: [number, number, number] = [45, 90, 39];
const STATUS_COLOR: Record<string, [number, number, number]> = {
  approved: BASILICO,
  confirmed: BASILICO,
  draft: [203, 213, 225],
};

// ── Helper ────────────────────────────────────────────────────────────────────

function fmtDay(date: Date, locale: Locale): string {
  return format(date, 'EEE d', { locale }).toUpperCase();
}

function totalHours(
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
  if (mins === 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function exportSchedulePDF(
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
    /** Lingua UI utente (etichette PDF). */
    language?: Language;
  } = {}
): void {
  const {
    restaurantName = 'Osteria Basilico',
    filterLabel = '',
    includeOpen = false,
    breakRules = [],
    breakComputeOpts,
    punchRecords = [],
    language: langOpt,
  } = options;
  const language = langOpt ?? 'it';
  const t = getTranslations(language);
  const locale = getDateLocale(language) as Locale;

  const numDays = weekDays.length;
  const weekEnd = addDays(weekStart, numDays);
  const weekStr = format(weekStart, 'yyyy-MM-dd');
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
  const weekShifts = shifts.filter(
    (s) =>
      s.date >= weekStr &&
      s.date < weekEndStr &&
      (includeOpen || !s.notes?.startsWith('__OPEN__'))
  );

  /** Difesa in profondità: l’admin non deve mai comparire nel PDF anche se passato per errore. */
  const scheduleUsers = activeUsers.filter((u) => !isPurelyManagementRole(u.role));

  // ── Page setup ─────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PAGE_W = 297;
  const PAGE_H = 210;
  const MARGIN = 10;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  // Column widths
  const NAME_W = 32;
  const DAY_W = (CONTENT_W - NAME_W - 20) / numDays; // 20 = total hours col
  const TOT_W = 20;

  // Row heights
  const HEADER_ROW = 10;
  const DATA_ROW = 12;

  // ── Page header ────────────────────────────────────────────────────────────
  doc.setFillColor(...BASILICO);
  doc.rect(0, 0, PAGE_W, 18, 'F');

  // Restaurant name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(restaurantName, MARGIN, 12);

  // Week range
  const rangeLabel = `${format(weekStart, 'd MMMM', { locale })} – ${format(addDays(weekEnd, -1), 'd MMMM yyyy', { locale })}`;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(rangeLabel, MARGIN + 56, 12);

  if (filterLabel) {
    doc.text(`· ${filterLabel}`, MARGIN + 56 + doc.getTextWidth(rangeLabel) + 2, 12);
  }

  // Print timestamp (right)
  doc.setFontSize(7);
  doc.setTextColor(220, 230, 218);
  const printedAt = formatTrans(t.ts_pdf_printed_on, {
    datetime: format(new Date(), 'd MMM yyyy HH:mm', { locale }),
  });
  doc.text(printedAt, PAGE_W - MARGIN - doc.getTextWidth(printedAt), 12);

  // ── Column headers ─────────────────────────────────────────────────────────
  let y = 22;
  doc.setFillColor(248, 250, 252);
  doc.rect(MARGIN, y, CONTENT_W, HEADER_ROW, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(MARGIN, y, CONTENT_W, HEADER_ROW, 'S');

  // Name column header
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(t.ts_pdf_col_employee, MARGIN + 2, y + 6.5);

  // Day column headers
  weekDays.forEach((day, i) => {
    const x = MARGIN + NAME_W + i * DAY_W;
    const isWeekend = [0, 6].includes(day.getDay());
    if (isWeekend) {
      doc.setFillColor(241, 245, 249);
      doc.rect(x, y, DAY_W, HEADER_ROW, 'F');
    }
    doc.setTextColor(isWeekend ? 148 : 71, isWeekend ? 160 : 85, isWeekend ? 184 : 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const label = fmtDay(day, locale);
    doc.text(label, x + DAY_W / 2 - doc.getTextWidth(label) / 2, y + 6.5);
  });

  // Total column header
  const totX = MARGIN + NAME_W + numDays * DAY_W;
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const totLabel = t.schedule_pdf_total_abbr;
  doc.text(totLabel, totX + TOT_W / 2 - doc.getTextWidth(totLabel) / 2, y + 6.5);

  y += HEADER_ROW;

  // ── Data rows ──────────────────────────────────────────────────────────────
  let prevDept = '';

  scheduleUsers.forEach((user, rowIdx) => {
    // Department separator
    const dept = user.department ?? 'sala';
    if (dept !== prevDept && rowIdx > 0) {
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
    }
    prevDept = dept;

    const rowBg: [number, number, number] = rowIdx % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
    doc.setFillColor(...rowBg);
    doc.rect(MARGIN, y, CONTENT_W, DATA_ROW, 'F');

    // Department accent bar (left edge)
    const [r, g, b] = DEPT_BORDER[dept] ?? [148, 163, 184];
    doc.setFillColor(r, g, b);
    doc.rect(MARGIN, y, 1.5, DATA_ROW, 'F');

    // Name
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    const firstName = user.first_name.toUpperCase();
    doc.text(firstName, MARGIN + 3, y + 5.5);
    if (user.last_name) {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(user.last_name.toUpperCase(), MARGIN + 3, y + 9.5);
    }

    // Day cells
    const userShifts: Shift[] = [];

    weekDays.forEach((day, i) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayShifts = weekShifts.filter(
        (s) => s.user_id === user.id && s.date === dateStr
      );
      userShifts.push(...dayShifts);

      const x = MARGIN + NAME_W + i * DAY_W;
      const isWeekend = [0, 6].includes(day.getDay());

      if (isWeekend) {
        const [fr, fg, fb] = rowIdx % 2 === 0 ? [248, 250, 252] : [241, 245, 249];
        doc.setFillColor(fr, fg, fb);
        doc.rect(x, y, DAY_W, DATA_ROW, 'F');
      }

      // Vertical separator
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(x, y, x, y + DATA_ROW);

      if (dayShifts.length > 0) {
        // Cell fill based on dept
        const [df, dg, db] = DEPT_FILL[dept] ?? [220, 252, 231];
        doc.setFillColor(df, dg, db);
        doc.roundedRect(x + 1, y + 1.5, DAY_W - 2, DATA_ROW - 3, 1, 1, 'F');

        // Shift times
        dayShifts.slice(0, 2).forEach((s, si) => {
          const { start, end } = getResolvedStartEndForHours(s, punchRecords);
          const timeStr = `${start}–${end}`;
          const statusC = STATUS_COLOR[s.approval_status] ?? [148, 163, 184];
          doc.setFillColor(...statusC);
          doc.roundedRect(x + 2, y + 2 + si * 4.5, 2, 3, 0.5, 0.5, 'F');

          doc.setTextColor(30, 41, 59);
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'bold');
          doc.text(timeStr, x + 5.5, y + 4.5 + si * 4.5);
        });
        if (dayShifts.length > 2) {
          doc.setFontSize(5.5);
          doc.setTextColor(100, 116, 139);
          doc.text(`+${dayShifts.length - 2}`, x + DAY_W - 6, y + DATA_ROW - 2);
        }
      }
    });

    // Total cell
    const totX2 = MARGIN + NAME_W + numDays * DAY_W;
    doc.setDrawColor(226, 232, 240);
    doc.line(totX2, y, totX2, y + DATA_ROW);
    const weekTotal = totalHours(userShifts, user, breakRules, breakComputeOpts, punchRecords);
    if (weekTotal) {
      doc.setTextColor(...BASILICO);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(weekTotal, totX2 + TOT_W / 2 - doc.getTextWidth(weekTotal) / 2, y + 7.5);
    }

    // Horizontal border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, y, CONTENT_W, DATA_ROW, 'S');

    y += DATA_ROW;

    // Page break
    if (y > PAGE_H - 20 && rowIdx < scheduleUsers.length - 1) {
      doc.addPage();
      y = 18;
    }
  });

  // ── Legend ────────────────────────────────────────────────────────────────
  const legendY = Math.min(y + 6, PAGE_H - 12);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  const legend = [
    { color: STATUS_COLOR.approved, label: t.status_approved },
    { color: STATUS_COLOR.confirmed, label: t.status_confirmed },
    { color: STATUS_COLOR.draft, label: t.status_draft },
    { color: DEPT_FILL.sala, label: t.department_sala, border: DEPT_BORDER.sala },
    { color: DEPT_FILL.kitchen, label: t.department_kitchen, border: DEPT_BORDER.kitchen },
    { color: DEPT_FILL.bar, label: t.department_bar, border: DEPT_BORDER.bar },
  ];
  let lx = MARGIN;
  legend.forEach(({ color, label, border }) => {
    const [r, g, b] = color;
    if (border) {
      doc.setFillColor(r, g, b);
      doc.setDrawColor(...border);
      doc.setLineWidth(0.4);
      doc.roundedRect(lx, legendY, 5, 3, 0.5, 0.5, 'FD');
    } else {
      doc.setFillColor(r, g, b);
      doc.roundedRect(lx, legendY, 5, 3, 0.5, 0.5, 'F');
    }
    doc.setTextColor(71, 85, 105);
    doc.text(label, lx + 6.5, legendY + 2.5);
    lx += 6.5 + doc.getTextWidth(label) + 4;
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  const pageStr = formatTrans(t.schedule_pdf_page_x_of_y, {
    page: 1,
    total: doc.getNumberOfPages(),
  });
  doc.text(pageStr, PAGE_W - MARGIN - doc.getTextWidth(pageStr), PAGE_H - 4);

  // ── Save ──────────────────────────────────────────────────────────────────
  const fileName = `schedule_${format(weekStart, 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}
