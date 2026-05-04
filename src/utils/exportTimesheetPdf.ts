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
  sort_order?: number;
};

export type TimesheetPdfShiftRow = {
  plannedStart: string;
  plannedEnd: string;
  plannedMins: number;
  breakMinutes: number;
  /** Detrazione pausa sulle ore effettive (timbratura); se assente, i totali PAUSA usano breakMinutes. */
  breakMinutesActual?: number;
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
  // approved_by/approved_at removed
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

export async function exportTimesheetPdfToFile(params: ExportTimesheetPdfParams): Promise<void> {
  const { jsPDF } = await import('jspdf');

  const {
    weekDays,
    visibleUsers,
    timesheetData,
  } = params;

  const pdfUsers = visibleUsers
    .filter((u) => {
      if (isPurelyManagementRole(u.role || '')) {
        const hasShifts = Object.values(timesheetData[u.id] || {}).some(d => d.shifts.length > 0);
        return hasShifts;
      }
      return true;
    })
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ── Costanti layout ────────────────────────────────────────────────
  const PW = 297, PH = 210, MG = 10, CW = PW - MG * 2; // Full width
  const NAME_W = 45, TOT_W = 20; 
  const DAY_W = (CW - NAME_W - TOT_W) / 7;
  const H_HDR = 10, H_ROW = 15, H_FOOT = 8;

  // Palette brand e funzionale
  const C_TEAL   : [number,number,number] = [45, 90, 39]; 
  /** Griglia tabella: linee visibili (stampa/PDF) */
  const C_TABLE_LINE : [number,number,number] = [200, 200, 200];
  const C_TABLE_LINE_H : [number,number,number] = [150, 150, 150];
  const C_HDR_DARK: [number,number,number] = [13, 31, 60];
  const C_HDR_BG : [number,number,number] = [241, 245, 249];
  const C_DARK   : [number,number,number] = [15, 23, 42];
  const C_MID    : [number,number,number] = [71, 85, 105];
  const C_LIGHT  : [number,number,number] = [148, 163, 184];
  const C_HDR_TXT: [number,number,number] = [255, 255, 255];
  const C_ROW_ALT: [number,number,number] = [245, 247, 250];
  
  const BG_CONFIRMED: [number,number,number] = [240, 253, 244]; 
  const BD_CONFIRMED: [number,number,number] = [45, 90, 39];    
  const _BG_PENDING  : [number,number,number] = [255, 251, 235]; 
  const _BD_PENDING  : [number,number,number] = [245, 158, 11];  

  const strokeTableInner = () => {
    doc.setDrawColor(...C_TABLE_LINE);
    doc.setLineWidth(0.4);
  };
  const strokeTableOuter = () => {
    doc.setDrawColor(...C_TABLE_LINE_H);
    doc.setLineWidth(0.5);
  };
  const setTxt = (sz: number, style: 'normal'|'bold', rgb: [number,number,number]) => {
    doc.setFontSize(sz); doc.setFont('helvetica', style); doc.setTextColor(...rgb);
  };
  const rightText = (text: string, rightEdge: number, y: number) => {
    doc.text(text, rightEdge - doc.getTextWidth(text), y);
  };
  const centerText = (text: string, xStart: number, width: number, y: number) => {
    doc.text(text, xStart + width / 2 - doc.getTextWidth(text) / 2, y);
  };

  const fmtDecimal = (mins: number) => (mins / 60).toFixed(1).replace('.0', '');

  // ── SUDDIVISIONE IN SETTIMANE ──────────────────────────────────────
  const sortedDays = [...weekDays].sort((a, b) => a.getTime() - b.getTime());
  const weeks: Date[][] = [];
  if (sortedDays.length > 0) {
    let currentWeek: Date[] = [];
    sortedDays.forEach((day, idx) => {
      currentWeek.push(day);
      // Se è domenica o l'ultimo giorno del periodo, chiudi la settimana
      if (day.getDay() === 0 || idx === sortedDays.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
  }

  const DAYS_EN = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  weeks.forEach((week, weekIdx) => {
    if (weekIdx > 0) doc.addPage();

    const weekStart = week[0];
    const weekEnd = week[week.length - 1];
    
    // Header Pagina
    setTxt(14, 'bold', C_TEAL);
    doc.text("OSTERIA BASILICO", MG, 12);
    
    const wkLabel = `Week: ${format(weekStart, 'd MMM').toUpperCase()} - ${format(weekEnd, 'd MMM yyyy').toUpperCase()}`;
    setTxt(10, 'bold', C_MID);
    rightText(wkLabel, PW - MG, 12);
    
    let y = 18;

    // Intestazioni Colonne (sfondo scuro, testo bianco, griglia visibile)
    doc.setFillColor(...C_HDR_DARK);
    doc.rect(MG, y, CW, H_HDR, 'F');
    setTxt(7, 'bold', C_HDR_TXT);
    doc.text("EMPLOYEE", MG + 2, y + 6.5);
    for (let i = 0; i < 7; i++) {
      const x = MG + NAME_W + i * DAY_W;
      setTxt(7, 'bold', C_HDR_TXT);
      centerText(DAYS_EN[i], x, DAY_W, y + 6.5);
    }
    const totXhdr = MG + NAME_W + 7 * DAY_W;
    setTxt(7, 'bold', C_HDR_TXT);
    centerText("TOTAL", totXhdr, TOT_W, y + 6.5);
    strokeTableOuter();
    doc.rect(MG, y, CW, H_HDR, 'S');
    strokeTableInner();
    for (let i = 0; i < 7; i++) {
      doc.line(MG + NAME_W + i * DAY_W, y, MG + NAME_W + i * DAY_W, y + H_HDR);
    }
    doc.line(totXhdr, y, totXhdr, y + H_HDR);
    doc.line(MG + CW, y, MG + CW, y + H_HDR);
    y += H_HDR;

    // Righe Dipendenti
    let bodyRow = 0;
    pdfUsers.forEach((user) => {
      if (y > PH - H_FOOT - H_ROW - 10) {
        doc.addPage();
        y = 10;
        // Ripeti Header Tabella su nuova pagina
        doc.setFillColor(...C_HDR_DARK);
        doc.rect(MG, y, CW, H_HDR, 'F');
        setTxt(7, 'bold', C_HDR_TXT);
        doc.text("EMPLOYEE", MG + 2, y + 6.5);
        for (let i = 0; i < 7; i++) {
          const x = MG + NAME_W + i * DAY_W;
          setTxt(7, 'bold', C_HDR_TXT);
          centerText(DAYS_EN[i], x, DAY_W, y + 6.5);
        }
        const pX = MG + NAME_W + 7 * DAY_W;
        setTxt(7, 'bold', C_HDR_TXT);
        centerText("TOTAL", pX, TOT_W, y + 6.5);
        strokeTableOuter();
        doc.rect(MG, y, CW, H_HDR, 'S');
        strokeTableInner();
        for (let i = 0; i < 7; i++) {
          doc.line(MG + NAME_W + i * DAY_W, y, MG + NAME_W + i * DAY_W, y + H_HDR);
        }
        doc.line(pX, y, pX, y + H_HDR);
        doc.line(MG + CW, y, MG + CW, y + H_HDR);
        y += H_HDR;
      }

      doc.setFillColor(...(bodyRow % 2 === 0 ? [255, 255, 255] as [number, number, number] : C_ROW_ALT));
      doc.rect(MG, y, CW, H_ROW, 'F');

      // Nome e Cognome (MAIUSCOLO, senza ruoli o icone)
      const firstName = (user.first_name || '').toUpperCase();
      const lastName = (user.last_name || '').toUpperCase();
      const fullName = `${firstName}${lastName ? ' ' + lastName : ''}`;
      let fontSize = 8;
      setTxt(fontSize, 'bold', C_DARK);
      while (doc.getTextWidth(fullName) > NAME_W - 4 && fontSize > 5) {
        fontSize -= 0.5;
        setTxt(fontSize, 'bold', C_DARK);
      }
      doc.text(fullName, MG + 2.5, y + H_ROW / 2 + 1.5);

      let userWeekMins = 0;

      // Celle Giornaliere (sempre 7, senza dropdown o icone)
      for (let i = 0; i < 7; i++) {
        const x = MG + NAME_W + i * DAY_W;
        const dayInWeek = week.find(d => (d.getDay() + 6) % 7 === i);
        
        if (dayInWeek) {
          const dateStr = format(dayInWeek, 'yyyy-MM-dd');
          const dayData = timesheetData[user.id]?.[dateStr];
          if (dayData && dayData.shifts.length > 0) {
            const shiftsToShow = dayData.shifts
              .filter(s => s.status === 'confirmed' || s.status === 'approved')
              .slice(0, 2);

            if (shiftsToShow.length > 0) {
              userWeekMins += dayData.totalActualMins > 0 ? dayData.totalActualMins : dayData.totalPlannedMins;
              shiftsToShow.forEach((s, si) => {
                const shiftH = 5.5;
                const totalShiftsH = shiftsToShow.length * shiftH;
                const startY = y + (H_ROW - totalShiftsH) / 2;
                const oy = si * shiftH;
                
                // Sfondo verde chiaro per turni approvati/congelati
                doc.setFillColor(...BG_CONFIRMED);
                doc.rect(x + 0.5, startY + oy, DAY_W - 1, shiftH - 0.5, 'F');
                
                // Bordo sinistro FLOW blue
                doc.setFillColor(...BD_CONFIRMED);
                doc.rect(x + 0.5, startY + oy, 1.2, shiftH - 0.5, 'F');

                const timeStr = `${s.plannedStart} - ${s.plannedEnd}`;
                setTxt(6.5, 'bold', C_DARK);
                centerText(timeStr, x + 1, DAY_W - 1, startY + oy + 3.8);
              });
            } else {
              setTxt(8, 'normal', C_LIGHT);
              centerText('—', x, DAY_W, y + H_ROW/2 + 1.5);
            }
          } else {
            setTxt(8, 'normal', C_LIGHT);
            centerText('—', x, DAY_W, y + H_ROW/2 + 1.5);
          }
        } else {
          setTxt(8, 'normal', C_LIGHT);
          centerText('—', x, DAY_W, y + H_ROW/2 + 1.5);
        }
      }

      // Totale Settimanale Dipendente
      const totX2 = MG + NAME_W + 7 * DAY_W;
      if (userWeekMins > 0) {
        setTxt(9, 'bold', C_TEAL);
        rightText(fmtDecimal(userWeekMins), totX2 + TOT_W - 2, y + H_ROW / 2 + 1.5);
      }

      strokeTableOuter();
      doc.rect(MG, y, CW, H_ROW, 'S');
      strokeTableInner();
      for (let i = 0; i <= 7; i++) {
        const lx = MG + NAME_W + i * DAY_W;
        doc.line(lx, y, lx, y + H_ROW);
      }
      doc.line(totX2 + TOT_W, y, totX2 + TOT_W, y + H_ROW);
      y += H_ROW;
      bodyRow += 1;
    });

    // Riga Totali Settimana
    const H_SUM_ROW = 10;
    if (y > PH - H_FOOT - H_SUM_ROW) { doc.addPage(); y = 10; }
    doc.setFillColor(...C_HDR_BG);
    doc.rect(MG, y, CW, H_SUM_ROW, 'F');
    setTxt(7, 'bold', C_MID);
    doc.text("WEEK TOTALS", MG + 2, y + 6.5);
    strokeTableOuter();
    doc.rect(MG, y, CW, H_SUM_ROW, 'S');
    strokeTableInner();

    let weekGrandTotal = 0;
    for (let i = 0; i < 7; i++) {
      const x = MG + NAME_W + i * DAY_W;
      const dayInWeek = week.find(d => (d.getDay() + 6) % 7 === i);
      doc.line(x, y, x, y + H_SUM_ROW);
      if (dayInWeek) {
        const ds = format(dayInWeek, 'yyyy-MM-dd');
        const dayTotal = pdfUsers.reduce((s, u) => {
          const d = timesheetData[u.id]?.[ds];
          return s + (d ? (d.totalActualMins > 0 ? d.totalActualMins : d.totalPlannedMins) : 0);
        }, 0);
        if (dayTotal > 0) {
          weekGrandTotal += dayTotal;
          setTxt(7, 'bold', C_DARK);
          centerText(fmtDecimal(dayTotal), x, DAY_W, y + 6.5);
        }
      }
    }
    const totXf = MG + NAME_W + 7 * DAY_W;
    doc.line(totXf, y, totXf, y + H_SUM_ROW);
    doc.line(MG + CW, y, MG + CW, y + H_SUM_ROW);
    if (weekGrandTotal > 0) {
      setTxt(9, 'bold', C_TEAL);
      rightText(fmtDecimal(weekGrandTotal), totXf + TOT_W - 2, y + 6.5);
    }
    y += H_SUM_ROW;
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg);
    doc.setDrawColor(...C_TABLE_LINE); doc.setLineWidth(0.35);
    doc.line(MG, PH - H_FOOT - 1, PW - MG, PH - H_FOOT - 1);
    setTxt(6.5, 'normal', C_LIGHT);
    doc.text("FLOW - Attendance System", MG, PH - 4);
    const pgStr = `Generated on ${format(new Date(), 'd MMMM yyyy HH:mm')} - Page ${pg} of ${totalPages}`;
    rightText(pgStr, PW - MG, PH - 4);
  }

  const rangeStartStr = format(sortedDays[0], 'yyyy-MM-dd');
  const rangeEndStr = format(sortedDays[sortedDays.length - 1], 'yyyy-MM-dd');
  doc.save(`FLOW_Presenze_${rangeStartStr}_${rangeEndStr}.pdf`);
}

