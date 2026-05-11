import { supabase } from '../lib/supabase';

const STORAGE_BUCKET = 'documents';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export interface StoredDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  user_id: string;
  tenant_id?: string;
  category: DocumentCategory;
  uploaded_at: string;
  signed_url?: string;
}

export type DocumentCategory = 'contract' | 'payroll' | 'hr' | 'other';

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  contract: 'Contratto',
  payroll: 'Busta paga',
  hr: 'Documento HR',
  other: 'Altro',
};

export function getCategoryLabel(cat: DocumentCategory): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

export function getAllowedTypes(): string[] {
  return ALLOWED_TYPES;
}

export function getMaxFileSize(): number {
  return MAX_FILE_SIZE;
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return `File troppo grande (max ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB)`;
  }
  if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith('.pdf')) {
    return 'Formato file non supportato. Usa PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX.';
  }
  return null;
}

function buildStoragePath(tenantId: string | null, userId: string, category: DocumentCategory, fileName: string): string {
  const ts = Date.now();
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return tenantId
    ? `${tenantId}/${userId}/${category}/${ts}_${safe}`
    : `${userId}/${category}/${ts}_${safe}`;
}

export async function uploadDocument(
  file: File,
  userId: string,
  category: DocumentCategory,
  tenantId?: string
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const err = validateFile(file);
  if (err) return { ok: false, error: err };

  const path = buildStoragePath(tenantId ?? null, userId, category, file.name);

  const { error: uploadError } = await supabase!.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    if (uploadError.message?.includes('bucket')) {
      return { ok: false, error: 'Bucket documents non trovato. Crearlo in Supabase Storage.' };
    }
    return { ok: false, error: uploadError.message ?? 'Errore upload' };
  }

  return { ok: true, path };
}

export async function deleteDocument(path: string): Promise<boolean> {
  const { error } = await supabase!.storage
    .from(STORAGE_BUCKET)
    .remove([path]);

  return !error;
}

export async function listDocuments(prefix: string): Promise<StoredDocument[]> {
  const { data, error } = await supabase!.storage
    .from(STORAGE_BUCKET)
    .list(prefix, {
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error || !data) return [];

  return data
    .filter((f) => f.metadata?.size > 0)
    .map((f) => ({
      id: f.id ?? f.name,
      name: f.name.replace(/^\d+_/, ''),
      size: f.metadata?.size ?? 0,
      type: f.metadata?.mimetype ?? 'application/octet-stream',
      user_id: prefix.split('/')[1] ?? '',
      category: (prefix.split('/')[2] ?? 'other') as DocumentCategory,
      uploaded_at: f.created_at ?? new Date().toISOString(),
    }));
}

export async function getDocumentUrl(path: string): Promise<string | null> {
  const { data } = await supabase!.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 3600); // 1 hour

  return data?.signedUrl ?? null;
}
