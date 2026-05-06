/**
 * Utility per hashing del PIN lato client prima di inviarlo al DB.
 * Usa SHA-256 via Web Crypto API.
 * NOTA: Questo è un layer di sicurezza aggiuntivo. In produzione,
 * l'ideale sarebbe usare bcrypt lato server (Edge Function).
 */

/**
 * Calcola SHA-256 di una stringa, restituisce l'hex digest.
 */
export async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifica un PIN confrontando hash.
 */
export async function verifyPin(plainPin: string, storedHash: string): Promise<boolean> {
  const computed = await hashPin(plainPin);
  return computed === storedHash;
}
