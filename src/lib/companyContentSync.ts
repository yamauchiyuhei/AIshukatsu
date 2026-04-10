/**
 * Firestore I/O for **shared, global** company-content documents.
 *
 * Storage layout:
 *   /companyContent/{companyName} {
 *     version:    1,
 *     files:      { [filename: string]: markdown string },
 *                    // e.g. "企業分析.md" → "# 企業分析：DeNA\n...",
 *     sourceName: string,
 *     updatedAt:  serverTimestamp,
 *   }
 *
 * Purpose: pre-populated templates for each known company, so that when the
 * onboarding flow (or the manual "企業追加" button) creates a new company
 * folder, we can drop in a full analysis / ES prep / intern memo document
 * instead of the empty skeleton from `templateLoader.ts`.
 *
 * Write access is admin-only (the investment is done once via
 * `scripts/uploadCompanyContent.ts` with `firebase-admin`). Clients only read.
 *
 * Firestore security rules (configure manually in Firebase Console):
 *   match /companyContent/{doc} {
 *     allow read:  if request.auth != null;
 *     allow write: if false;
 *   }
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../spreadsheet/lib/firebase';

const COLLECTION = 'companyContent';

export interface CompanyContentDoc {
  version: number;
  files: Record<string, string>;
  sourceName: string;
}

function refOrNull(name: string) {
  if (!db) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  return doc(db, COLLECTION, trimmed);
}

/**
 * Read a populated company content document from Firestore.
 *
 * Returns:
 *  - the document if it exists and has a non-empty `files` map
 *  - `null` if the doc is absent (caller should fall back to empty templates)
 *  - throws on auth/network errors so the caller can decide (typically fall
 *    back to the empty-template path, logging a warning).
 */
export async function pullCompanyContent(
  companyName: string,
): Promise<CompanyContentDoc | null> {
  const ref = refOrNull(companyName);
  if (!ref) return null;
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<CompanyContentDoc> | undefined;
  if (!data || typeof data.files !== 'object' || data.files === null) {
    return null;
  }
  const files = data.files as Record<string, unknown>;
  // Defensive: only keep string values, drop anything else.
  const safeFiles: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) {
    if (typeof v === 'string') safeFiles[k] = v;
  }
  if (Object.keys(safeFiles).length === 0) return null;
  return {
    version: typeof data.version === 'number' ? data.version : 1,
    files: safeFiles,
    sourceName:
      typeof data.sourceName === 'string' ? data.sourceName : companyName.trim(),
  };
}
