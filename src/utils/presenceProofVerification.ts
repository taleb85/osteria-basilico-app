import { normalizePresenceProof } from './presenceVerificationPayload';

const V2_PREFIX = 'ob-punch-v2|';

/** Solo `VITE_PRESENCE_QR_SECRET` per firma HMAC del QR (v2 + exp). Senza secret: niente QR firmato, resta il token statico. */
function readPresenceQrHmacSecret(): string {
  const a = import.meta.env.VITE_PRESENCE_QR_SECRET;
  return typeof a === 'string' ? a.trim() : '';
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const A = a.replace(/^0x/i, '').toLowerCase();
  const B = b.replace(/^0x/i, '').toLowerCase();
  if (A.length !== B.length || A.length % 2 !== 0) return false;
  let diff = 0;
  for (let i = 0; i < A.length; i++) {
    diff |= A.charCodeAt(i) ^ B.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  return [...bytes].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Payload da codificare nel QR (stampa da Impostazioni). Richiede `VITE_PRESENCE_QR_SECRET`.
 * Include scadenza: QR fotografato dopo expiry non è più valido.
 */
export async function buildSignedPresenceQrPayload(
  baseToken: string,
  tenantSlug: string,
  ttlSeconds = 7 * 24 * 60 * 60
): Promise<string | null> {
  const secret = readPresenceQrHmacSecret();
  const tok = normalizePresenceProof(baseToken);
  const slug = (tenantSlug || 'default').trim();
  if (!secret || !tok) return null;
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const msg = `${exp}|${slug}|${tok}`;
  const sig = await hmacSha256Hex(secret, msg);
  return `${V2_PREFIX}${exp}|${sig}`;
}

export type PresenceVerifyResult =
  | { ok: true; method: 'signed_v2' | 'static_token' }
  | { ok: false; reason: 'expired' | 'bad_signature' | 'missing_secret_for_v2' | 'mismatch' };

/**
 * Verifica proof scansionato: firma HMAC con scadenza (v2) oppure uguaglianza al token statico.
 */
export async function verifyPresenceProofScanned(
  scannedRaw: string,
  effectiveStaticToken: string,
  tenantSlug: string
): Promise<PresenceVerifyResult> {
  const scanned = normalizePresenceProof(scannedRaw);
  const expected = normalizePresenceProof(effectiveStaticToken);
  const slug = (tenantSlug || 'default').trim();

  if (scanned.startsWith('ob-punch-v2|')) {
    const secret = readPresenceQrHmacSecret();
    if (!secret) return { ok: false, reason: 'missing_secret_for_v2' };
    const rest = scanned.slice('ob-punch-v2|'.length);
    const pipe = rest.indexOf('|');
    if (pipe < 0) return { ok: false, reason: 'bad_signature' };
    const expStr = rest.slice(0, pipe);
    const sig = rest.slice(pipe + 1);
    const exp = parseInt(expStr, 10);
    if (!Number.isFinite(exp) || exp <= 0) return { ok: false, reason: 'bad_signature' };
    if (Math.floor(Date.now() / 1000) > exp) return { ok: false, reason: 'expired' };
    if (!expected) return { ok: false, reason: 'mismatch' };
    const msg = `${exp}|${slug}|${expected}`;
    const want = await hmacSha256Hex(secret, msg);
    if (!timingSafeEqualHex(want, sig)) return { ok: false, reason: 'bad_signature' };
    return { ok: true, method: 'signed_v2' };
  }

  if (scanned && expected && scanned === expected) {
    return { ok: true, method: 'static_token' };
  }
  return { ok: false, reason: 'mismatch' };
}
