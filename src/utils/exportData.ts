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

