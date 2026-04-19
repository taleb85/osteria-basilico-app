import { format, addDays } from 'date-fns';
import type { Locale } from 'date-fns';
import { User, Shift, type Language } from '../types';
import { getNetShiftMinutes, type BreakMinutesComputeOptions, type BreakRule } from './breakRules';
import { isPurelyManagementRole } from './permissions';
import { getResolvedStartEndForHours, type PunchRecordLike } from './shiftResolvedClockTimes';
import { formatTrans, getDateLocale, getTranslations } from './translations';

// ── Colours (HIGH-CONTRAST B&W) ──────────────────────────────────────────────

/** HIGH-CONTRAST B&W: solo bianco, nero, grigi */
const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];
const GRAY_LIGHT: [number, number, number] = [242, 242, 242];
const GRAY_MID: [number, number, number] = [224, 224, 224];
const GRAY_DARK: [number, number, number] = [51, 51, 51];
const GRAY_BORDER: [number, number, number] = [153, 153, 153];

/** Badge stati turno: B&W uniformi */
const STATUS_COLOR: Record<string, [number, number, number]> = {
  approved: BLACK,    // nero pieno
  confirmed: GRAY_DARK, // grigio scuro
  draft: GRAY_MID,    // grigio medio
  absent: GRAY_BORDER, // grigio chiaro
};

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Valida e formatta orario in formato HH:mm.
 * Rimuove doppi punti, spazi extra, garantisce sempre 5 caratteri.
 */
function cleanTimeFormat(time: string): string {
  if (!time) return '—';
  // Rimuovi doppi punti (es. "23::00" → "23:00")
  let cleaned = time.replace(/:+/g, ':');
  // Rimuovi spazi
  cleaned = cleaned.trim();
  // Se è nel formato "HHmm" (senza ":"), aggiungi ":"
  if (/^\d{4}$/.test(cleaned)) {
    cleaned = `${cleaned.slice(0, 2)}:${cleaned.slice(2)}`;
  }
  // Verifica formato finale HH:mm
  if (!/^\d{2}:\d{2}$/.test(cleaned)) {
    return '—';
  }
  return cleaned;
}

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
    restaurantName = 'FLOW',
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
  const NAME_W = 36; // aumentato da 32 per nomi più grandi
  const DAY_W = (CONTENT_W - NAME_W - 22) / numDays; // 22 = total hours col (aumentata da 20)
  const TOT_W = 22;

  // Row heights (aumentate per +30% spacing)
  const HEADER_ROW = 12; // da 10
  const DATA_ROW = 16;   // da 12 (+33% padding)

  // ── Page header ────────────────────────────────────────────────────────────
  // HIGH-CONTRAST B&W: header nero con testo bianco
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, PAGE_W, 18, 'F');

  // Restaurant name (MAXI-SIZE)
  doc.setTextColor(...WHITE);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(restaurantName, MARGIN, 12);

  // Week range
  const rangeLabel = `${format(weekStart, 'd MMMM', { locale })} – ${format(addDays(weekEnd, -1), 'd MMMM yyyy', { locale })}`;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(rangeLabel, MARGIN + 60, 12);

  if (filterLabel) {
    doc.text(`· ${filterLabel}`, MARGIN + 60 + doc.getTextWidth(rangeLabel) + 2, 12);
  }

  // Print timestamp (right)
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_MID);
  const printedAt = formatTrans(t.ts_pdf_printed_on, {
    datetime: format(new Date(), 'd MMM yyyy HH:mm', { locale }),
  });
  doc.text(printedAt, PAGE_W - MARGIN - doc.getTextWidth(printedAt), 12);

  // ── Column headers ─────────────────────────────────────────────────────────
  let y = 22;
  // B&W: sfondo bianco, bordo nero spesso
  doc.setFillColor(...WHITE);
  doc.rect(MARGIN, y, CONTENT_W, HEADER_ROW, 'F');
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(1);
  doc.rect(MARGIN, y, CONTENT_W, HEADER_ROW, 'S');

  // Name column header (MAXI-SIZE)
  doc.setTextColor(...BLACK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(t.ts_pdf_col_employee, MARGIN + 2, y + 7);

  // Day column headers
  weekDays.forEach((day, i) => {
    const x = MARGIN + NAME_W + i * DAY_W;
    const isWeekend = [0, 6].includes(day.getDay());
    if (isWeekend) {
      doc.setFillColor(...GRAY_LIGHT);
      doc.rect(x, y, DAY_W, HEADER_ROW, 'F');
    }
    doc.setTextColor(...BLACK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const label = fmtDay(day, locale);
    doc.text(label, x + DAY_W / 2 - doc.getTextWidth(label) / 2, y + 7);
  });

  // Total column header (MAXI-SIZE)
  const totX = MARGIN + NAME_W + numDays * DAY_W;
  doc.setTextColor(...BLACK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const totLabel = t.schedule_pdf_total_abbr;
  doc.text(totLabel, totX + TOT_W / 2 - doc.getTextWidth(totLabel) / 2, y + 7);

  y += HEADER_ROW;

  // ── Data rows ──────────────────────────────────────────────────────────────
  let prevDept = '';

  scheduleUsers.forEach((user, rowIdx) => {
    // Department separator (linea nera sottile)
    const dept = user.department ?? 'sala_bar';
    if (dept !== prevDept && rowIdx > 0) {
      doc.setDrawColor(...BLACK);
      doc.setLineWidth(0.8);
      doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
    }
    prevDept = dept;

    // HIGH-CONTRAST B&W: alternare bianco puro e grigio chiarissimo
    const rowBg: [number, number, number] = rowIdx % 2 === 0 ? WHITE : GRAY_LIGHT;
    doc.setFillColor(...rowBg);
    doc.rect(MARGIN, y, CONTENT_W, DATA_ROW, 'F');

    // Accent bar nero a sinistra (invece di colori reparto)
    doc.setFillColor(...BLACK);
    doc.rect(MARGIN, y, 2, DATA_ROW, 'F');

    // Name (MAXI-SIZE: 12pt nome, 10pt cognome)
    doc.setTextColor(...BLACK);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const firstName = user.first_name.toUpperCase();
    doc.text(firstName, MARGIN + 4, y + 6);
    if (user.last_name) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY_DARK);
      doc.text(user.last_name.toUpperCase(), MARGIN + 4, y + 10);
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
        const [fr, fg, fb] = rowIdx % 2 === 0 ? GRAY_LIGHT : GRAY_MID;
        doc.setFillColor(fr, fg, fb);
        doc.rect(x, y, DAY_W, DATA_ROW, 'F');
      }

      // Vertical separator (nero)
      doc.setDrawColor(...BLACK);
      doc.setLineWidth(0.5);
      doc.line(x, y, x, y + DATA_ROW);

      if (dayShifts.length > 0) {
        // Cell fill: bianco puro per turni confermati
        doc.setFillColor(...WHITE);
        doc.roundedRect(x + 1, y + 1.5, DAY_W - 2, DATA_ROW - 3, 1, 1, 'F');
        doc.setDrawColor(...BLACK);
        doc.setLineWidth(1);
        doc.roundedRect(x + 1, y + 1.5, DAY_W - 2, DATA_ROW - 3, 1, 1, 'S');

        // Shift times (MONOSPACE, MAXI-SIZE)
        dayShifts.slice(0, 2).forEach((s, si) => {
          const isAbsent = String(s.approval_status).toLowerCase() === 'absent';
          const { start, end } = getResolvedStartEndForHours(s, punchRecords);
          // Valida formato orari
          const cleanStart = cleanTimeFormat(start);
          const cleanEnd = cleanTimeFormat(end);
          const timeStr = isAbsent ? t.status_absent : `${cleanStart}–${cleanEnd}`;
          
          // Status badge: nero per approved, grigio scuro per confirmed, grigio per draft
          const statusC = STATUS_COLOR[s.approval_status] ?? GRAY_BORDER;
          doc.setFillColor(...statusC);
          doc.roundedRect(x + 2, y + 2 + si * 5, 2.5, 3.5, 0.5, 0.5, 'F');

          // Orari in Courier (monospace) MAXI-SIZE
          doc.setTextColor(...BLACK);
          doc.setFontSize(9);
          doc.setFont('courier', 'bold');
          doc.text(timeStr, x + 6, y + 5 + si * 5);
        });
        if (dayShifts.length > 2) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...GRAY_DARK);
          doc.text(`+${dayShifts.length - 2}`, x + DAY_W - 6, y + DATA_ROW - 2);
        }
      }
    });

    // Total cell (BOX NERO SPESSO con testo bianco)
    const totX2 = MARGIN + NAME_W + numDays * DAY_W;
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(2);
    doc.line(totX2, y, totX2, y + DATA_ROW);
    const weekTotal = totalHours(userShifts, user, breakRules, breakComputeOpts, punchRecords);
    if (weekTotal) {
      // Box nero con testo bianco per totale ore
      doc.setFillColor(...BLACK);
      doc.roundedRect(totX2 + 2, y + 2.5, TOT_W - 4, DATA_ROW - 5, 1, 1, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(10);
      doc.setFont('courier', 'bold');
      const tw = doc.getTextWidth(weekTotal);
      doc.text(weekTotal, totX2 + TOT_W / 2 - tw / 2, y + 8);
    }

    // Horizontal border (nero)
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.5);
    doc.rect(MARGIN, y, CONTENT_W, DATA_ROW, 'S');

    y += DATA_ROW;

    // Page break
    if (y > PAGE_H - 20 && rowIdx < scheduleUsers.length - 1) {
      doc.addPage();
      y = 18;
    }
  });

  // ── Legend (B&W) ──────────────────────────────────────────────────────────
  const legendY = Math.min(y + 6, PAGE_H - 12);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  
  // HIGH-CONTRAST B&W: solo stati turno (nero, grigio scuro, grigio medio)
  const legend = [
    { color: STATUS_COLOR.approved, label: t.status_approved },
    { color: STATUS_COLOR.confirmed, label: t.status_confirmed },
    { color: STATUS_COLOR.draft, label: t.status_draft },
  ];
  
  let lx = MARGIN;
  legend.forEach(({ color, label }) => {
    const [r, g, b] = color;
    doc.setFillColor(r, g, b);
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.5);
    doc.roundedRect(lx, legendY, 6, 3.5, 0.5, 0.5, 'FD');
    doc.setTextColor(...BLACK);
    doc.setFont('helvetica', 'bold');
    doc.text(label, lx + 7.5, legendY + 2.8);
    lx += 7.5 + doc.getTextWidth(label) + 5;
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(...GRAY_DARK);
  const pageStr = formatTrans(t.schedule_pdf_page_x_of_y, {
    page: 1,
    total: doc.getNumberOfPages(),
  });
  doc.text(pageStr, PAGE_W - MARGIN - doc.getTextWidth(pageStr), PAGE_H - 4);

  // ── Save ──────────────────────────────────────────────────────────────────
  const fileName = `schedule_${format(weekStart, 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}
