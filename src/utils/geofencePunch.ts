/**
 * Geofence per timbrature: coordinate da `geofence.json` (Storage) / cache locale, con fallback `.env`.
 * Abilitazione runtime: feature flag `geofence_punch` (vedi `featureFlags.ts`).
 */

export type GeofenceConfig = {
  lat: number;
  lng: number;
  /** Raggio accettato in metri dal centro */
  radiusM: number;
};

/** Legge config da .env / Vercel. Ritorna null se lat/lng non sono numeri validi. */
export function readGeofenceEnvConfig(): GeofenceConfig | null {
  const lat = Number.parseFloat(String(import.meta.env.VITE_RESTAURANT_LAT ?? ''));
  const lng = Number.parseFloat(String(import.meta.env.VITE_RESTAURANT_LNG ?? ''));
  const radiusRaw = Number.parseFloat(String(import.meta.env.VITE_GEOFENCE_RADIUS_M ?? '120'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const radiusM = Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : 120;
  return { lat, lng, radiusM };
}

/** Priorità: config persistita (Storage) se valida; altrimenti variabili `VITE_*`. */
export function resolveEffectiveGeofenceConfig(
  fromDisk: GeofenceConfig | null,
  fromEnv: GeofenceConfig | null
): GeofenceConfig | null {
  if (fromDisk && Number.isFinite(fromDisk.lat) && Number.isFinite(fromDisk.lng)) {
    const radiusM =
      Number.isFinite(fromDisk.radiusM) && fromDisk.radiusM > 0 ? fromDisk.radiusM : 120;
    return { lat: fromDisk.lat, lng: fromDisk.lng, radiusM };
  }
  return fromEnv;
}

/** Distanza sulla sfera (metri) tra due punto WGS84. */
export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type GeolocationCoords = { lat: number; lng: number };

export function getCurrentPositionCoords(): Promise<GeolocationCoords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(Object.assign(new Error('NO_GEO_API'), { code: 2 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err: GeolocationPositionError) => reject(err),
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
    );
  });
}
