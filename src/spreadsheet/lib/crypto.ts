/**
 * Passphrase-based AES-GCM encryption for sensitive cells (password columns).
 * The passphrase never leaves the device. The salt is stored alongside the
 * encrypted blob in Firestore so any device with the same passphrase can
 * derive the same key.
 */

const ENC_PREFIX = 'enc:v1:';
const ITERATIONS = 150_000;

const enc = new TextEncoder();
const dec = new TextDecoder();

let cachedKey: { passphrase: string; salt: string; key: CryptoKey } | null = null;

async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  if (
    cachedKey &&
    cachedKey.passphrase === passphrase &&
    cachedKey.salt === saltB64
  ) {
    return cachedKey.key;
  }
  const salt = b64ToBytes(saltB64);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  cachedKey = { passphrase, salt: saltB64, key };
  return key;
}

export function generateSalt(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return bytesToB64(buf);
}

export async function encryptString(
  plain: string,
  passphrase: string,
  saltB64: string,
): Promise<string> {
  if (!plain) return '';
  const key = await deriveKey(passphrase, saltB64);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(plain) as BufferSource,
  );
  // Pack: ENC_PREFIX + base64(iv) + ":" + base64(ct)
  return `${ENC_PREFIX}${bytesToB64(iv)}:${bytesToB64(new Uint8Array(ct))}`;
}

export async function decryptString(
  cipher: string,
  passphrase: string,
  saltB64: string,
): Promise<string> {
  if (!cipher) return '';
  if (!cipher.startsWith(ENC_PREFIX)) return cipher;
  const body = cipher.slice(ENC_PREFIX.length);
  const [ivB64, ctB64] = body.split(':');
  if (!ivB64 || !ctB64) return cipher;
  try {
    const key = await deriveKey(passphrase, saltB64);
    const iv = b64ToBytes(ivB64);
    const ct = b64ToBytes(ctB64);
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ct as BufferSource,
    );
    return dec.decode(pt);
  } catch {
    return ''; // wrong passphrase or tampered
  }
}

export function isEncrypted(s: unknown): boolean {
  return typeof s === 'string' && s.startsWith(ENC_PREFIX);
}

/* ----------- helpers ----------- */
function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Reset cached key (e.g. on sign-out). */
export function clearCryptoCache() {
  cachedKey = null;
}
