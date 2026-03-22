import { supabase } from '../lib/supabase';

const BUCKET = 'app-config';
const FILE_PATH = 'role_feature_templates.json';
const STORAGE_KEY = 'osteria_role_feature_templates_v1';
/** Template per gruppo (admin escluso — sempre pieno). Il vecchio gruppo `proprietario` su Storage viene fuso in `management` in lettura. */
export type RoleTemplateGroup = 'management' | 'capo' | 'staff';

export type RoleFeatureTemplatesOnDisk = Partial<
  Record<RoleTemplateGroup, Partial<Record<string, boolean>>>
>;

const ALL_GROUPS: RoleTemplateGroup[] = ['management', 'capo', 'staff'];

let cache: RoleFeatureTemplatesOnDisk | null = null;

export function setRoleFeatureTemplatesCache(data: RoleFeatureTemplatesOnDisk | null): void {
  cache = data;
}

export function getRoleFeatureTemplatesCache(): RoleFeatureTemplatesOnDisk | null {
  return cache;
}

export function getLocalRoleFeatureTemplates(): RoleFeatureTemplatesOnDisk | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parseRoleTemplatesFile(parsed);
  } catch {
    return null;
  }
}

export function writeRoleFeatureTemplatesLocal(data: RoleFeatureTemplatesOnDisk): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function parseRoleTemplatesFile(raw: unknown): RoleFeatureTemplatesOnDisk | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: RoleFeatureTemplatesOnDisk = {};

  const staffBlock = o.staff;
  if (staffBlock && typeof staffBlock === 'object' && !Array.isArray(staffBlock)) {
    out.staff = { ...(staffBlock as Record<string, boolean>) };
  }

  const capoBlock = o.capo;
  if (capoBlock && typeof capoBlock === 'object' && !Array.isArray(capoBlock)) {
    out.capo = { ...(capoBlock as Record<string, boolean>) };
  }

  const legacyProp = o.proprietario;
  const mgmtBlock = o.management;
  let mergedMgmt: Record<string, boolean> = {};
  if (legacyProp && typeof legacyProp === 'object' && !Array.isArray(legacyProp)) {
    mergedMgmt = { ...(legacyProp as Record<string, boolean>) };
  }
  if (mgmtBlock && typeof mgmtBlock === 'object' && !Array.isArray(mgmtBlock)) {
    mergedMgmt = { ...mergedMgmt, ...(mgmtBlock as Record<string, boolean>) };
  }
  if (Object.keys(mergedMgmt).length > 0) {
    out.management = mergedMgmt;
  }

  return Object.keys(out).length ? out : null;
}

function mergeDiskLayers(
  remote: RoleFeatureTemplatesOnDisk | null,
  local: RoleFeatureTemplatesOnDisk | null
): RoleFeatureTemplatesOnDisk | null {
  if (!remote && !local) return null;
  const out: RoleFeatureTemplatesOnDisk = {};
  for (const g of ALL_GROUPS) {
    // Local come fallback offline; **remote vince** su stessa chiave (evita 127.0.0.1 con cache vecchia ≠ produzione).
    out[g] = { ...(local?.[g] ?? {}), ...(remote?.[g] ?? {}) };
  }
  return out;
}

export async function loadRoleFeatureTemplatesFromSupabase(): Promise<RoleFeatureTemplatesOnDisk | null> {
  if (!supabase) return null;
  if (import.meta.env.VITE_FEATURE_FLAGS_STORAGE_ENABLED === 'false') return null;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(FILE_PATH);
    if (error || !data) return null;
    const text = await data.text();
    const parsed = JSON.parse(text) as unknown;
    return parseRoleTemplatesFile(parsed);
  } catch {
    return null;
  }
}

export async function saveRoleFeatureTemplatesToSupabase(data: RoleFeatureTemplatesOnDisk): Promise<void> {
  if (!supabase) throw new Error('Supabase non configurato');
  const blob = new Blob([JSON.stringify(data, null, 0)], { type: 'application/json' });
  const { error } = await supabase.storage.from(BUCKET).upload(FILE_PATH, blob, {
    upsert: true,
    contentType: 'application/json',
    cacheControl: '3600',
  });
  if (error) {
    throw new Error(
      error.message ||
        'Upload su Storage fallito (bucket app-config o policy mancanti: vedi docs/SUPABASE_STORAGE_APP_CONFIG.md).'
    );
  }
}

export function loadAndMergeRoleTemplates(
  remote: RoleFeatureTemplatesOnDisk | null,
  local: RoleFeatureTemplatesOnDisk | null
): RoleFeatureTemplatesOnDisk | null {
  return mergeDiskLayers(remote, local);
}
