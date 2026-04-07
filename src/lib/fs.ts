// File System Access API helpers

export async function pickRootDirectory(): Promise<FileSystemDirectoryHandle> {
  return await window.showDirectoryPicker({ mode: 'readwrite' });
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
