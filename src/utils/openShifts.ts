import { supabase } from '../lib/supabase';

/**
 * Open Shifts — Turni aperti self-service.
 *
 * Un "open shift" è uno shift senza `user_id` assegnato (o con `user_id = null`).
 * I dipendenti possono vedere i turni aperti e candidarsi (claim).
 */

export interface OpenShift {
  id: string;
  tenant_id: string;
  date: string;
  start_time: string;
  end_time: string;
  type?: string;
  department?: string;
  skills?: string;
  notes?: string;
  claimed_by?: string | null;
  claimed_at?: string | null;
}

export interface OpenShiftClaim {
  shift_id: string;
  user_id: string;
  claimed_at: string;
}

export async function getOpenShifts(tenantId: string): Promise<OpenShift[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('shifts')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('user_id', null)
    .gte('date', new Date().toISOString().slice(0, 10))
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });
  return (data ?? []) as OpenShift[];
}

export async function claimOpenShift(shiftId: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'DB non disponibile' };
  try {
    const { data: shift } = await supabase
      .from('shifts')
      .select('id, user_id')
      .eq('id', shiftId)
      .single();
    if (!shift) return { ok: false, error: 'Turno non trovato' };
    if (shift.user_id) return { ok: false, error: 'Turno già assegnato' };
    const { error } = await supabase
      .from('shifts')
      .update({
        user_id: userId,
        approval_status: 'draft',
      } as any)
      .eq('id', shiftId)
      .is('user_id', null);
    if (error) return { ok: false, error: error.message ?? 'Errore' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Errore' };
  }
}

export async function releaseOpenShift(shiftId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('shifts')
    .update({ user_id: null as any, approval_status: 'draft' as any })
    .eq('id', shiftId);
  return !error;
}
