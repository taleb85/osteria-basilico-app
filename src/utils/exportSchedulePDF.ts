import { format, addDays } from 'date-fns';
import type { Locale } from 'date-fns';
import { User, Shift, type Language } from '../types';
import { getNetShiftMinutes, type BreakMinutesComputeOptions, type BreakRule } from './breakRules';
import { isPurelyManagementRole } from './permissions';
import { getResolvedStartEndForHours, type PunchRecordLike } from './shiftResolvedClockTimes';
import { formatTrans, getDateLocale, getTranslations } from './translations';

// ── Colours (ULTRA-CLEAN MINIMALISTA) ────────────────────────────────────────

/** ULTRA-CLEAN: solo bianco, nero e grigio chiarissimo */
const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];
const GRAY_ULTRA_LIGHT: [number, number, number] = [229, 231, 235]; // #e5e7eb
const GRAY_TEXT: [number, number, number] = [107, 114, 128]; // #6b7280
const GRAY_OFF: [number, number, number] = [209, 213, 219]; // #d1d5db
const TABLE_LINE: [number, number, number] = [200, 200, 200];
const TABLE_OUTER: [number, number, number] = [150, 150, 150];
const HDR_DARK: [number, number, number] = [13, 31, 60];
const ROW_STRIPE: [number, number, number] = [245, 247, 250];
const HDR_TXT: [number, number, number] = [255, 255, 255];

/** Stati turno: solo grassetto/grigio, no badge visibili */
const STATUS_WEIGHT: Record<string, 'bold' | 'normal'> = {
  approved: 'bold',
  confirmed: 'bold',
  draft: 'normal',
  absent: 'normal',
};
const STATUS_COLOR_MINIMAL: Record<string, [number, number, number]> = {
  approved: BLACK,
  confirmed: BLACK,
  draft: GRAY_TEXT,
  absent: GRAY_OFF,
};

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Valida e formatta orario in formato HH:mm.
 */
function cleanTimeFormat(time: string): string {
  if (!time) return '—';
  let cleaned = time.replace(/:+/g, ':').trim();
  if (/^\d{4}$/.test(cleaned)) {
    cleaned = `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`;
  }
  return /^\d{2}:\d{2}$/.test(cleaned) ? cleaned : '—';
}

function fmtDay(date: Date, locale: Locale): string {
  return format(date, 'EEE d', { locale }).toUpperCase();
}

function isShiftAbsent(s: Shift): boolean {
  return String(s.approval_status).toLowerCase() === 'absent';
}

/** Soglia: inizio dopo 16:00 = fascia “sera” in basso nella cella PDF. */
const EVENING_START_AFTER_MIN = 16 * 60; // 16:00 esclusa dalla fascia sera

/** Minuti da mezzanotte dall’inizio del turno. */
function shiftStartMinutes(s: Shift, punchRecords: PunchRecordLike[]): number {
  const { start } = getResolvedStartEndForHours(s, punchRecords);
  if (!start || start === '—') return 99 * 60;
  const part = (start as string).replace(/:+/g, ':').trim().slice(0, 5);
  const m = part.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 99 * 60;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10) || 0));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10) || 0));
  return h * 60 + min;
}

/**
 * Turni non assenti: prima quelli con inizio ≤ 16:00, poi quelli con inizio dopo le 16:00;
 * dentro ogni gruppo, ordine cronologico.
 */
function sortShiftsLunchBlockThenEvening(
  dayShifts: Shift[],
  punchRecords: PunchRecordLike[]
): Shift[] {
  const work = dayShifts.filter((s) => !isShiftAbsent(s));
  return [...work].sort((a, b) => {
    const ma = shiftStartMinutes(a, punchRecords);
    const mb = shiftStartMinutes(b, punchRecords);
    const groupA = ma > EVENING_START_AFTER_MIN ? 1 : 0;
    const groupB = mb > EVENING_START_AFTER_MIN ? 1 : 0;
    if (groupA !== groupB) return groupA - groupB;
    return ma - mb;
  });
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
    /** Lingua UI utente (etichette PDF). */
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
    language: langOpt,
  } = options;
  const { jsPDF } = await import('jspdf');

  const language = langOpt ?? 'it';
  const t = getTranslations(language);
  const locale = getDateLocale(language) as Locale;

  /** Difesa in profondità: l'admin non deve mai comparire nel PDF anche se passato per errore. */
  const scheduleUsers = activeUsers.filter((u) => !isPurelyManagementRole(u.role));

  // ── Split in settimane (1 pagina per settimana se periodo lungo) ──────────
  const weekChunks: Date[][] = [];
  for (let i = 0; i < weekDays.length; i += 7) {
    weekChunks.push(weekDays.slice(i, i + 7));
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PAGE_W = 297;
  const PAGE_H = 210;
  const MARGIN = 12;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  // ── Loop: 1 pagina per ogni settimana ─────────────────────────────────────
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

    // Column widths
    const NAME_W = 38;
    const DAY_W = (CONTENT_W - NAME_W - 24) / numDays;
    const TOT_W = 24;

    // Row heights
    const HEADER_ROW = 14;
    const DATA_ROW = 18;

    // ── Page header (MINIMALISTA) ──────────────────────────────────────────────
    doc.setTextColor(...BLACK);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    
    let rangeLabelX = MARGIN;
    if (restaurantName) {
      doc.text(restaurantName, MARGIN, 14);
      rangeLabelX = MARGIN + 65;
    }

    // Week range
    const rangeLabel = `${format(chunkStart, 'd MMMM', { locale })} – ${format(addDays(chunkEnd, -1), 'd MMMM yyyy', { locale })}`;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_TEXT);
    doc.text(rangeLabel, rangeLabelX, 14);

    if (filterLabel) {
      doc.text(`· ${filterLabel}`, rangeLabelX + doc.getTextWidth(rangeLabel) + 2, 14);
    }

    // Print timestamp
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_ULTRA_LIGHT);
    const printedAt = formatTrans(t.ts_pdf_printed_on, {
      datetime: format(new Date(), 'd MMM yyyy HH:mm', { locale }),
    });
    doc.text(printedAt, PAGE_W - MARGIN - doc.getTextWidth(printedAt), 14);

    // Linea separator
    doc.setDrawColor(...GRAY_ULTRA_LIGHT);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, 20, PAGE_W - MARGIN, 20);

    // ── Column headers (griglia e bordi visibili) ──────────────────────────────
    let y = 26;
    doc.setFillColor(...HDR_DARK);
    doc.rect(MARGIN, y, CONTENT_W, HEADER_ROW, 'F');
    doc.setTextColor(...HDR_TXT);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(t.ts_pdf_col_employee, MARGIN + 2, y + 5);

    weekDaysChunk.forEach((day, i) => {
      const x = MARGIN + NAME_W + i * DAY_W;
      const label = fmtDay(day, locale);
      doc.text(label, x + DAY_W / 2 - doc.getTextWidth(label) / 2, y + 5);
    });

    const totX = MARGIN + NAME_W + numDays * DAY_W;
    const totLabel = t.schedule_pdf_total_abbr;
    doc.text(totLabel, totX + TOT_W / 2 - doc.getTextWidth(totLabel) / 2, y + 5);

    doc.setDrawColor(...TABLE_OUTER);
    doc.setLineWidth(0.5);
    doc.rect(MARGIN, y, CONTENT_W, HEADER_ROW, 'S');
    doc.setDrawColor(...TABLE_LINE);
    doc.setLineWidth(0.4);
    for (let v = 0; v <= numDays; v++) {
      const vx = MARGIN + NAME_W + v * DAY_W;
      doc.line(vx, y, vx, y + HEADER_ROW);
    }
    doc.line(MARGIN + CONTENT_W, y, MARGIN + CONTENT_W, y + HEADER_ROW);

    y += HEADER_ROW;

    // ── Data rows ──────────────────────────────────────────────────────────────
    let prevDept = '';
    let employeesOnCurrentPage = 0;
    const MAX_EMPLOYEES_PER_PAGE = 10;

    scheduleUsers.forEach((user, rowIdx) => {
      // Page break ogni 10 dipendenti
      if (employeesOnCurrentPage >= MAX_EMPLOYEES_PER_PAGE && rowIdx < scheduleUsers.length - 1) {
        doc.addPage();
        y = 24;
        prevDept = '';
        employeesOnCurrentPage = 0;
        
        // Ripeti header colonne
        doc.setFillColor(...HDR_DARK);
        doc.rect(MARGIN, y, CONTENT_W, HEADER_ROW, 'F');
        doc.setTextColor(...HDR_TXT);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(t.ts_pdf_col_employee, MARGIN + 2, y + 5);
        weekDaysChunk.forEach((day, i) => {
          const x = MARGIN + NAME_W + i * DAY_W;
          const label = fmtDay(day, locale);
          doc.text(label, x + DAY_W / 2 - doc.getTextWidth(label) / 2, y + 5);
        });
        const totXH = MARGIN + NAME_W + numDays * DAY_W;
        const totLabel2 = t.schedule_pdf_total_abbr;
        doc.text(totLabel2, totXH + TOT_W / 2 - doc.getTextWidth(totLabel2) / 2, y + 5);
        doc.setDrawColor(...TABLE_OUTER);
        doc.setLineWidth(0.5);
        doc.rect(MARGIN, y, CONTENT_W, HEADER_ROW, 'S');
        doc.setDrawColor(...TABLE_LINE);
        doc.setLineWidth(0.4);
        for (let v = 0; v <= numDays; v++) {
          const vx = MARGIN + NAME_W + v * DAY_W;
          doc.line(vx, y, vx, y + HEADER_ROW);
        }
        doc.line(MARGIN + CONTENT_W, y, MARGIN + CONTENT_W, y + HEADER_ROW);
        y += HEADER_ROW;
      }

      // Separator tra reparti
      const dept = user.department ?? 'sala_bar';
      if (dept !== prevDept && rowIdx > 0) {
        doc.setDrawColor(...TABLE_LINE);
        doc.setLineWidth(0.45);
        doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
      }
      prevDept = dept;

      doc.setFillColor(...(rowIdx % 2 === 0 ? WHITE : ROW_STRIPE));
      doc.rect(MARGIN, y, CONTENT_W, DATA_ROW, 'F');

      // Name
      doc.setTextColor(...BLACK);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      const firstName = user.first_name.toUpperCase();
      doc.text(firstName, MARGIN + 2, y + 7);
      if (user.last_name) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY_TEXT);
        doc.text(user.last_name.toUpperCase(), MARGIN + 2, y + 12);
      }

      // Day cells
      const userShifts: Shift[] = [];

      weekDaysChunk.forEach((day, i) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayShifts = weekShifts.filter(
          (s) => s.user_id === user.id && s.date === dateStr
        );
        userShifts.push(...dayShifts);

        const x = MARGIN + NAME_W + i * DAY_W;
        const ordered = sortShiftsLunchBlockThenEvening(dayShifts, punchRecords);

        if (ordered.length > 0) {
          ordered.slice(0, 2).forEach((s, si) => {
            const { start, end } = getResolvedStartEndForHours(s, punchRecords);
            const cleanStart = cleanTimeFormat(start);
            const cleanEnd = cleanTimeFormat(end);
            const timeStr = `${cleanStart}–${cleanEnd}`;

            const statusColor = STATUS_COLOR_MINIMAL[s.approval_status] ?? BLACK;
            const statusWeight = STATUS_WEIGHT[s.approval_status] ?? 'normal';

            doc.setTextColor(...statusColor);
            doc.setFontSize(10);
            doc.setFont('helvetica', statusWeight);
            doc.text(timeStr, x + 3, y + 6 + si * 6);
          });
          if (ordered.length > 2) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...GRAY_TEXT);
            doc.text(`+${ordered.length - 2}`, x + DAY_W - 8, y + DATA_ROW - 3);
          }
        }
      });

      // Total cell
      const totX2 = MARGIN + NAME_W + numDays * DAY_W;
      const weekTotal = totalHours(userShifts, user, breakRules, breakComputeOpts, punchRecords);
      if (weekTotal) {
        doc.setTextColor(...BLACK);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        const tw = doc.getTextWidth(weekTotal);
        doc.text(weekTotal, totX2 + TOT_W / 2 - tw / 2, y + 10);
      }

      doc.setDrawColor(...TABLE_OUTER);
      doc.setLineWidth(0.5);
      doc.rect(MARGIN, y, CONTENT_W, DATA_ROW, 'S');
      doc.setDrawColor(...TABLE_LINE);
      doc.setLineWidth(0.35);
      for (let v = 0; v <= numDays; v++) {
        const vx = MARGIN + NAME_W + v * DAY_W;
        doc.line(vx, y, vx, y + DATA_ROW);
      }
      doc.line(MARGIN + CONTENT_W, y, MARGIN + CONTENT_W, y + DATA_ROW);

      y += DATA_ROW;
      employeesOnCurrentPage++;
    });

    // ── Legend (solo prima pagina/settimana) ───────────────────────────────────
    if (chunkIdx === 0) {
      const legendY = Math.min(y + 8, PAGE_H - 14);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      
      const legend = [
        { label: `${t.status_approved}: ${t.status_confirmed} (grassetto)` },
        { label: `${t.status_draft} (grigio)` },
      ];
      
      let lx = MARGIN;
      legend.forEach(({ label }) => {
        doc.setTextColor(...GRAY_TEXT);
        doc.setFont('helvetica', 'normal');
        doc.text(label, lx, legendY + 2.5);
        lx += doc.getTextWidth(label) + 8;
      });
    }
  });

  // ── Footer (tutte le pagine) ──────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_ULTRA_LIGHT);
    const pageStr = formatTrans(t.schedule_pdf_page_x_of_y, {
      page: p,
      total: totalPages,
    });
    doc.text(pageStr, PAGE_W - MARGIN - doc.getTextWidth(pageStr), PAGE_H - 5);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const fileName = weekChunks.length > 1
    ? `schedule_${format(weekDays[0], 'yyyy-MM-dd')}_to_${format(weekDays[weekDays.length - 1], 'yyyy-MM-dd')}.pdf`
    : `schedule_${format(weekStart, 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}
