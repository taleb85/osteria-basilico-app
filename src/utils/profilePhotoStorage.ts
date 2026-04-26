import { supabase } from '../lib/supabase';

const LS_PREFIX = 'ob_profile_avatar_';
const FOCUS_PREFIX = 'ob_profile_avatar_focus_';
const STORAGE_BUCKET = 'avatars';

/** Punto di inquadramento per `object-position` (percentuali 0–100). */
export type AvatarFocus = { x: number; y: number };

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function readAvatarFocus(userId: string): AvatarFocus {
  try {
    const raw = localStorage.getItem(FOCUS_PREFIX + userId);
    if (!raw) return { x: 50, y: 50 };
    const p = JSON.parse(raw) as Partial<AvatarFocus>;
    return { x: clampPct(Number(p.x)), y: clampPct(Number(p.y)) };
  } catch {
    return { x: 50, y: 50 };
  }
}

export function writeAvatarFocus(userId: string, focus: AvatarFocus): void {
  try {
    localStorage.setItem(
      FOCUS_PREFIX + userId,
      JSON.stringify({ x: clampPct(focus.x), y: clampPct(focus.y) })
    );
  } catch {
    /* ignore */
  }
}

export function avatarFocusToObjectPosition(focus: AvatarFocus): string {
  return `${clampPct(focus.x)}% ${clampPct(focus.y)}%`;
}

export function readProfileAvatarFromStorage(userId: string): string | null {
  try {
    return localStorage.getItem(LS_PREFIX + userId);
  } catch {
    return null;
  }
}

export function writeProfileAvatarToStorage(userId: string, dataUrl: string | null): void {
  try {
    const k = LS_PREFIX + userId;
    if (dataUrl) localStorage.setItem(k, dataUrl);
    else localStorage.removeItem(k);
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Converte una data URL JPEG in Blob.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/**
 * Carica la foto profilo su Supabase Storage (bucket `avatars`).
 * Restituisce l'URL pubblico permanente, o null in caso di errore.
 *
 * Il file viene salvato come `avatars/{userId}/avatar.jpg` con upsert
 * (sovrascrive sempre lo stesso percorso per evitare accumulo di file).
 */
export async function uploadAvatarToStorage(
  userId: string,
  dataUrl: string
): Promise<string | null> {
  // SECURITY: usa solo anon key + RLS. Assicurati che policies su storage.objects permettano upload/read.
  if (!supabase) return null;
  try {
    const blob = dataUrlToBlob(dataUrl);
    const client = supabase;
    const path = `${userId}/avatar.jpg`;

    const { error } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,        // sovrascrive se esiste già
        cacheControl: '3600',
      });

    if (error) {
      console.error('[avatar] Storage upload error:', error.message);
      return null;
    }

    const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    // Aggiunge un cache-buster per forzare l'aggiornamento dell'immagine sui client
    return `${data.publicUrl}?t=${Date.now()}`;
  } catch (err) {
    console.error('[avatar] Unexpected upload error:', err);
    return null;
  }
}

/**
 * Elimina la foto profilo da Supabase Storage.
 */
export async function deleteAvatarFromStorage(userId: string): Promise<void> {
  if (!supabase) return;
  const client = supabase;
  try {
    await client.storage.from(STORAGE_BUCKET).remove([`${userId}/avatar.jpg`]);
  } catch (err) {
    console.error('[avatar] Storage delete error:', err);
  }
}
