import { User, Shift, PunchRecord, HolidayRequest } from '../types';
import { format } from 'date-fns';

interface ExportData {
  users: User[];
  shifts: Shift[];
  punchRecords: PunchRecord[];
  holidays: HolidayRequest[];
}

export const exportToJSON = (data: ExportData) => {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `flow-backup-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToCSV = (data: ExportData) => {
  const userMap = new Map(data.users.map(u => [u.id, u.first_name]));

  let csv = 'TURNI E TIMBRATURE\n\n';
  csv += 'Data,Dipendente,Tipo Turno,Orario Previsto Inizio,Orario Previsto Fine,Orario Timbrato\n';

  const shiftsWithPunches = data.shifts.map(shift => {
    const punch = data.punchRecords.find(
      p => p.user_id === shift.user_id &&
           p.type === 'in' &&
           format(new Date(p.timestamp), 'yyyy-MM-dd') === shift.date
    );

    return {
      date: shift.date,
      userName: userMap.get(shift.user_id) || 'Sconosciuto',
      type: shift.type === 'lunch' ? 'Pranzo' : 'Cena',
      startTime: shift.start_time,
      endTime: shift.end_time || 'N/D',
      punchTime: punch ? format(new Date(punch.timestamp), 'HH:mm') : 'Non timbrato',
    };
  });

  shiftsWithPunches
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .forEach(row => {
      csv += `${row.date},${row.userName},${row.type},${row.startTime},${row.endTime},${row.punchTime}\n`;
    });

  csv += '\n\nRICHIESTE FERIE\n\n';
  csv += 'Dipendente,Data Inizio,Data Fine,Stato,Data Richiesta\n';

  data.holidays
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .forEach(holiday => {
      const userName = userMap.get(holiday.user_id) || 'Sconosciuto';
      const statusMap: Record<string, string> = {
        'pending': 'In Attesa',
        'approved': 'Approvata',
        'rejected': 'Rifiutata',
      };
      csv += `${userName},${holiday.start_date},${holiday.end_date},${statusMap[holiday.status]},${format(new Date(holiday.created_at), 'yyyy-MM-dd')}\n`;
    });

  csv += '\n\nDIPENDENTI\n\n';
  csv += 'Nome,Email,Ruolo,Stato,PIN\n';

  data.users.forEach(user => {
    csv += `${user.first_name},${user.email},${user.role},${user.status === 'active' ? 'Attivo' : 'Sospeso'},${user.pin}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `flow-report-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
