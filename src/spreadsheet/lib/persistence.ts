import { del, get, set } from 'idb-keyval';
import { Column, Row, Sheet, Workbook } from '../types/sheet';
import { createPresetColumns } from './presetColumns';

// ── Legacy shared keys (kept for migration, never deleted) ──────────────
const KEY_V1 = 'shukatsu-sheet-v1';
const KEY_V2_SHARED = 'shukatsu-workbook-v2';
const KEY_BACKUPS_SHARED = 'shukatsu-backups';
const KEY_LAST_BACKUP_SHARED = 'shukatsu-last-backup-day';
const KEY_LOCAL_UPDATED_SHARED = 'shukatsu-workbook-updated-at';

// ── Per-user key builders ───────────────────────────────────────────────
function keyWorkbook(uid: string) { return `shukatsu-workbook-v2:${uid}`; }
function keyBackups(uid: string) { return `shukatsu-backups:${uid}`; }
function keyLastBackup(uid: string) { return `shukatsu-last-backup-day:${uid}`; }
function keyLocalUpdated(uid: string) { return `shukatsu-workbook-updated-at:${uid}`; }

const KEY_CLOUD_SYNC_PREFIX = 'shukatsu-cloud-synced-at:';

const MAX_BACKUPS = 14;

interface LegacyV1 {
  columns: Column[];
  rows: Row[];
}

interface BackupEntry {
  id: string;
  createdAt: string; // ISO
  workbook: Workbook;
}

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeSheet(name: string, columns: Column[], rows: Row[]): Sheet {
  return { id: genId('s'), name, columns, rows };
}

function emptyWorkbook(): Workbook {
  const sheet = makeSheet('本選考', createPresetColumns(), []);
  return { version: 2, sheets: [sheet], activeSheetId: sheet.id };
}

// ── Migration: shared → per-user ────────────────────────────────────────
const KEY_MIGRATION_DONE = 'shukatsu-shared-migrated-to-uid';

/**
 * One-time migration: copies existing data from the old shared keys into
 * per-user keys. Only runs ONCE — after the first user claims the shared
 * data, a flag is set so subsequent users start with a fresh workbook.
 *
 * The shared keys are **never deleted** (they serve as a safety backup).
 */
async function migrateSharedToUser(uid: string): Promise<Workbook | null> {
  // If migration has already been done for any user, don't copy shared
  // data to another account — that user should start fresh.
  try {
    const alreadyMigrated = await get<string>(KEY_MIGRATION_DONE);
    if (alreadyMigrated) return null;
  } catch {}

  try {
    // 1. Try v2 shared
    const wb = await get<Workbook>(KEY_V2_SHARED);
    if (wb && wb.sheets?.length) {
      await set(keyWorkbook(uid), wb);
      // Also migrate backups and timestamps
      const backups = await get<BackupEntry[]>(KEY_BACKUPS_SHARED);
      if (backups) await set(keyBackups(uid), backups);
      const lastBackup = await get<string>(KEY_LAST_BACKUP_SHARED);
      if (lastBackup) await set(keyLastBackup(uid), lastBackup);
      const localUpdated = await get<string>(KEY_LOCAL_UPDATED_SHARED);
      if (localUpdated) await set(keyLocalUpdated(uid), localUpdated);
      // Mark migration as done so the NEXT user gets a fresh workbook
      await set(KEY_MIGRATION_DONE, uid);
      console.log(`[persistence] migrated shared workbook to user ${uid}`);
      return wb;
    }

    // 2. Try legacy v1 shared → convert + migrate
    const legacy = await get<LegacyV1>(KEY_V1);
    if (legacy && legacy.columns?.length) {
      const sheet = makeSheet('本選考', legacy.columns, legacy.rows ?? []);
      const migrated: Workbook = {
        version: 2,
        sheets: [sheet],
        activeSheetId: sheet.id,
      };
      await set(keyWorkbook(uid), migrated);
      // Also save to shared v2 so future migrations don't re-read v1
      await set(KEY_V2_SHARED, migrated);
      await set(KEY_MIGRATION_DONE, uid);
      console.log(`[persistence] migrated legacy v1 to user ${uid}`);
      return migrated;
    }

    return null;
  } catch (e) {
    console.error('[persistence] migration failed', e);
    return null;
  }
}

// ── Cleanup: remove data that was mistakenly copied to wrong accounts ───
/**
 * v0.2.3 bug: the migration copied shared data to every account that
 * logged in (not just the original owner). This cleanup runs once per
 * uid: if the migration flag says uid X owns the data, and the current
 * uid is NOT X, delete the per-user key so this user starts fresh.
 */
const KEY_CLEANUP_DONE_PREFIX = 'shukatsu-cleanup-done:';
async function cleanupMisCopiedData(uid: string): Promise<void> {
  try {
    const done = await get<boolean>(KEY_CLEANUP_DONE_PREFIX + uid);
    if (done) return; // already cleaned up for this uid

    const owner = await get<string>(KEY_MIGRATION_DONE);
    if (owner && owner !== uid) {
      // This uid is NOT the original owner — remove the mis-copied data
      const existing = await get<Workbook>(keyWorkbook(uid));
      if (existing) {
        await del(keyWorkbook(uid));
        await del(keyBackups(uid));
        await del(keyLastBackup(uid));
        await del(keyLocalUpdated(uid));
        console.log(`[persistence] cleaned up mis-copied data for ${uid} (owner: ${owner})`);
      }
    }
    await set(KEY_CLEANUP_DONE_PREFIX + uid, true);
  } catch (e) {
    console.warn('[persistence] cleanup failed', e);
  }
}

// ── Workbook load / save (per-user) ─────────────────────────────────────

/**
 * Loads the workbook for a specific user. If no per-user data exists,
 * attempts to migrate from the shared (legacy) key. Returns null if
 * no data exists anywhere.
 */
export async function loadWorkbook(uid: string): Promise<Workbook | null> {
  try {
    // First, clean up any data that was mistakenly copied by v0.2.3
    await cleanupMisCopiedData(uid);

    // 1. Try per-user key first
    const wb = await get<Workbook>(keyWorkbook(uid));
    if (wb && wb.sheets?.length) return wb;

    // 2. Migrate from shared key
    return await migrateSharedToUser(uid);
  } catch (e) {
    console.error('loadWorkbook failed', e);
    return null;
  }
}

export async function saveWorkbook(uid: string, wb: Workbook): Promise<void> {
  try {
    await set(keyWorkbook(uid), wb);
  } catch (e) {
    console.error('saveWorkbook failed', e);
  }
}

export function createInitialWorkbook(): Workbook {
  return emptyWorkbook();
}

/* ----------- Auto backups (per-user) ----------- */

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function maybeAutoBackup(uid: string, wb: Workbook): Promise<void> {
  try {
    const last = await get<string>(keyLastBackup(uid));
    const today = todayKey();
    if (last === today) return;
    const list = (await get<BackupEntry[]>(keyBackups(uid))) ?? [];
    const entry: BackupEntry = {
      id: genId('bk'),
      createdAt: new Date().toISOString(),
      workbook: wb,
    };
    const next = [entry, ...list].slice(0, MAX_BACKUPS);
    await set(keyBackups(uid), next);
    await set(keyLastBackup(uid), today);
  } catch (e) {
    console.error('maybeAutoBackup failed', e);
  }
}

export async function listBackups(uid: string): Promise<BackupEntry[]> {
  return (await get<BackupEntry[]>(keyBackups(uid))) ?? [];
}

export async function restoreBackup(uid: string, id: string): Promise<Workbook | null> {
  const list = await listBackups(uid);
  const found = list.find((b) => b.id === id);
  return found?.workbook ?? null;
}

/* ----------- Sync bookkeeping (per-user) ----------- */

export async function loadLocalUpdatedAt(uid: string): Promise<string | null> {
  try {
    return (await get<string>(keyLocalUpdated(uid))) ?? null;
  } catch {
    return null;
  }
}

export async function saveLocalUpdatedAt(uid: string, iso: string | null): Promise<void> {
  try {
    if (iso == null) await del(keyLocalUpdated(uid));
    else await set(keyLocalUpdated(uid), iso);
  } catch (e) {
    console.error('saveLocalUpdatedAt failed', e);
  }
}

/**
 * Per-user "last successful cloud sync" timestamp. Already keyed by UID
 * in the original implementation — no change needed here.
 */
export async function loadCloudSyncedAt(uid: string): Promise<string | null> {
  try {
    return (await get<string>(KEY_CLOUD_SYNC_PREFIX + uid)) ?? null;
  } catch {
    return null;
  }
}

export async function saveCloudSyncedAt(
  uid: string,
  iso: string | null,
): Promise<void> {
  try {
    if (iso == null) await del(KEY_CLOUD_SYNC_PREFIX + uid);
    else await set(KEY_CLOUD_SYNC_PREFIX + uid, iso);
  } catch (e) {
    console.error('saveCloudSyncedAt failed', e);
  }
}
