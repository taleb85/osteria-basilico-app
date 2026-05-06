import { useState, useCallback } from 'react';
import type { PunchRecord, PunchRecordSource } from '../types';
import { database } from '../lib/database';

export interface UsePunchRecordsReturn {
  punchRecords: PunchRecord[];
  setPunchRecords: (records: PunchRecord[]) => void;
  loadPunchRecords: (userId?: string) => Promise<void>;
  addPunchRecord: (
    userId: string,
    type: 'in' | 'out',
    options?: {
      timestamp?: string;
      shift_id?: string;
      source?: PunchRecordSource;
    }
  ) => Promise<PunchRecord | null>;
  updatePunchRecord: (id: string, updates: { timestamp?: string; calculated_time?: string; clock_out_time?: string | null }) => Promise<void>;
  deletePunchRecordsForShift: (shiftId: string) => Promise<void>;
}

export function usePunchRecords(): UsePunchRecordsReturn {
  const [punchRecords, setPunchRecords] = useState<PunchRecord[]>([]);

  const loadPunchRecords = useCallback(async (userId?: string) => {
    try {
      const data = userId
        ? await database.punchRecords.getByUserId(userId)
        : await database.punchRecords.getAll();
      setPunchRecords(data);
    } catch (e) {
      console.error('[usePunchRecords] load error:', e);
    }
  }, []);

  const addPunchRecord = useCallback(
    async (
      userId: string,
      type: 'in' | 'out',
      options?: { timestamp?: string; shift_id?: string; source?: PunchRecordSource }
    ): Promise<PunchRecord | null> => {
      try {
        const source = options?.source ?? 'kiosk';
        const record = await database.punchRecords.insert({
          user_id: userId,
          type,
          timestamp: options?.timestamp ?? new Date().toISOString(),
          shift_id: options?.shift_id,
          source,
        });
        if (record) {
          setPunchRecords((prev) => [record, ...prev]);
        }
        return record;
      } catch (e) {
        console.error('[usePunchRecords] add error:', e);
        return null;
      }
    },
    []
  );

  const updatePunchRecord = useCallback(
    async (id: string, updates: { timestamp?: string; calculated_time?: string; clock_out_time?: string | null }) => {
      try {
        const updated = await database.punchRecords.update(id, updates);
        if (updated) {
          setPunchRecords((prev) =>
            prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
          );
        }
      } catch (e) {
        console.error('[usePunchRecords] update error:', e);
      }
    },
    []
  );

  const deletePunchRecordsForShift = useCallback(async (shiftId: string) => {
    try {
      await database.punchRecords.deleteByShiftId(shiftId);
      setPunchRecords((prev) => prev.filter((r) => r.shift_id !== shiftId));
    } catch (e) {
      console.error('[usePunchRecords] deleteForShift error:', e);
    }
  }, []);

  return {
    punchRecords,
    setPunchRecords,
    loadPunchRecords,
    addPunchRecord,
    updatePunchRecord,
    deletePunchRecordsForShift,
  };
}
