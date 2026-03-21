/**
 * `geofence.json` nel bucket Storage `app-config` — policy e setup: `docs/SUPABASE_STORAGE_APP_CONFIG.md`.
 */
import { supabase } from '../lib/supabase';
import type { GeofenceConfig } from './geofencePunch';

const BUCKET = 'app-config';
const FILE_PATH = 'geofence.json';
const STORAGE_KEY = 'osteria_geofence_config_v1';

export function parseGeofenceFile(raw: unknown): GeofenceConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const lat = Number(o.lat);
  const lng = Number(o.lng);
  const radiusRaw = o.radiusM !== undefined ? Number(o.radiusM) : 120;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const radiusM = Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : 120;
  return { lat, lng, radiusM };
}

export function getLocalGeofenceConfig(): GeofenceConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseGeofenceFile(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeLocalGeofenceConfig(data: GeofenceConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** Remoto + locale: il remoto vince quando presente. */
export function mergeGeofenceDiskLayers(
  remote: GeofenceConfig | null,
  local: GeofenceConfig | null
): GeofenceConfig | null {
  return remote ?? local;
}

export async function loadGeofenceConfigFromSupabase(): Promise<GeofenceConfig | null> {
  if (!supabase) return null;
  if (import.meta.env.VITE_FEATURE_FLAGS_STORAGE_ENABLED === 'false') return null;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(FILE_PATH);
    if (error || !data) return null;
    const text = await data.text();
    if (!text) return null;
    return parseGeofenceFile(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

export async function saveGeofenceConfigToSupabase(data: GeofenceConfig): Promise<void> {
  if (!supabase) throw new Error('Supabase non configurato');
  const blob = new Blob([JSON.stringify(data, null, 0)], { type: 'application/json' });
  const { error } = await supabase.storage.from(BUCKET).upload(FILE_PATH, blob, {
    upsert: true,
    contentType: 'application/json',
    cacheControl: '3600',
  });
  if (error) {
    throw new Error(error.message || 'Upload geofence.json fallito (bucket app-config / policy).');
  }
}
