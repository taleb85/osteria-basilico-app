import { useState, useCallback } from 'react';
import type { HolidayRequest, HolidayStatus } from '../types';
import { database } from '../lib/database';

export interface UseHolidaysReturn {
  holidays: HolidayRequest[];
  availability: HolidayRequest[];
  setHolidays: (holidays: HolidayRequest[]) => void;
  setAvailability: (availability: HolidayRequest[]) => void;
  loadHolidays: () => Promise<void>;
  loadAvailability: () => Promise<void>;
  addHolidayRequest: (request: Omit<HolidayRequest, 'id' | 'created_at' | 'status'>) => Promise<{ ok: boolean; emailSent?: boolean; error?: string }>;
  updateHolidayStatus: (id: string, status: HolidayStatus) => Promise<{ ok: boolean; emailSent?: boolean; error?: string }>;
  deleteHolidayRequest: (id: string) => Promise<boolean>;
  toggleAvailability: (userId: string, date: string) => Promise<void>;
}

export function useHolidays(): UseHolidaysReturn {
  const [holidays, setHolidays] = useState<HolidayRequest[]>([]);
  const [availability, setAvailability] = useState<HolidayRequest[]>([]);

  const loadHolidays = useCallback(async () => {
    try {
      const data = await database.holidays.getAll();
      setHolidays(data);
    } catch (e) {
      console.error('[useHolidays] load error:', e);
    }
  }, []);

  const loadAvailability = useCallback(async () => {
    try {
      const data = await database.availability.getAll();
      setAvailability(data);
    } catch (e) {
      console.error('[useHolidays] loadAvailability error:', e);
    }
  }, []);

  const addHolidayRequest = useCallback(
    async (request: Omit<HolidayRequest, 'id' | 'created_at' | 'status'>): Promise<{ ok: boolean; emailSent?: boolean; error?: string }> => {
      try {
        const data = await database.holidays.insert({
          ...request,
          status: 'pending',
        });
        if (data) {
          setHolidays((prev) => [data, ...prev]);
        }
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Errore sconosciuto';
        console.error('[useHolidays] add error:', e);
        return { ok: false, error: msg };
      }
    },
    []
  );

  const updateHolidayStatus = useCallback(
    async (id: string, status: HolidayStatus): Promise<{ ok: boolean; emailSent?: boolean; error?: string }> => {
      try {
        const updated = await database.holidays.update(id, { status });
        if (updated) {
          setHolidays((prev) => prev.map((h) => (h.id === id ? { ...h, status } : h)));
        }
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Errore sconosciuto';
        console.error('[useHolidays] updateStatus error:', e);
        return { ok: false, error: msg };
      }
    },
    []
  );

  const deleteHolidayRequest = useCallback(async (id: string): Promise<boolean> => {
    try {
      await database.holidays.delete(id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      return true;
    } catch (e) {
      console.error('[useHolidays] delete error:', e);
      return false;
    }
  }, []);

  const toggleAvailability = useCallback(async (userId: string, date: string) => {
    try {
      const existing = availability.find((a) => a.user_id === userId && a.start_date === date);
      const result = await database.availability.toggle(userId, date, existing);
      if (result) {
        setAvailability((prev) => [...prev, result]);
      } else {
        setAvailability((prev) => prev.filter((a) => !(a.user_id === userId && a.start_date === date)));
      }
    } catch (e) {
      console.error('[useHolidays] toggleAvailability error:', e);
    }
  }, [availability]);

  return {
    holidays,
    availability,
    setHolidays,
    setAvailability,
    loadHolidays,
    loadAvailability,
    addHolidayRequest,
    updateHolidayStatus,
    deleteHolidayRequest,
    toggleAvailability,
  };
}
