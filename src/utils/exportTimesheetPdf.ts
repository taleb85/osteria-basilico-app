import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { isPurelyManagementRole } from './permissions';

export type TimesheetPdfUser = {
  id: string;
  first_name: string;
  last_name?: string;
  department?: string;
  /** Se presente, esclude admin dai totali stampati (difesa in profondità). */
  role?: string;
};

export type TimesheetPdfShiftRow = {
  plannedStart: string;
  plannedEnd: string;
  plannedMins: number;
  breakMinutes: number;
  actualStart: string | null;
  actualEnd: string | null;
  actualMins: number;
  deltaMins: number;
  status: string;
  punched: boolean;
  hasMissingOut: boolean;
};

export type TimesheetPdfDayData = {
  shifts: TimesheetPdfShiftRow[];
  totalPlannedMins: number;
  totalActualMins: number;
  totalDeltaMins: number;
};

export type TimesheetPdfShiftMeta = {
  approval_status: string;
  approved_by?: string | null;
  approved_at?: string | null;
};

export type ExportTimesheetPdfParams = {
  weekDays: Date[];
  weekStart: Date;
  locale: Locale;
  t: Record<string, string>;
  formatTrans: (template: string, vars: Record<string, string | number>) => string;
  visibleUsers: TimesheetPdfUser[];
  timesheetData: Record<string, Record<string, TimesheetPdfDayData>>;
  userTotals: Record<string, { plannedMins: number; actualMins: number; deltaMins: number }>;
  weekShifts: TimesheetPdfShiftMeta[];
  fmtHM: (mins: number) => string;
};

export function exportTimesheetPdfToFile(params: ExportTimesheetPdfParams): void {
  const {
    weekDays,
    weekStart,
    locale,
    t,
    formatTrans,
    visibleUsers,
    timesheetData,
    userTotals,
    weekShifts,
    fmtHM,
  } = params;

  const pdfUsers = visibleUsers.filter((u) => !u.role || !isPurelyManagementRole(u.role));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ── Costanti layout ────────────────────────────────────────────────
  const PW = 297, PH = 210, MG = 10, CW = PW - MG * 2;
  const NAME_W = 34, PAUSA_W = 12, TOT_W = 24;
  const NUM_DAYS = Math.max(1, weekDays.length);
  const DAY_W = (CW - NAME_W - PAUSA_W - TOT_W) / NUM_DAYS;
  const H_HDR = 12, H_ROW = 17, H_TOT = 7, H_FOOT = 8;

// Palette brand #2D5A27
const C_TEAL   : [number,number,number] = [45, 90, 39];
const C_TEAL_L : [number,number,number] = [220, 230, 218];
const C_GRID   : [number,number,number] = [226, 232, 240];
const C_HDR_BG : [number,number,number] = [241, 245, 249];
const C_ROW_ALT: [number,number,number] = [248, 250, 252];
const C_DARK   : [number,number,number] = [30,  41,  59];
const C_MID    : [number,number,number] = [100, 116, 139];
const C_LIGHT  : [number,number,number] = [148, 163, 184];
const C_GREEN  : [number,number,number] = [45, 90, 39];
const C_RED    : [number,number,number] = [239, 68,  68];
const C_AMBER  : [number,number,number] = [245, 158, 11];
const C_BLUE   : [number,number,number] = [59,  130, 246];

const grid = () => { doc.setDrawColor(...C_GRID); doc.setLineWidth(0.1); };
const setTxt = (sz: number, style: 'normal'|'bold', rgb: [number,number,number]) => {
  doc.setFontSize(sz); doc.setFont('helvetica', style); doc.setTextColor(...rgb);
};
const rightText = (text: string, rightEdge: number, y: number) => {
  doc.text(text, rightEdge - doc.getTextWidth(text), y);
};
const centerText = (text: string, xStart: number, width: number, y: number) => {
  doc.text(text, xStart + width / 2 - doc.getTextWidth(text) / 2, y);
};

// ── PAGE HEADER ────────────────────────────────────────────────────
doc.setFillColor(...C_TEAL);
doc.rect(0, 0, PW, 18, 'F');
setTxt(14, 'bold', [255,255,255]);
doc.text(t.ts_brand_name, MG, 12);
const lastDay = weekDays[weekDays.length - 1] ?? weekStart;
const wkLabel = formatTrans(t.ts_pdf_week_title, {
  from: format(weekStart, 'd MMM', { locale }),
  to: format(lastDay, 'd MMM yyyy', { locale }),
});
setTxt(9, 'normal', C_TEAL_L);
doc.text(wkLabel, MG + 54, 12);
const stampato = formatTrans(t.ts_pdf_printed_on, {
  datetime: format(new Date(), 'd MMM yyyy HH:mm', { locale }),
});
setTxt(7, 'normal', C_TEAL_L);
doc.text(stampato, PW - MG - doc.getTextWidth(stampato), 12);

let y = 20;

// ── INTESTAZIONI COLONNE (sfondo grigio) ───────────────────────────
doc.setFillColor(...C_HDR_BG);
doc.rect(MG, y, CW, H_HDR, 'F');
grid(); doc.rect(MG, y, CW, H_HDR, 'S');

setTxt(7, 'bold', C_MID);
doc.text(t.ts_pdf_col_employee, MG + 2, y + 8);
grid(); doc.line(MG + NAME_W, y, MG + NAME_W, y + H_HDR);

weekDays.forEach((day, i) => {
  const x = MG + NAME_W + i * DAY_W;
  const isWE = [0,6].includes(day.getDay());
  const isNow = format(day,'yyyy-MM-dd') === format(new Date(),'yyyy-MM-dd');
  if (isWE)  { doc.setFillColor(235,240,246); doc.rect(x, y, DAY_W, H_HDR, 'F'); }
  if (isNow) { doc.setFillColor(220,240,235); doc.rect(x, y, DAY_W, H_HDR, 'F'); }

  const dColor: [number,number,number] = isNow ? C_TEAL : isWE ? C_LIGHT : C_MID;
  setTxt(7, 'bold', dColor);
  centerText(format(day,'EEE',{locale}).toUpperCase(), x, DAY_W, y + 5.5);
  setTxt(6, 'normal', dColor);
  centerText(format(day,'d/M'), x, DAY_W, y + 9.5);
  grid(); doc.line(x, y, x, y + H_HDR);
});

const pausaXhdr = MG + NAME_W + NUM_DAYS * DAY_W;
grid(); doc.line(pausaXhdr, y, pausaXhdr, y + H_HDR);
setTxt(6, 'bold', C_MID);
centerText(t.ts_pdf_col_break, pausaXhdr, PAUSA_W, y + 8);
const totXhdr = pausaXhdr + PAUSA_W;
grid(); doc.line(totXhdr, y, totXhdr, y + H_HDR);
setTxt(7, 'bold', C_TEAL);
centerText(t.ts_pdf_col_total_hrs, totXhdr, TOT_W, y + 8);
y += H_HDR;

// ── RIGHE DATI (zebra striping + griglia completa 0.1mm) ──────────
pdfUsers.forEach((user, rowIdx) => {
  if (y > PH - H_FOOT - H_TOT - 15) {
    doc.addPage();
    y = 10;
    // Ri-stampa intestazioni colonne
    doc.setFillColor(...C_HDR_BG);
    doc.rect(MG, y, CW, H_HDR, 'F');
    grid(); doc.rect(MG, y, CW, H_HDR, 'S');
    setTxt(7, 'bold', C_MID);
    doc.text(t.ts_pdf_col_employee, MG + 2, y + 8);
    weekDays.forEach((day, i) => {
      const x = MG + NAME_W + i * DAY_W;
      grid(); doc.line(x, y, x, y + H_HDR);
      setTxt(6, 'bold', C_MID);
      centerText(format(day,'EEE d/M',{locale}).toUpperCase(), x, DAY_W, y + 7.5);
    });
    grid(); doc.line(MG + NAME_W, y, MG + NAME_W, y + H_HDR);
    const pX = MG + NAME_W + NUM_DAYS * DAY_W;
    grid(); doc.line(pX, y, pX, y + H_HDR);
    setTxt(6, 'bold', C_MID);
    centerText(t.ts_pdf_col_break, pX, PAUSA_W, y + 8);
    const tXh = pX + PAUSA_W;
    grid(); doc.line(tXh, y, tXh, y + H_HDR);
    setTxt(7, 'bold', C_TEAL);
    centerText(t.ts_pdf_col_total_hrs, tXh, TOT_W, y + 8);
    y += H_HDR;
  }

  const rowBg: [number,number,number] = rowIdx % 2 === 0 ? [255,255,255] : C_ROW_ALT;
  doc.setFillColor(...rowBg);
  doc.rect(MG, y, CW, H_ROW, 'F');

  // Nome
  setTxt(8, 'bold', C_DARK);
  doc.text(user.first_name.toUpperCase(), MG + 2.5, y + 6);
  if (user.last_name) {
    setTxt(6.5, 'normal', C_MID);
    doc.text(user.last_name.toUpperCase(), MG + 2.5, y + 10.5);
  }
  if (user.department) {
    setTxt(5.5, 'normal', C_LIGHT);
    doc.text(user.department.toUpperCase(), MG + 2.5, y + 14.5);
  }

  // Celle giornaliere
  weekDays.forEach((day, i) => {
    const dateStr = format(day,'yyyy-MM-dd');
    const dayData = timesheetData[user.id]?.[dateStr];
    const x = MG + NAME_W + i * DAY_W;
    const isWE = [0,6].includes(day.getDay());
    const isNow = dateStr === format(new Date(),'yyyy-MM-dd');

    if (isWE) {
      const bg: [number,number,number] = rowIdx%2===0 ? [248,250,252] : [241,245,249];
      doc.setFillColor(...bg); doc.rect(x, y, DAY_W, H_ROW, 'F');
    }
    if (isNow) { doc.setFillColor(230,247,243); doc.rect(x, y, DAY_W, H_ROW, 'F'); }

    if (!dayData || dayData.shifts.length === 0) {
      setTxt(8, 'normal', C_LIGHT);
      centerText('—', x, DAY_W, y + H_ROW/2 + 1.5);
    } else {
      dayData.shifts.slice(0, 2).forEach((s, si) => {
        const oy = si * 8;
        // Dot status
        const dotC: [number,number,number] =
          s.status==='approved' ? C_GREEN :
          s.hasMissingOut ? C_RED :
          s.punched && !!s.actualEnd ? C_BLUE :
          s.punched ? C_AMBER : C_LIGHT;
        doc.setFillColor(...dotC);
        doc.circle(x + 2.2, y + 4.5 + oy, 1.1, 'F');

        // Orario pianificato — sinistra, grigio 6pt
        setTxt(5.5, 'normal', C_MID);
        doc.text(`${s.plannedStart}–${s.plannedEnd}`, x + 4.5, y + 5.5 + oy);

        // Ore timbrate — destra, bold (allineate a destra)
        if (s.punched && s.actualEnd && s.actualMins > 0) {
          const hStr = fmtHM(s.actualMins);
          const dStr = `${s.deltaMins>=0?'+':''}${fmtHM(s.deltaMins)}`;
          setTxt(7, 'bold', C_DARK);
          rightText(hStr, x + DAY_W - 1, y + 5.5 + oy);
          const deltaC: [number,number,number] = s.deltaMins >= 0 ? C_GREEN : C_RED;
          setTxt(5.5, 'normal', deltaC);
          rightText(dStr, x + DAY_W - 1, y + 10 + oy);
        } else if (s.punched && s.actualStart) {
          setTxt(5.5, 'bold', C_AMBER);
          rightText(t.ts_pdf_punch_in_only, x + DAY_W - 1, y + 5.5 + oy);
        }
      });
    }
  });

  // Colonna PAUSA — minuti sottratti (es. -30m)
  const pausaX2 = MG + NAME_W + NUM_DAYS * DAY_W;
  const userBreakTotal = weekDays.reduce((sum, d) => {
    const dd = timesheetData[user.id]?.[format(d, 'yyyy-MM-dd')];
    return sum + (dd?.shifts.reduce((s, sh) => s + sh.breakMinutes, 0) ?? 0);
  }, 0);
  if (userBreakTotal > 0) {
    setTxt(6, 'normal', C_MID);
    centerText(`−${userBreakTotal}m`, pausaX2, PAUSA_W, y + H_ROW / 2 + 1.5);
  }

  // Colonna TOTALE — ore allineate a destra
  const totX2 = pausaX2 + PAUSA_W;
  const tot = userTotals[user.id];
  if (tot) {
    setTxt(6.5, 'normal', C_MID);
    rightText(fmtHM(tot.plannedMins), totX2 + TOT_W - 2, y + 5.5);
    if (tot.actualMins > 0) {
      setTxt(8.5, 'bold', C_TEAL);
      rightText(fmtHM(tot.actualMins), totX2 + TOT_W - 2, y + 11.5);
      const dc: [number,number,number] = tot.deltaMins>=0 ? C_GREEN : C_RED;
      setTxt(5.5, 'bold', dc);
      rightText(`${tot.deltaMins>=0?'+':''}${fmtHM(tot.deltaMins)}`, totX2 + TOT_W - 2, y + 15.5);
    }
  }

  // Griglia completa riga (0.1mm)
  grid();
  doc.rect(MG, y, CW, H_ROW, 'S');
  doc.line(MG + NAME_W, y, MG + NAME_W, y + H_ROW);
  weekDays.forEach((_, i) => {
    doc.line(MG + NAME_W + i * DAY_W, y, MG + NAME_W + i * DAY_W, y + H_ROW);
  });
  doc.line(pausaX2, y, pausaX2, y + H_ROW);
  doc.line(totX2, y, totX2, y + H_ROW);

  y += H_ROW;
});

// ── RIGA TOTALI PERIODO (pianificato + effettivo + delta, come colonna ORE TOT) ──
const H_SUM_ROW = 14;
doc.setFillColor(...C_HDR_BG);
doc.rect(MG, y, CW, H_SUM_ROW, 'F');
grid(); doc.rect(MG, y, CW, H_SUM_ROW, 'S');
setTxt(6.5, 'bold', C_MID);
doc.text(t.ts_pdf_row_total, MG + 2, y + 5.5);
doc.line(MG + NAME_W, y, MG + NAME_W, y + H_SUM_ROW);

weekDays.forEach((day, i) => {
  const ds = format(day,'yyyy-MM-dd');
  const gPlanned = pdfUsers.reduce((s,u)=>s+(timesheetData[u.id]?.[ds]?.totalPlannedMins??0),0);
  const gActual  = pdfUsers.reduce((s,u)=>s+(timesheetData[u.id]?.[ds]?.totalActualMins??0),0);
  const x = MG + NAME_W + i * DAY_W;
  grid(); doc.line(x, y, x, y + H_SUM_ROW);
  if (gPlanned > 0) {
    setTxt(5.5, 'normal', C_MID);
    doc.text(fmtHM(gPlanned), x + 1.5, y + 4);
  }
  if (gActual > 0) {
    setTxt(6, 'bold', C_TEAL);
    doc.text(fmtHM(gActual), x + 1.5, y + 8.5);
  }
});

const pausaXf = MG + NAME_W + NUM_DAYS * DAY_W;
grid(); doc.line(pausaXf, y, pausaXf, y + H_SUM_ROW);
const grandBreak = pdfUsers.reduce((s,u)=>s+weekDays.reduce((sd,d)=>{
  const dd = timesheetData[u.id]?.[format(d,'yyyy-MM-dd')];
  return sd + (dd?.shifts.reduce((sm,sh)=>sm+sh.breakMinutes,0)??0);
},0),0);
if (grandBreak > 0) {
  setTxt(5.5, 'normal', C_MID);
  centerText(`−${grandBreak}m`, pausaXf, PAUSA_W, y + 7);
}
const totXf = pausaXf + PAUSA_W;
grid(); doc.line(totXf, y, totXf, y + H_SUM_ROW);
const grandActual  = pdfUsers.reduce((s,u)=>s+(userTotals[u.id]?.actualMins??0),0);
const grandPlanned = pdfUsers.reduce((s,u)=>s+(userTotals[u.id]?.plannedMins??0),0);
const grandDelta = grandActual - grandPlanned;
if (grandPlanned > 0) {
  setTxt(6.5, 'normal', C_MID);
  rightText(fmtHM(grandPlanned), totXf + TOT_W - 2, y + 4.5);
}
if (grandActual > 0) {
  setTxt(8.5, 'bold', C_TEAL);
  rightText(fmtHM(grandActual), totXf + TOT_W - 2, y + grandPlanned > 0 ? 9 : 5.5);
  if (grandPlanned > 0) {
    const dc: [number,number,number] = grandDelta >= 0 ? C_GREEN : C_RED;
    setTxt(5.5, 'bold', dc);
    rightText(`${grandDelta >= 0 ? '+' : ''}${fmtHM(grandDelta)}`, totXf + TOT_W - 2, y + 12.5);
  }
} else if (grandPlanned > 0) {
  setTxt(8, 'bold', C_MID);
  rightText(fmtHM(grandPlanned), totXf + TOT_W - 2, y + 8);
}
y += H_SUM_ROW;

// ── NOTA VALIDAZIONE (approved_by / approved_at) ──────────────────
const approvedShifts = weekShifts.filter(s => s.approval_status==='approved' && s.approved_by);
if (approvedShifts.length > 0) {
  y += 3;
  if (y > PH - H_FOOT - 12) { doc.addPage(); y = 12; }
  doc.setFillColor(236,253,245);
  doc.roundedRect(MG, y, CW, 10, 1, 1, 'F');
  doc.setDrawColor(167,243,208); doc.setLineWidth(0.3);
  doc.roundedRect(MG, y, CW, 10, 1, 1, 'S');

  const uniqueBy = [...new Set(approvedShifts.map(s=>s.approved_by!))].join(', ');
  const latestAt = approvedShifts
    .filter(s=>s.approved_at)
    .sort((a,b)=>(b.approved_at??'').localeCompare(a.approved_at??''))[0]?.approved_at;

  setTxt(7, 'bold', [6,95,70]);
  const prefix = formatTrans(t.ts_pdf_validated_by, { names: uniqueBy });
  doc.text(prefix, MG + 3, y + 6.5);
  if (latestAt) {
    setTxt(7, 'normal', [22,120,90]);
    const suffix = formatTrans(t.ts_pdf_validated_on, {
      datetime: format(new Date(latestAt), 'dd/MM/yyyy HH:mm'),
    });
    doc.text(suffix, MG + 3 + doc.getTextWidth(prefix), y + 6.5);
  }
  setTxt(6.5, 'normal', [100,150,130]);
  rightText(
    formatTrans(t.ts_pdf_approved_ratio, { approved: approvedShifts.length, total: weekShifts.length }),
    MG + CW - 2,
    y + 6.5
  );
  y += 10;
}

// ── FOOTER (tutte le pagine) ───────────────────────────────────────
const totalPages = doc.getNumberOfPages();
for (let pg = 1; pg <= totalPages; pg++) {
  doc.setPage(pg);
  doc.setDrawColor(...C_GRID); doc.setLineWidth(0.3);
  doc.line(MG, PH - H_FOOT - 1, PW - MG, PH - H_FOOT - 1);
  setTxt(6.5, 'normal', C_LIGHT);
  doc.text(t.ts_pdf_footer_brand, MG, PH - 4);
  const pgStr = formatTrans(t.ts_pdf_footer_page, {
    datetime: format(new Date(), 'd MMMM yyyy HH:mm', { locale }),
    page: pg,
    total: totalPages,
  });
  rightText(pgStr, PW - MG, PH - 4);
}

const rangeStartStr = format(weekStart, 'yyyy-MM-dd');
const rangeEndStr = format(lastDay, 'yyyy-MM-dd');
const fileBase =
  rangeStartStr === rangeEndStr
    ? `Osteria-Basilico_Presenze_${rangeStartStr}`
    : `Osteria-Basilico_Presenze_${rangeStartStr}_${rangeEndStr}`;
doc.save(`${fileBase}.pdf`);
}
