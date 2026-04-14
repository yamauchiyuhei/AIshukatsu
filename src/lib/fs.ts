// File System Access API helpers

import { isTauri, pickTauriRootDirectory } from './tauriFsaShim';

/**
 * Options for {@link pickRootDirectory}. `startIn` follows the
 * File System Access API well-known directories: 'desktop', 'documents',
 * 'downloads', etc. Browsers that don't understand the key simply ignore it.
 */
export interface PickRootDirectoryOptions {
  startIn?:
    | 'desktop'
    | 'documents'
    | 'downloads'
    | 'music'
    | 'pictures'
    | 'videos';
}

export async function pickRootDirectory(
  options: PickRootDirectoryOptions = {},
): Promise<FileSystemDirectoryHandle> {
  if (isTauri()) {
    // Tauri desktop: use the native OS directory picker and wrap the result
    // in a FSA-compatible shim.
    return await pickTauriRootDirectory();
  }
  // `startIn` is optional – we only pass it through when provided so that the
  // default (browser-remembered last location) keeps working for existing
  // users that come through the classic WelcomeScreen.
  return await window.showDirectoryPicker({
    mode: 'readwrite',
    ...(options.startIn ? { startIn: options.startIn } : {}),
  });
}

export async function readTextFile(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<string> {
  const fileHandle = await dir.getFileHandle(name);
  const file = await fileHandle.getFile();
  return await file.text();
}

export async function writeTextFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  content: string,
): Promise<void> {
  const fileHandle = await dir.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function fileExists(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

export async function listSubdirectories(
  root: FileSystemDirectoryHandle,
): Promise<FileSystemDirectoryHandle[]> {
  const out: FileSystemDirectoryHandle[] = [];
  for await (const entry of root.values()) {
    if (entry.kind === 'directory' && !entry.name.startsWith('.')) {
      out.push(entry as FileSystemDirectoryHandle);
    }
  }
  return out;
}

/**
 * List markdown files in a directory (used by the template / self-analysis
 * loaders, which are still markdown-only by design).
 */
export async function listMarkdownFiles(
  dir: FileSystemDirectoryHandle,
): Promise<string[]> {
  const out: string[] = [];
  for await (const entry of dir.values()) {
    if (
      entry.kind === 'file' &&
      entry.name.toLowerCase().endsWith('.md') &&
      !entry.name.startsWith('.')
    ) {
      out.push(entry.name);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, 'ja'));
}

/**
 * List every visible (non-dot-prefixed) file in `dir`, regardless of
 * extension. Used by the workspace scanner now that the tree renders
 * images, PDFs, docx, etc. in addition to markdown.
 */
export async function listAllFiles(
  dir: FileSystemDirectoryHandle,
): Promise<string[]> {
  const out: string[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind === 'file' && !entry.name.startsWith('.')) {
      out.push(entry.name);
    }
  }
  return out.sort((a, b) => a.localeCompare(b, 'ja'));
}

export async function createSubdirectory(
  root: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  return await root.getDirectoryHandle(name, { create: true });
}

export async function subdirectoryExists(
  root: FileSystemDirectoryHandle,
  name: string,
): Promise<boolean> {
  try {
    await root.getDirectoryHandle(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a file name ends with .md. Leaves other extensions alone.
 */
export function ensureMdExtension(name: string): string {
  const trimmed = name.trim();
  if (/\.[a-z0-9]+$/i.test(trimmed)) return trimmed;
  return `${trimmed}.md`;
}

/**
 * Create an empty markdown file inside `dir`. Throws if a file with the same
 * name already exists (we refuse to overwrite silently).
 */
export async function createEmptyFile(
  dir: FileSystemDirectoryHandle,
  name: string,
  initialContent = '',
): Promise<FileSystemFileHandle> {
  if (await fileExists(dir, name)) {
    throw new Error(`${name} は既に存在します`);
  }
  const handle = await dir.getFileHandle(name, { create: true });
  if (initialContent) {
    const writable = await handle.createWritable();
    await writable.write(initialContent);
    await writable.close();
  }
  return handle;
}

/**
 * Permanently delete a file from `parent`. File System Access API's
 * `removeEntry` bypasses the OS trash, so callers should confirm with the
 * user first.
 */
export async function deleteFileEntry(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  await parent.removeEntry(name);
}

/**
 * Permanently delete a folder (and everything inside it) from `parent`.
 * Uses the `recursive: true` option of `removeEntry` so non-empty folders
 * can be removed in one call.
 */
export async function deleteFolderEntry(
  parent: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  await parent.removeEntry(name, { recursive: true });
}

/**
 * Move a file from one directory to another by copy-then-delete.
 */
export async function moveFileEntry(
  sourceParent: FileSystemDirectoryHandle,
  fileName: string,
  destParent: FileSystemDirectoryHandle,
): Promise<void> {
  if (await fileExists(destParent, fileName)) {
    throw new Error(`移動先に「${fileName}」が既に存在します`);
  }
  const srcHandle = await sourceParent.getFileHandle(fileName);
  const file = await srcHandle.getFile();
  const content = await file.arrayBuffer();
  const destHandle = await destParent.getFileHandle(fileName, { create: true });
  const w = await destHandle.createWritable();
  await w.write(content);
  await w.close();
  await sourceParent.removeEntry(fileName);
}

/**
 * Move a folder from one directory to another by recursive copy-then-delete.
 */
export async function moveFolderEntry(
  sourceParent: FileSystemDirectoryHandle,
  folderName: string,
  destParent: FileSystemDirectoryHandle,
): Promise<void> {
  if (await subdirectoryExists(destParent, folderName)) {
    throw new Error(`移動先に「${folderName}」が既に存在します`);
  }
  const src = await sourceParent.getDirectoryHandle(folderName);
  const dst = await destParent.getDirectoryHandle(folderName, { create: true });

  const copyDir = async (
    from: FileSystemDirectoryHandle,
    to: FileSystemDirectoryHandle,
  ) => {
    for await (const entry of from.values()) {
      if (entry.kind === 'file') {
        const fh = await from.getFileHandle(entry.name);
        const file = await fh.getFile();
        const content = await file.arrayBuffer();
        const dest = await to.getFileHandle(entry.name, { create: true });
        const w = await dest.createWritable();
        await w.write(content);
        await w.close();
      } else {
        const subSrc = await from.getDirectoryHandle(entry.name);
        const subDst = await to.getDirectoryHandle(entry.name, { create: true });
        await copyDir(subSrc, subDst);
      }
    }
  };
  await copyDir(src, dst);
  await sourceParent.removeEntry(folderName, { recursive: true });
}

/**
 * Rename a file by copy-then-delete. File System Access API has a `move`
 * method but its availability varies by browser; this fallback works in
 * every Chromium-based browser we care about.
 *
 * Returns the new FileSystemFileHandle.
 */
export async function renameFileEntry(
  parent: FileSystemDirectoryHandle,
  oldName: string,
  newName: string,
): Promise<FileSystemFileHandle> {
  if (oldName === newName) {
    return parent.getFileHandle(oldName);
  }
  if (await fileExists(parent, newName)) {
    throw new Error(`${newName} は既に存在します`);
  }
  // Read old content
  const oldHandle = await parent.getFileHandle(oldName);
  const oldFile = await oldHandle.getFile();
  const content = await oldFile.arrayBuffer();
  // Create new file with the same content
  const newHandle = await parent.getFileHandle(newName, { create: true });
  const writable = await newHandle.createWritable();
  await writable.write(content);
  await writable.close();
  // Delete old file
  await parent.removeEntry(oldName);
  return newHandle;
}

/**
 * Rename a folder by recursively copying its contents then deleting the
 * original. Works in every Chromium-based browser. Throws if the new name
 * already exists.
 */
export async function renameFolderEntry(
  parent: FileSystemDirectoryHandle,
  oldName: string,
  newName: string,
): Promise<FileSystemDirectoryHandle> {
  if (oldName === newName) {
    return parent.getDirectoryHandle(oldName);
  }
  if (await subdirectoryExists(parent, newName)) {
    throw new Error(`${newName} は既に存在します`);
  }
  const src = await parent.getDirectoryHandle(oldName);
  const dst = await parent.getDirectoryHandle(newName, { create: true });

  const copyDir = async (
    from: FileSystemDirectoryHandle,
    to: FileSystemDirectoryHandle,
  ) => {
    for await (const entry of from.values()) {
      if (entry.kind === 'file') {
        const src = await from.getFileHandle(entry.name);
        const file = await src.getFile();
        const content = await file.arrayBuffer();
        const dest = await to.getFileHandle(entry.name, { create: true });
        const w = await dest.createWritable();
        await w.write(content);
        await w.close();
      } else {
        const subSrc = await from.getDirectoryHandle(entry.name);
        const subDst = await to.getDirectoryHandle(entry.name, { create: true });
        await copyDir(subSrc, subDst);
      }
    }
  };
  await copyDir(src, dst);
  await parent.removeEntry(oldName, { recursive: true });
  return dst;
}
