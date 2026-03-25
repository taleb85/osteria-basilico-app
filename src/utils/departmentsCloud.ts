/**
 * `departments.json` nel bucket Storage `app-config` — reparti (colori, etichette, custom) condivisi tra dispositivi.
 */
import { supabase } from '../lib/supabase';
import type { DepartmentsCloudV1 } from './departments';
import { parseDepartmentsCloudPayload } from './departments';

const BUCKET = 'app-config';
const FILE_PATH = 'departments.json';

function storageEnabled(): boolean {
  return import.meta.env.VITE_APP_CONFIG_STORAGE_ENABLED !== 'false';
}

export async function loadDepartmentsFromSupabase(): Promise<DepartmentsCloudV1 | null> {
  if (!storageEnabled() || !supabase) return null;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(FILE_PATH);
    if (error || !data) return null;
    const text = await data.text();
    if (!text) return null;
    const parsed = JSON.parse(text) as unknown;
    return parseDepartmentsCloudPayload(parsed);
  } catch {
    return null;
  }
}

export async function saveDepartmentsToSupabase(snapshot: DepartmentsCloudV1): Promise<void> {
  if (!storageEnabled()) return;
  if (!supabase) throw new Error('Supabase non configurato');
  const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
  const { error } = await supabase.storage.from(BUCKET).upload(FILE_PATH, blob, {
    upsert: true,
    contentType: 'application/json',
    /** Breve max-age: evita che un GET subito dopo l’upload serva un JSON vecchio dalla cache edge. */
    cacheControl: '60',
  });
  if (error) {
    throw new Error(
      error.message ||
        'Upload departments.json fallito (bucket app-config o policy mancanti: vedi docs/SUPABASE_STORAGE_APP_CONFIG.md).'
    );
  }
}
