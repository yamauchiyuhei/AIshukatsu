/**
 * Bulk restore: recreate the entire workspace folder structure and files
 * from the Firestore cloud backup (`users/{uid}/notes/*`).
 *
 * Flow:
 *   1. Fetch all notes via `listAllNotes(uid, passphrase)`
 *   2. Validate & sanitise breadcrumb / label
 *   3. Create missing directories from breadcrumb
 *   4. Write file content (skip if local file already exists)
 *
 * This is a one-shot "disaster recovery" operation, not a real-time sync.
 * Supports an AbortSignal so the user can cancel mid-restore.
 */

import { listAllNotes, type CloudNoteEntry } from './markdownCloudSync';
import { createSubdirectory, writeTextFile } from './fs';

export interface RestoreProgress {
  /** "fetching" while downloading from Firestore, "writing" while creating files. */
  phase: 'fetching' | 'writing';
  total: number;
  done: number;
  created: number;
  skipped: number;
  failed: number;
  current: string;
}

export type OnProgress = (p: RestoreProgress) => void;

export interface RestoreResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  decryptFailed: number;
  cancelled: boolean;
  errors: Array<{ key: string; error: string }>;
}

// ── Validation helpers ───────────────────────────────────────────────────

/** Characters forbidden in file/folder names across macOS, Windows, Linux. */
const INVALID_NAME_RE = /[\/\\:*?"<>|]/;

/** Reject path-traversal segments and invalid names. */
function isValidSegment(s: string): boolean {
  if (!s || s === '.' || s === '..') return false;
  if (INVALID_NAME_RE.test(s)) return false;
  if (s.length > 255) return false;
  return true;
}

/**
 * Restore all cloud-backed notes into the given root directory.
 *
 * For each note the breadcrumb array defines the folder path and label is
 * the file name. Example:
 *   breadcrumb: ['IT・通信', 'DeNA']  label: '企業分析.md'
 *   → creates  root/IT・通信/DeNA/企業分析.md
 *
 * Files that already exist locally are **skipped** (we don't overwrite
 * the user's local edits — this is a restore, not a sync).
 */
export async function restoreAllFromCloud(
  uid: string,
  passphrase: string | null,
  root: FileSystemDirectoryHandle,
  onProgress?: OnProgress,
  signal?: AbortSignal,
): Promise<RestoreResult> {
  const result: RestoreResult = {
    total: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    decryptFailed: 0,
    cancelled: false,
    errors: [],
  };

  // ── Phase 1: Fetch ────────────────────────────────────────────────────
  onProgress?.({
    phase: 'fetching',
    total: 0,
    done: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    current: 'クラウドからデータ取得中…',
  });

  const notes = await listAllNotes(uid, passphrase);
  result.total = notes.length;

  if (notes.length === 0) return result;

  // Filter out unrestorable entries
  const restorable: CloudNoteEntry[] = [];
  for (const n of notes) {
    if (n.decryptFailed) {
      result.decryptFailed++;
      result.skipped++;
      continue;
    }
    // Validate label (filename)
    if (!n.label || !isValidSegment(n.label)) {
      result.skipped++;
      result.errors.push({
        key: n.key || '(unknown)',
        error: `無効なファイル名: "${n.label || ''}"`,
      });
      continue;
    }
    // Validate breadcrumb segments
    const badSeg = n.breadcrumb.find((s) => !isValidSegment(s));
    if (badSeg !== undefined) {
      result.skipped++;
      result.errors.push({
        key: n.key || '(unknown)',
        error: `無効なフォルダ名を含む: "${badSeg}"`,
      });
      continue;
    }
    restorable.push(n);
  }

  // ── Phase 2: Write ────────────────────────────────────────────────────
  for (let i = 0; i < restorable.length; i++) {
    // Abort check
    if (signal?.aborted) {
      result.cancelled = true;
      break;
    }

    const note = restorable[i];
    const filePath = [...note.breadcrumb, note.label].join('/');

    onProgress?.({
      phase: 'writing',
      total: restorable.length,
      done: i,
      created: result.created,
      skipped: result.skipped,
      failed: result.failed,
      current: filePath,
    });

    try {
      // Walk breadcrumb to create/get nested directory
      let dir = root;
      for (const segment of note.breadcrumb) {
        dir = await createSubdirectory(dir, segment);
      }

      // Check if file already exists (only skip on NotFoundError)
      let exists = false;
      try {
        await dir.getFileHandle(note.label);
        exists = true;
      } catch (e) {
        // NotFoundError is the expected "doesn't exist" case.
        // TypeName check works across browsers.
        if (e instanceof DOMException && e.name === 'NotFoundError') {
          exists = false;
        } else if (e instanceof TypeError) {
          // Some browsers throw TypeError for not-found
          exists = false;
        } else {
          // Unexpected error (permissions, etc.) → treat as failure
          throw e;
        }
      }

      if (exists) {
        result.skipped++;
        continue;
      }

      // Write file
      await writeTextFile(dir, note.label, note.content);
      result.created++;
    } catch (e) {
      result.failed++;
      result.errors.push({
        key: note.key || filePath,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  onProgress?.({
    phase: 'writing',
    total: restorable.length,
    done: result.cancelled ? -1 : restorable.length,
    created: result.created,
    skipped: result.skipped,
    failed: result.failed,
    current: result.cancelled ? 'キャンセル' : '完了',
  });

  return result;
}
