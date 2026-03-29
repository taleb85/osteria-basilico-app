/** Prefisso internazionale predefinito (Regno Unito). */
export const DEFAULT_PHONE_PREFIX = '+44';

/** Opzioni prefisso per il profilo (ordine di presentazione). */
export const PHONE_PREFIX_OPTIONS: readonly { value: string; label: string; example: string }[] = [
  { value: '+44', label: '+44 GB', example: '7700 123456' },
  { value: '+39', label: '+39 IT', example: '333 1234567' },
  { value: '+33', label: '+33 FR', example: '06 12 34 56 78' },
  { value: '+34', label: '+34 ES', example: '612 345 678' },
  { value: '+49', label: '+49 DE', example: '0151 12345678' },
  { value: '+41', label: '+41 CH', example: '079 123 45 67' },
  { value: '+423', label: '+423 LI', example: '791 23 45' },
  { value: '+1', label: '+1 US/CA', example: '202-555-0123' },
] as const;

function sortedPrefixesLongestFirst(): string[] {
  return [...PHONE_PREFIX_OPTIONS.map((o) => o.value)].sort((a, b) => b.length - a.length);
}

/** Scompone il numero salvato (es. +39333…) in prefisso + parte nazionale. */
export function splitPhoneForForm(full: string | undefined | null): { prefix: string; national: string } {
  const compact = (full ?? '').trim().replace(/\s/g, '');
  if (!compact) return { prefix: DEFAULT_PHONE_PREFIX, national: '' };
  for (const p of sortedPrefixesLongestFirst()) {
    if (compact.startsWith(p)) {
      return { prefix: p, national: compact.slice(p.length).replace(/\D/g, '') };
    }
  }
  if (compact.startsWith('+')) {
    return { prefix: DEFAULT_PHONE_PREFIX, national: compact.replace(/^\+/, '').replace(/\D/g, '') };
  }
  return { prefix: DEFAULT_PHONE_PREFIX, national: compact.replace(/\D/g, '') };
}

/** Unisce prefisso e numero nazionale per il campo `users.phone`. */
export function joinPhone(prefix: string, national: string): string | undefined {
  const n = national.replace(/\D/g, '');
  if (!n) return undefined;
  const p = (prefix.trim() || DEFAULT_PHONE_PREFIX).replace(/^\+/, '');
  return `+${p}${n}`;
}
