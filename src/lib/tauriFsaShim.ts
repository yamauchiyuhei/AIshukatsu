import { trackFileOperation } from './saveQueue';
// Tauri FSA shim
//
// Polyfills the subset of the File System Access API the app uses, backed by
// `@tauri-apps/plugin-fs` (absolute-path based). This lets the rest of the
// codebase keep calling `dir.getFileHandle(...)`, `handle.getFile()`,
// `handle.createWritable()`, etc. without knowing whether it runs in a
// Chromium browser or inside a Tauri webview.
//
// Only the surface the app touches is implemented — this is NOT a complete
// FSA implementation.

import {
  readTextFile as tauriReadTextFile,
  readFile as tauriReadFile,
  writeTextFile as tauriWriteTextFile,
  writeFile as tauriWriteFile,
  readDir as tauriReadDir,
  mkdir as tauriMkdir,
  remove as tauriRemove,
  exists as tauriExists,
  stat as tauriStat,
} from '@tauri-apps/plugin-fs';

function joinPath(parent: string, child: string): string {
  if (!child || child === '.' || child === '..' || /[\\/]/.test(child)) throw new DOMException('ファイル名が不正です', 'TypeMismatchError');
  const sep = parent.includes('\\') && !parent.includes('/') ? '\\' : '/';
  if (parent.endsWith('/') || parent.endsWith('\\')) {
    return parent + child;
  }
  return parent + sep + child;
}

function basename(p: string): string {
  const norm = p.replace(/\\/g, '/');
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? norm : norm.slice(idx + 1);
}

/**
 * Minimal writable stream that buffers bytes and flushes them on close().
 * This matches the usage pattern we see in the app:
 *
 *     const w = await fileHandle.createWritable();
 *     await w.write(content);  // string or ArrayBuffer
 *     await w.close();
 */
class TauriWritableStream {
  private chunks: Uint8Array[] = [];
  private closed = false;
  constructor(private readonly absPath: string) {}

  async write(data: string | ArrayBuffer | ArrayBufferView | Blob): Promise<void> {
    if (this.closed) throw new Error('writable already closed');
    let bytes: Uint8Array;
    if (typeof data === 'string') {
      bytes = new TextEncoder().encode(data);
    } else if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (ArrayBuffer.isView(data)) {
      bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (data instanceof Blob) {
      bytes = new Uint8Array(await data.arrayBuffer());
    } else {
      throw new Error('unsupported chunk type for TauriWritableStream.write');
    }
    this.chunks.push(bytes);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const total = this.chunks.reduce((n, c) => n + c.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of this.chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    await trackFileOperation(()=>invoke('atomic_write_workspace_file', { path: this.absPath, bytes: Array.from(merged) }));
  }

  async abort(): Promise<void> {
    this.closed = true;
    this.chunks = [];
  }
}

/**
 * Pretends to be a `File` object. The app calls `.text()`, `.arrayBuffer()`,
 * and reads `.name` / `.size` / `.type` on these.
 */

export class TauriFileSystemFileHandle {
  readonly kind = 'file' as const;
  readonly name: string;
  readonly _absPath: string;

  constructor(absPath: string, name?: string) {
    this._absPath = absPath;
    this.name = name ?? basename(absPath);
  }

  async getFile(): Promise<File> {
    const metadata=await tauriStat(this._absPath);
    if(metadata.size>256*1024*1024)throw new Error('256MBを超えるファイルはOSのアプリで開いてください。');
    const bytes=await tauriReadFile(this._absPath);
    const copy = new Uint8Array(bytes.byteLength); copy.set(bytes);
    return new File([copy], this.name, { lastModified: metadata.mtime?.getTime() ?? 0 });
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    return new TauriWritableStream(this._absPath) as unknown as FileSystemWritableFileStream;
  }

  async queryPermission(): Promise<PermissionState> {
    return 'granted';
  }
  async requestPermission(): Promise<PermissionState> {
    return 'granted';
  }

  async isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return (
      (other as unknown as TauriFileSystemFileHandle)?._absPath === this._absPath
    );
  }
}

export class TauriFileSystemDirectoryHandle {
  readonly kind = 'directory' as const;
  readonly name: string;
  readonly _absPath: string;

  constructor(absPath: string, name?: string) {
    this._absPath = absPath;
    this.name = name ?? basename(absPath);
  }

  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileSystemFileHandle> {
    const full = joinPath(this._absPath, name);
    const present = await tauriExists(full);
    if (!present) {
      if (!options?.create) {
        throw new DOMException(`File not found: ${name}`, 'NotFoundError');
      }
      // Create an empty file so subsequent reads succeed.
      await tauriWriteFile(full, new Uint8Array());
    }
    const meta=await tauriStat(full);
    if (!meta.isFile || meta.isSymlink) throw new DOMException('通常のファイルではありません','TypeMismatchError');
    return new TauriFileSystemFileHandle(full, name) as unknown as FileSystemFileHandle;
  }

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileSystemDirectoryHandle> {
    const full = joinPath(this._absPath, name);
    const present = await tauriExists(full);
    if (!present) {
      if (!options?.create) {
        throw new DOMException(`Directory not found: ${name}`, 'NotFoundError');
      }
      await tauriMkdir(full, { recursive: true });
    }
    const meta=await tauriStat(full);
    if (!meta.isDirectory || meta.isSymlink) throw new DOMException('通常のフォルダではありません','TypeMismatchError');
    return new TauriFileSystemDirectoryHandle(full, name) as unknown as FileSystemDirectoryHandle;
  }

  async removeEntry(
    name: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    const full = joinPath(this._absPath, name);
    await tauriRemove(full, { recursive: options?.recursive ?? false });
  }

  async *values(): AsyncIterableIterator<
    FileSystemFileHandle | FileSystemDirectoryHandle
  > {
    const entries = await tauriReadDir(this._absPath);
    for (const entry of entries) {
      const full = joinPath(this._absPath, entry.name);
      if (entry.isSymlink) continue;
      if (entry.isDirectory) {
        yield new TauriFileSystemDirectoryHandle(
          full,
          entry.name,
        ) as unknown as FileSystemDirectoryHandle;
      } else if (entry.isFile) {
        yield new TauriFileSystemFileHandle(
          full,
          entry.name,
        ) as unknown as FileSystemFileHandle;
      }
      // Symlinks are skipped — the app doesn't need them.
    }
  }

  async *keys(): AsyncIterableIterator<string> {
    for await (const e of this.values()) {
      yield e.name;
    }
  }

  async *entries(): AsyncIterableIterator<
    [string, FileSystemFileHandle | FileSystemDirectoryHandle]
  > {
    for await (const e of this.values()) {
      yield [e.name, e];
    }
  }

  async queryPermission(): Promise<PermissionState> {
    return 'granted';
  }
  async requestPermission(): Promise<PermissionState> {
    return 'granted';
  }

  async isSameEntry(other: FileSystemHandle): Promise<boolean> {
    return (
      (other as unknown as TauriFileSystemDirectoryHandle)?._absPath ===
      this._absPath
    );
  }
}

// ---------------------------------------------------------------------------
// Environment detection + factories

export { isTauri } from '@tauri-apps/api/core';

/**
 * Open the Tauri native directory picker and return a FSA-compatible shim.
 */
export async function pickTauriRootDirectory(): Promise<FileSystemDirectoryHandle> {
  const { invoke } = await import('@tauri-apps/api/core');
  const picked = await invoke<string | null>('pick_workspace_directory', { create: false });
  if (!picked) throw new DOMException('User cancelled directory picker', 'AbortError');
  return new TauriFileSystemDirectoryHandle(
    picked,
  ) as unknown as FileSystemDirectoryHandle;
}

/**
 * Re-hydrate a directory shim from a previously persisted absolute path.
 * Returns `null` if the path no longer exists on disk.
 */
export async function rehydrateTauriRootDirectory(
  absPath: string,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    if (!await invoke<boolean>('restore_workspace_permission', { path: absPath })) return null;
    const present = await tauriExists(absPath);
    if (!present) return null;
  } catch {
    return null;
  }
  return new TauriFileSystemDirectoryHandle(
    absPath,
  ) as unknown as FileSystemDirectoryHandle;
}

/**
 * Narrow a FileSystemDirectoryHandle to a Tauri shim, if it is one.
 */
export function asTauriDirectoryShim(
  handle: FileSystemDirectoryHandle,
): TauriFileSystemDirectoryHandle | null {
  if (handle instanceof TauriFileSystemDirectoryHandle) return handle;
  // Cross-realm check — instanceof can fail if class identity isn't shared.
  if ((handle as unknown as { _absPath?: unknown })._absPath !== undefined) {
    return handle as unknown as TauriFileSystemDirectoryHandle;
  }
  return null;
}
