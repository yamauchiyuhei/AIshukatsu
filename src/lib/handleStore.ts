import { get, set, del } from 'idb-keyval';

const KEY = 'aisyuukatsu:rootDirHandle';

export async function saveRootHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await set(KEY, handle);
}

export async function loadRootHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  return (await get(KEY)) as FileSystemDirectoryHandle | undefined;
}

export async function clearRootHandle(): Promise<void> {
  await del(KEY);
}

export async function ensureReadWritePermission(
  handle: FileSystemDirectoryHandle,
  prompt = false,
): Promise<boolean> {
  const opts = { mode: 'readwrite' as const };
  const status = await handle.queryPermission(opts);
  if (status === 'granted') return true;
  if (!prompt) return false;
  const requested = await handle.requestPermission(opts);
  return requested === 'granted';
}
