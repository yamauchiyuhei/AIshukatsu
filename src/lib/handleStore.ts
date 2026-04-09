import { get, set, del } from 'idb-keyval';
import {
  asTauriDirectoryShim,
  isTauri,
  rehydrateTauriRootDirectory,
} from './tauriFsaShim';

const KEY = 'aisyuukatsu:rootDirHandle';
const TAURI_PATH_KEY = 'aisyuukatsu:rootDirPath';

export async function saveRootHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  if (isTauri()) {
    const shim = asTauriDirectoryShim(handle);
    if (shim) {
      localStorage.setItem(TAURI_PATH_KEY, shim._absPath);
    }
    return;
  }
  await set(KEY, handle);
}

export async function loadRootHandle(): Promise<
  FileSystemDirectoryHandle | undefined
> {
  if (isTauri()) {
    const path = localStorage.getItem(TAURI_PATH_KEY);
    if (!path) return undefined;
    const rehydrated = await rehydrateTauriRootDirectory(path);
    if (!rehydrated) {
      // Path vanished since last run — forget it.
      localStorage.removeItem(TAURI_PATH_KEY);
      return undefined;
    }
    return rehydrated;
  }
  return (await get(KEY)) as FileSystemDirectoryHandle | undefined;
}

export async function clearRootHandle(): Promise<void> {
  if (isTauri()) {
    localStorage.removeItem(TAURI_PATH_KEY);
    return;
  }
  await del(KEY);
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
