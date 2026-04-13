/**
 * Firestore I/O for shared industry research documents (業界研究.md).
 *
 * Storage layout:
 *   /industryResearch/{industryName} {
 *     content:   string,   // full markdown text
 *     updatedAt: serverTimestamp,
 *   }
 *
 * Write access is admin-only (via `scripts/uploadIndustryResearch.ts`).
 * Clients only read during the onboarding flow.
 *
 * Firestore security rules (configure manually in Firebase Console):
 *   match /industryResearch/{doc} {
 *     allow read:  if request.auth != null;
 *     allow write: if false;
 *   }
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../spreadsheet/lib/firebase';

const COLLECTION = 'industryResearch';

/**
 * Pull the pre-written 業界研究.md content for a given industry from
 * Firestore. Returns the markdown string, or `null` if unavailable.
 */
export async function pullIndustryResearch(
  industryName: string,
): Promise<string | null> {
  if (!db) return null;
  const trimmed = industryName.trim();
  if (!trimmed) return null;

  try {
    const snap = await getDoc(doc(db, COLLECTION, trimmed));
    if (!snap.exists()) return null;
    const data = snap.data() as { content?: unknown } | undefined;
    if (!data || typeof data.content !== 'string' || !data.content.trim()) {
      return null;
    }
    return data.content;
  } catch (e) {
    console.warn('[industryResearch] pull failed:', e);
    return null;
  }
}
