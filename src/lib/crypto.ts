export interface EncryptedBlob {
  v: 1;
  salt: string;
  iv: string;
  ct: string;
}

const PBKDF2_ITER = 200_000;
const SALT_LEN = 16;
const IV_LEN = 12;

type U8 = Uint8Array<ArrayBuffer>;

function newU8(len: number): U8 {
  return new Uint8Array(new ArrayBuffer(len)) as U8;
}

function randomU8(len: number): U8 {
  return crypto.getRandomValues(newU8(len));
}

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function b64decode(str: string): U8 {
  const bin = atob(str);
  const u8 = newU8(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function deriveKey(password: string, salt: U8): Promise<CryptoKey> {
  const pwBuf = newU8(new TextEncoder().encode(password).length);
  pwBuf.set(new TextEncoder().encode(password));
  const baseKey = await crypto.subtle.importKey(
    'raw',
    pwBuf,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(
  data: unknown,
  password: string,
): Promise<EncryptedBlob> {
  const salt = randomU8(SALT_LEN);
  const iv = randomU8(IV_LEN);
  const key = await deriveKey(password, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const pt = newU8(encoded.length);
  pt.set(encoded);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt);
  return { v: 1, salt: b64encode(salt), iv: b64encode(iv), ct: b64encode(ct) };
}

export async function decryptJson<T = unknown>(
  blob: EncryptedBlob,
  password: string,
): Promise<T> {
  const salt = b64decode(blob.salt);
  const iv = b64decode(blob.iv);
  const ct = b64decode(blob.ct);
  const key = await deriveKey(password, salt);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}
