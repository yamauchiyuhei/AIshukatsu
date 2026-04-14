import { get, set, del } from 'idb-keyval';
import {
  asTauriDirectoryShim,
  isTauri,
  rehydrateTauriRootDirectory,
} from './tauriFsaShim';

const LEGACY_IDB_KEY = 'aisyuukatsu:rootDirHandle';
const LEGACY_TAURI_KEY = 'aisyuukatsu:rootDirPath';
const MIGRATION_DONE_KEY = 'aisyuukatsu:rootDir-migrated-to-uid';

function idbKey(uid: string) {
  return `aisyuukatsu:rootDirHandle:${uid}`;
}
function tauriPathKey(uid: string) {
  return `aisyuukatsu:rootDirPath:${uid}`;
}

/**
 * Returns true if this uid is allowed to claim the legacy global key.
 * Only the first uid to call this gets the data; subsequent uids start fresh.
 */
function canClaimLegacy(uid: string): boolean {
  const migratedTo = localStorage.getItem(MIGRATION_DONE_KEY);
  return !migratedTo || migratedTo === uid;
}

function markLegacyMigrated(uid: string): void {
  localStorage.setItem(MIGRATION_DONE_KEY, uid);
}

export async function saveRootHandle(
  uid: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  if (isTauri()) {
    const shim = asTauriDirectoryShim(handle);
    if (shim) {
      localStorage.setItem(tauriPathKey(uid), shim._absPath);
    }
    return;
  }
  await set(idbKey(uid), handle);
}

export async function loadRootHandle(
  uid: string,
): Promise<FileSystemDirectoryHandle | undefined> {
  if (isTauri()) {
    let path = localStorage.getItem(tauriPathKey(uid));
    // Migrate from legacy global key (pre-v0.2.9)
    if (!path && canClaimLegacy(uid)) {
      const legacy = localStorage.getItem(LEGACY_TAURI_KEY);
      if (legacy) {
        localStorage.setItem(tauriPathKey(uid), legacy);
        markLegacyMigrated(uid);
        path = legacy;
      }
    }
    if (!path) return undefined;
    const rehydrated = await rehydrateTauriRootDirectory(path);
    if (!rehydrated) {
      localStorage.removeItem(tauriPathKey(uid));
      return undefined;
    }
    return rehydrated;
  }
  let handle = (await get(idbKey(uid))) as
    | FileSystemDirectoryHandle
    | undefined;
  // Migrate from legacy global key (pre-v0.2.9)
  if (!handle && canClaimLegacy(uid)) {
    const legacy = (await get(LEGACY_IDB_KEY)) as
      | FileSystemDirectoryHandle
      | undefined;
    if (legacy) {
      await set(idbKey(uid), legacy);
      markLegacyMigrated(uid);
      handle = legacy;
    }
  }
  return handle;
}

export async function clearRootHandle(uid: string): Promise<void> {
  if (isTauri()) {
    localStorage.removeItem(tauriPathKey(uid));
    return;
  }
  await del(idbKey(uid));
}

export async function ensureReadWritePermission(
  handle: FileSystemDirectoryHandle,
  prompt = false,
): Promise<boolean> {
  // Tauri has OS-level access via capabilities — no runtime permission prompt.
  if (isTauri()) return true;
  const opts = { mode: 'readwrite' as const };
  const status = await handle.queryPermission(opts);
  if (status === 'granted') return true;
  if (!prompt) return false;
  const requested = await handle.requestPermission(opts);
  return requested === 'granted';
}
