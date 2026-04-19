import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { format, isValid } from 'date-fns';
import type { User, Shift, PunchRecord } from '../types';
import { useApp } from '../context/AppContext';
import { isUserInRestaurantRange, getCurrentPositionCoords } from '../utils/geo';
import { readGeofenceEnvConfig } from '../utils/geofencePunch';
import { lightHaptic, punchInSound, punchOutSound } from '../utils/hapticFeedbackCore';
import { getTranslations } from '../utils/translations';
import type { Language } from '../types';

export type SmartPunchMode = 'start' | 'end' | null;
export type GeoState = 'idle' | 'checking' | 'ok' | 'outside' | 'denied';

export interface EnrichedShift {
  shift: Shift;
  isLunchSlot: boolean;
  punchIn: PunchRecord | undefined;
  punchOut: PunchRecord | undefined;
  actualStart: string | null;
  actualEnd: string | null;
}

export interface SmartPunchResult {
  mode: SmartPunchMode;
  label: string;
  execute: () => Promise<void>;
  checkGeofence: () => Promise<boolean>;
  isLoading: boolean;
  geoState: GeoState;
  shiftForStart: Shift | null;
  inProgress: EnrichedShift | null;
  enriched: EnrichedShift[];
}

function timeToMins(t: string): number {
  const [h, m] = (t || '00:00').slice(0, 5).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function punchTimeHHMM(ts: string | null | undefined): string | null {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (!isValid(d)) return null;
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

function getPunchPair(
  shiftId: string,
  userId: string,
  dateStr: string,
  isLunchSlot: boolean,
  punchRecords: PunchRecord[],
): { punchIn: PunchRecord | undefined; punchOut: PunchRecord | undefined } {
  const punchIn = punchRecords.find((p) => {
    if (p.type !== 'in') return false;
    if (shiftId && p.shift_id) return p.shift_id === shiftId;
    if (p.user_id !== userId) return false;
    const d = new Date(p.timestamp);
    if (!isValid(d)) return false;
    return format(d, 'yyyy-MM-dd') === dateStr && (isLunchSlot ? d.getHours() < 16 : d.getHours() >= 16);
  });
  const punchOut = punchRecords.find((p) => {
    if (p.type !== 'out') return false;
    if (shiftId && p.shift_id) return p.shift_id === shiftId;
    if (p.user_id !== userId) return false;
    const d = new Date(p.timestamp);
    if (!isValid(d)) return false;
    return format(d, 'yyyy-MM-dd') === dateStr && (isLunchSlot ? d.getHours() < 16 : d.getHours() >= 16);
  });
  return { punchIn, punchOut };
}

function actualEndFromPunches(
  punchIn: PunchRecord | undefined,
  punchOut: PunchRecord | undefined,
): string | null {
  if (!punchIn) return null;
  const clockOutRaw = (punchIn as { clock_out_time?: string | null }).clock_out_time ?? null;
  if (clockOutRaw) return punchTimeHHMM(clockOutRaw);
  if (punchOut?.timestamp) return punchTimeHHMM(punchOut.timestamp);
  return null;
}

export interface UseSmartPunchActionParams {
  user: User;
  language: Language;
  todayStr: string;
  now: Date;
  todayShifts: Shift[];
  punchRecords: PunchRecord[];
  onPresenceProof: (userId: string) => Promise<string | null>;
}

export function useSmartPunchAction({
  user,
  language,
  todayStr,
  now,
  todayShifts,
  punchRecords,
  onPresenceProof,
}: UseSmartPunchActionParams): SmartPunchResult {
  const t = getTranslations(language);
  const { addPunchRecord, showError, showSuccess, featureFlags, geofenceEffectiveConfig } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [geoState, setGeoState] = useState<GeoState>('idle');
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const enriched = useMemo<EnrichedShift[]>(() => {
    return todayShifts
      .filter((s) => s.approval_status === 'confirmed' || s.approval_status === 'approved')
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((s) => {
        const isLunchSlot = s.type === 'lunch' || timeToMins(s.start_time) < 16 * 60;
        const { punchIn, punchOut } = getPunchPair(s.id, user.id, todayStr, isLunchSlot, punchRecords);
        const actualStart = punchIn
          ? punchTimeHHMM(punchIn.calculated_time || punchIn.timestamp)
          : null;
        const actualEnd = actualEndFromPunches(punchIn, punchOut);
        return { shift: s, isLunchSlot, punchIn, punchOut, actualStart, actualEnd };
      });
  }, [todayShifts, punchRecords, user.id, todayStr]);

  const inProgress = useMemo<EnrichedShift | null>(
    () => enriched.find((e) => e.punchIn && !e.actualEnd) ?? null,
    [enriched],
  );

  const shiftForStart = useMemo<Shift | null>(() => {
    if (inProgress) return null;
    const nowM = now.getHours() * 60 + now.getMinutes();
    for (const e of enriched) {
      if (e.punchIn) continue;
      const startM = timeToMins(e.shift.start_time);
      if (
        Math.abs(nowM - startM) <= 120 ||
        (nowM >= startM - 60 && nowM <= timeToMins((e.shift.end_time || '23:59').slice(0, 5)) + 60)
      ) {
        return e.shift;
      }
    }
    for (const e of enriched) {
      if (!e.punchIn) return e.shift;
    }
    return null;
  }, [enriched, inProgress, now]);

  const mode: SmartPunchMode = inProgress && !inProgress.actualEnd ? 'end' : shiftForStart ? 'start' : null;
  const label =
    mode === 'start'
      ? (t as Record<string, string>)['mobile_dash_start'] ?? 'Inizia turno'
      : mode === 'end'
        ? (t as Record<string, string>)['mobile_dash_end'] ?? 'Fine turno'
        : (t as Record<string, string>)['no_shifts_scheduled'] ?? 'Nessun turno';

  const checkGeofence = useCallback(async (): Promise<boolean> => {
    if (featureFlags['geofence_punch'] === false) return true;
    const config = geofenceEffectiveConfig || readGeofenceEnvConfig();
    if (!config) return true;
    if (mountedRef.current) setGeoState('checking');
    try {
      const pos = await getCurrentPositionCoords();
      if (!mountedRef.current) return false;
      const { inRange } = isUserInRestaurantRange(pos.lat, pos.lng, config);
      if (!inRange) {
        setGeoState('outside');
        showError?.(t.punch_error_geofence || 'Sei troppo lontano dal ristorante.');
        return false;
      }
      setGeoState('ok');
      return true;
    } catch {
      if (!mountedRef.current) return false;
      setGeoState('denied');
      showError?.(t.punch_error_geo_denied || 'Impossibile verificare la posizione.');
      return false;
    }
  }, [featureFlags, geofenceEffectiveConfig, showError, t]);

  const execute = useCallback(async () => {
    if (!mode || isLoading) return;
    if (featureFlags['maintenance_mode'] === true && user.role !== 'admin') {
      showError?.(t.maintenance_mode_active || 'Sistema in manutenzione.');
      return;
    }
    if (!(await checkGeofence())) return;
    lightHaptic();
    setIsLoading(true);
    const punchType = mode;
    try {
      let presenceProof: string | undefined;
      try {
        presenceProof = (await onPresenceProof(user.id)) || undefined;
      } catch (e) {
        if (e instanceof Error && e.message === 'presence_cancelled') {
          showError?.(t.punch_presence_cancelled);
          return;
        }
        throw e;
      }
      const targetShift = mode === 'start' ? shiftForStart : inProgress?.shift ?? null;
      if (!targetShift) return;
      const res = await addPunchRecord(user.id, mode === 'start' ? 'in' : 'out', {
        shift_id: targetShift.id,
        presenceProof,
      });
      if (res && typeof res === 'object' && 'error' in res && res.error) {
        showError?.(res.error as string);
        return;
      }
      if (!mountedRef.current) return;
      if (punchType === 'start') punchInSound(); else punchOutSound();
      showSuccess?.(punchType === 'start' ? t.home_punched : t.home_toast_exit_registered);
      setGeoState('idle');
    } catch {
      if (mountedRef.current) showError?.(t.punch_save_error);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [
    mode,
    isLoading,
    featureFlags,
    user.id,
    user.role,
    shiftForStart,
    inProgress,
    addPunchRecord,
    onPresenceProof,
    showError,
    showSuccess,
    t,
    checkGeofence,
  ]);

  return { mode, label, execute, checkGeofence, isLoading, geoState, shiftForStart, inProgress, enriched };
}
