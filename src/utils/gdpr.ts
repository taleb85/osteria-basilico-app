import { supabase } from '../lib/supabase';
import type { User, Shift, PunchRecord, HolidayRequest } from '../types';

export interface GDPRExportData {
  exportedAt: string;
  user: Partial<User> | null;
  shifts: Shift[];
  punchRecords: PunchRecord[];
  holidayRequests: HolidayRequest[];
  departments?: string[];
  settings?: Record<string, unknown>;
}

export async function exportUserData(userId: string): Promise<GDPRExportData> {
  const { data: user } = await supabase!.from('users').select('*').eq('id', userId).single();
  const { data: shifts } = await supabase!.from('shifts').select('*').eq('user_id', userId);
  const { data: punchRecords } = await supabase!.from('punch_records').select('*').eq('user_id', userId);
  const { data: holidayRequests } = await supabase!.from('holiday_requests').select('*').eq('user_id', userId);

  return {
    exportedAt: new Date().toISOString(),
    user: user ?? null,
    shifts: shifts ?? [],
    punchRecords: punchRecords ?? [],
    holidayRequests: holidayRequests ?? [],
  };
}

export function downloadGDPRJson(data: GDPRExportData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `FLOW_data_export_${data.user?.id ?? 'unknown'}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function anonymizeUser(userId: string): Promise<boolean> {
  const { error } = await supabase!.from('users').update({
    first_name: 'UTENTE',
    last_name: 'CANCELLATO',
    email: `deleted-${userId.slice(0, 8)}@anonymized.flow.app`,
    phone: null,
    pin: null as any,
    secondary_pin: null,
    avatar_url: null,
    status: 'inactive',
  } as any).eq('id', userId);
  return !error;
}

export async function deleteUserData(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await supabase!.from('holiday_requests').delete().eq('user_id', userId);
    await supabase!.from('punch_records').delete().eq('user_id', userId);
    await supabase!.from('shifts').delete().eq('user_id', userId);
    const ok = await anonymizeUser(userId);
    return { ok };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Errore durante l\'eliminazione' };
  }
}

export function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isPhoneValid(phone: string): boolean {
  return /^[\d\s+\-()]{6,20}$/.test(phone);
}
