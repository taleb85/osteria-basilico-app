import { database } from '../lib/database';
import { User, Shift, HolidayRequest, PunchRecord } from '../types';

export interface ImportData {
  users: User[];
  shifts?: Shift[];
  holidays?: HolidayRequest[];
  punchRecords?: PunchRecord[];
}

export async function importDataToSupabase(data: ImportData): Promise<void> {
  try {
    if (data.users && data.users.length > 0) {
      for (const user of data.users) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- id excluded for insert
        const { id, ...userData } = user;
        await database.users.insert(userData);
      }
    }

    if (data.shifts && data.shifts.length > 0) {
      for (const shift of data.shifts) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- id excluded for insert
        const { id, ...shiftData } = shift;
        await database.shifts.insert(shiftData);
      }
    }

    if (data.holidays && data.holidays.length > 0) {
      for (const holiday of data.holidays) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- id, created_at excluded for insert
        const { id, created_at, ...holidayData } = holiday;
        await database.holidays.insert({
          ...holidayData,
          status: holiday.status || 'pending'
        });
      }
    }

    if (data.punchRecords && data.punchRecords.length > 0) {
      for (const record of data.punchRecords) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- id excluded for insert
        const { id, ...recordData } = record;
        const po = { ...recordData } as Omit<PunchRecord, 'id'>;
        const hasTs = Boolean(po.timestamp && String(po.timestamp).trim());
        const srcOk =
          po.source === 'manual' || po.source === 'kiosk' || po.source === 'manager';
        await database.punchRecords.insert({
          ...po,
          source: srcOk ? po.source! : hasTs ? 'manual' : 'kiosk',
        });
      }
    }
  } catch (error) {
    console.error('Error importing data to Supabase:', error);
    throw new Error('Errore durante il salvataggio dei dati nel database');
  }
}

export async function clearAllData(): Promise<void> {
  try {
    const users = await database.users.getAll();
    const shifts = await database.shifts.getAll();
    const holidays = await database.holidays.getAll();

    for (const shift of shifts) {
      await database.shifts.delete(shift.id);
    }

    for (const holiday of holidays) {
      await database.holidays.update(holiday.id, { status: 'pending' });
    }

    for (const user of users) {
      if (user.role !== 'Admin') {
        await database.users.delete(user.id);
      }
    }
  } catch (error) {
    console.error('Error clearing data:', error);
    throw new Error('Errore durante la pulizia dei dati esistenti');
  }
}
