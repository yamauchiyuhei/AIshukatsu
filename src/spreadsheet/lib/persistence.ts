import { del, get, set } from 'idb-keyval';
import { Column, Row, Sheet, Workbook } from '../types/sheet';
import { createPresetColumns } from './presetColumns';

const KEY_V1 = 'shukatsu-sheet-v1';
const KEY_V2 = 'shukatsu-workbook-v2';
const KEY_BACKUPS = 'shukatsu-backups';
const KEY_LAST_BACKUP = 'shukatsu-last-backup-day';
const KEY_LOCAL_UPDATED = 'shukatsu-workbook-updated-at';
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

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeSheet(name: string, columns: Column[], rows: Row[]): Sheet {
  return { id: uid('s'), name, columns, rows };
}

function emptyWorkbook(): Workbook {
  const sheet = makeSheet('本選考', createPresetColumns(), []);
  return { version: 2, sheets: [sheet], activeSheetId: sheet.id };
}

/**
 * Loads the workbook (v2). If only legacy v1 data exists, migrates it
 * once into a single sheet named "本選考". If nothing exists returns null.
 */
export async function loadWorkbook(): Promise<Workbook | null> {
  try {
    const wb = await get<Workbook>(KEY_V2);
    if (wb && wb.sheets?.length) return wb;

    // Migration path
    const legacy = await get<LegacyV1>(KEY_V1);
    if (legacy && legacy.columns?.length) {
      const sheet = makeSheet('本選考', legacy.columns, legacy.rows ?? []);
      const migrated: Workbook = {
        version: 2,
        sheets: [sheet],
        activeSheetId: sheet.id,
      };
      await set(KEY_V2, migrated);
      return migrated;
    }
    return null;
  } catch (e) {
    console.error('loadWorkbook failed', e);
    return null;
  }
}

export async function saveWorkbook(wb: Workbook): Promise<void> {
  try {
    await set(KEY_V2, wb);
  } catch (e) {
    console.error('saveWorkbook failed', e);
  }
}

export function createInitialWorkbook(): Workbook {
  return emptyWorkbook();
}

/* ----------- Auto backups ----------- */

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function maybeAutoBackup(wb: Workbook): Promise<void> {
  try {
    const last = await get<string>(KEY_LAST_BACKUP);
    const today = todayKey();
    if (last === today) return;
    const list = (await get<BackupEntry[]>(KEY_BACKUPS)) ?? [];
    const entry: BackupEntry = {
      id: uid('bk'),
      createdAt: new Date().toISOString(),
      workbook: wb,
    };
    const next = [entry, ...list].slice(0, MAX_BACKUPS);
    await set(KEY_BACKUPS, next);
    await set(KEY_LAST_BACKUP, today);
  } catch (e) {
    console.error('maybeAutoBackup failed', e);
  }
}

export async function listBackups(): Promise<BackupEntry[]> {
  return (await get<BackupEntry[]>(KEY_BACKUPS)) ?? [];
}

export async function restoreBackup(id: string): Promise<Workbook | null> {
  const list = await listBackups();
  const found = list.find((b) => b.id === id);
  return found?.workbook ?? null;
}

/* ----------- Sync bookkeeping ----------- */
/**
 * Local workbook "dirty since last cloud sync" marker. `null` means the
 * local workbook has no unsynced changes. A non-null ISO timestamp means
 * the user edited locally at that time and the change has not yet been
 * pushed to the cloud.
 *
 * This is intentionally NOT keyed per-user: it tracks the state of the
 * single local IndexedDB workbook, which is shared across accounts on
 * this device.
 */
export async function loadLocalUpdatedAt(): Promise<string | null> {
  try {
    return (await get<string>(KEY_LOCAL_UPDATED)) ?? null;
  } catch {
    return null;
  }
}

export async function saveLocalUpdatedAt(iso: string | null): Promise<void> {
  try {
    if (iso == null) await del(KEY_LOCAL_UPDATED);
    else await set(KEY_LOCAL_UPDATED, iso);
  } catch (e) {
    console.error('saveLocalUpdatedAt failed', e);
  }
}

/**
 * Per-user "last successful cloud sync" timestamp. Keyed by Firebase UID
 * so that multiple Google accounts on the same device track their own
 * sync state independently.
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
