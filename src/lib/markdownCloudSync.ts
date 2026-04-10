/**
 * Markdown file cloud sync (Firestore).
 *
 * Each markdown file (identified by its stable `fileKey`) is mirrored to a
 * Firestore document at `users/{uid}/notes/{hashedKey}`. Content may be
 * encrypted with the same passphrase used by the spreadsheet module
 * (shared via sessionStorage + zustand store) so that ES / self-analysis
 * stays confidential even from the Firestore console.
 *
 * Design:
 *   - doc id = SHA-1(fileKey) hex   (to sidestep Firestore's `/` restriction
 *     and avoid non-ASCII weirdness in doc ids).
 *   - passphrase is optional; if absent we save plain text.
 *   - salt is per-document, generated on first write and reused on subsequent
 *     writes via the `saltReuse` arg so the same cached key can be reused.
 *   - last-write-wins; callers compare `updatedAt` with the local file mtime.
 */

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../spreadsheet/lib/firebase';
import {
  decryptString,
  encryptString,
  generateSalt,
  isEncrypted,
} from '../spreadsheet/lib/crypto';

interface NoteDoc {
  key: string;
  label: string;
  breadcrumb: string[];
  content: string;
  salt: string;
  encrypted: boolean;
  updatedAt: Timestamp | null;
  updatedFromClientAt: string;
}

/** SHA-1(fileKey) hex — 40 chars, URL/Firestore-safe, effectively unique. */
export async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-1',
    new TextEncoder().encode(key),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface PushNoteArgs {
  uid: string;
  fileKey: string;
  label: string;
  breadcrumb: string[];
  content: string;
  passphrase: string | null;
  /** Reuse salt from a previous push/pull so the cached key stays hot. */
  saltReuse?: string | null;
}

export interface PushNoteResult {
  salt: string;
  encrypted: boolean;
}

/** Upload a markdown file to Firestore. No-op if Firebase is not initialized. */
export async function pushNote(args: PushNoteArgs): Promise<PushNoteResult | null> {
  if (!db) return null;
  const id = await hashKey(args.fileKey);
  const salt = args.saltReuse || generateSalt();
  const shouldEncrypt = !!args.passphrase;
  const storedContent = shouldEncrypt
    ? await encryptString(args.content, args.passphrase!, salt)
    : args.content;

  const payload: Omit<NoteDoc, 'updatedAt'> & {
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    key: args.fileKey,
    label: args.label,
    breadcrumb: args.breadcrumb,
    content: storedContent,
    salt,
    encrypted: shouldEncrypt,
    updatedAt: serverTimestamp(),
    updatedFromClientAt: new Date().toISOString(),
  };
  const ref = doc(db, 'users', args.uid, 'notes', id);
  await setDoc(ref, payload);
  return { salt, encrypted: shouldEncrypt };
}

export interface PullNoteResult {
  content: string;
  updatedAt: Date | null;
  encrypted: boolean;
  salt: string;
  /** True when the cloud doc is encrypted but we could not decrypt it. */
  decryptFailed: boolean;
}

/**
 * Download a markdown file from Firestore. Returns null when:
 *   - Firebase is not configured, OR
 *   - the doc does not exist yet.
 *
 * When the cloud doc is encrypted and no passphrase is supplied (or it is
 * wrong), returns the raw cipher text and sets `decryptFailed: true` so the
 * caller can skip it and preserve the local copy untouched.
 */
export async function pullNote(
  uid: string,
  fileKey: string,
  passphrase: string | null,
): Promise<PullNoteResult | null> {
  if (!db) return null;
  const id = await hashKey(fileKey);
  const ref = doc(db, 'users', uid, 'notes', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as NoteDoc;

  const rawContent = data.content ?? '';
  const salt = data.salt || generateSalt();
  let content = rawContent;
  let decryptFailed = false;

  if (data.encrypted && isEncrypted(rawContent)) {
    if (passphrase) {
      try {
        const plain = await decryptString(rawContent, passphrase, salt);
        // decryptString returns '' on wrong passphrase; distinguish from a
        // genuinely empty file by checking the cipher length.
        if (plain === '' && rawContent.length > 10) {
          decryptFailed = true;
        } else {
          content = plain;
        }
      } catch {
        decryptFailed = true;
      }
    } else {
      decryptFailed = true;
    }
  }

  const updatedAt =
    data.updatedAt && typeof (data.updatedAt as Timestamp).toDate === 'function'
      ? (data.updatedAt as Timestamp).toDate()
      : data.updatedFromClientAt
        ? new Date(data.updatedFromClientAt)
        : null;

  return {
    content,
    updatedAt,
    encrypted: !!data.encrypted,
    salt,
    decryptFailed,
  };
}
