/**
 * Firestore I/O for the **shared, global** company-name master list.
 *
 * Storage layout:
 *   /companyMaster/all {
 *     version: 1,
 *     names:    string[],         // unique, ja-sorted
 *     updatedAt: serverTimestamp,
 *     updatedFromClientAt: ISO string,
 *   }
 *
 * The list is read by `useCompanyMaster()` to power the company-name combobox
 * inside `AddCompanyModal`. New companies the user creates are appended via
 * `addCompanyToMaster()` (`arrayUnion`, fire-and-forget from App.tsx).
 *
 * Firestore security rules (must be configured manually in Firebase Console):
 *   match /companyMaster/{doc} {
 *     allow read:  if request.auth != null;
 *     allow write: if request.auth != null;
 *   }
 */

import {
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../spreadsheet/lib/firebase';

const COLLECTION = 'companyMaster';
const DOC_ID = 'all';

function refOrNull() {
  if (!db) return null;
  return doc(db, COLLECTION, DOC_ID);
}

/**
 * Read the master list from Firestore. Returns:
 *  - `string[]` on success
 *  - `null`     when the document does not yet exist (caller may seed)
 *  - throws on auth/network errors so the caller can fall back to bundled JSON
 */
export async function pullCompanyMaster(): Promise<string[] | null> {
  const ref = refOrNull();
  if (!ref) return null;
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return Array.isArray(data.names) ? (data.names as string[]) : [];
}

/**
 * Write an initial seed list. Used only on first run when the document does
 * not exist. Idempotent: subsequent calls overwrite, so callers should check
 * `pullCompanyMaster()` first.
 */
export async function seedCompanyMaster(initial: string[]): Promise<void> {
  const ref = refOrNull();
  if (!ref) return;
  const unique = Array.from(new Set(initial.map((s) => s.trim()).filter(Boolean)));
  unique.sort((a, b) => a.localeCompare(b, 'ja'));
  await setDoc(ref, {
    version: 1,
    names: unique,
    updatedAt: serverTimestamp(),
    updatedFromClientAt: new Date().toISOString(),
  });
}

/**
 * Append a company name to the master list. Uses `arrayUnion` so duplicates
 * are automatically deduped server-side. Falls back to `setDoc(merge)` if the
 * doc doesn't exist yet.
 */
export async function addCompanyToMaster(name: string): Promise<void> {
  const ref = refOrNull();
  if (!ref) return;
  const trimmed = name.trim();
  if (!trimmed) return;

  try {
    await updateDoc(ref, {
      names: arrayUnion(trimmed),
      updatedAt: serverTimestamp(),
      updatedFromClientAt: new Date().toISOString(),
    });
  } catch (e: unknown) {
    // The doc may not exist yet — create it with this single entry.
    const code = (e as { code?: string } | null)?.code;
    if (code === 'not-found' || code === 'failed-precondition') {
      await setDoc(
        ref,
        {
          version: 1,
          names: [trimmed],
          updatedAt: serverTimestamp(),
          updatedFromClientAt: new Date().toISOString(),
        },
        { merge: true },
      );
      return;
    }
    throw e;
  }
}
