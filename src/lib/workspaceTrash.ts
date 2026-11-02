import { createSubdirectory, moveFileEntry, moveFolderEntry, readTextFile, writeTextFile, fileExists, subdirectoryExists } from './fs';
import { validateFileName } from './fileNames';
const TRASH = '.aishukatsu-trash';
export interface TrashEntry { id: string; path: string[]; kind: 'file' | 'folder'; deletedAt: string; complete?: boolean; }
async function resolve(root: FileSystemDirectoryHandle, path: string[], create = false) {
  let dir = root;
  for (const part of path) {
    if (validateFileName(part)) throw new Error('復元先の名前が不正です。');
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return dir;
}
export async function moveToWorkspaceTrash(root: FileSystemDirectoryHandle, path: string[], kind: 'file' | 'folder') {
  const id = crypto.randomUUID();
  const bin = await createSubdirectory(await createSubdirectory(root, TRASH), id);
  const entry: TrashEntry = { id, path, kind, deletedAt: new Date().toISOString() };
  await writeTextFile(bin, 'manifest.json', JSON.stringify(entry));
  const parent = await resolve(root, path.slice(0, -1));
  const name = path.at(-1)!;
  const copy = async (from:FileSystemDirectoryHandle,to:FileSystemDirectoryHandle,name:string,kind:'file'|'folder'):Promise<void> => {
    if(kind==='file'){const bytes=await(await(await from.getFileHandle(name)).getFile()).arrayBuffer();const stream=await(await to.getFileHandle(name,{create:true})).createWritable();await stream.write(bytes);await stream.close();}
    else{const source=await from.getDirectoryHandle(name);const destination=await createSubdirectory(to,name);for await(const item of source.values())await copy(source,destination,item.name,item.kind==='file'?'file':'folder');}
  };
  await copy(parent,bin,name,kind);
  entry.complete = true;
  await writeTextFile(bin, 'manifest.json', JSON.stringify(entry));
  await parent.removeEntry(name,{recursive:kind==='folder'});
  return entry;
}
export async function listWorkspaceTrash(root: FileSystemDirectoryHandle): Promise<TrashEntry[]> {
  if (!await subdirectoryExists(root, TRASH)) return [];
  const dir = await root.getDirectoryHandle(TRASH); const entries: TrashEntry[] = [];
  for await (const item of dir.values()) {
    if (item.kind !== 'directory') continue;
    try {
      const bin = item as FileSystemDirectoryHandle;
      const entry = JSON.parse(await readTextFile(bin, 'manifest.json')) as TrashEntry;
      if (entry.complete && entry.id === item.name && Array.isArray(entry.path) && entry.path.length && entry.path.every(part => !validateFileName(part)) && (entry.kind === 'file' ? await fileExists(bin, entry.path.at(-1)!) : await subdirectoryExists(bin, entry.path.at(-1)!))) entries.push(entry);
    } catch { /* A failed copy never becomes a valid trash entry. */ }
  }
  return entries.sort((a,b) => b.deletedAt.localeCompare(a.deletedAt));
}
export async function restoreWorkspaceTrash(root: FileSystemDirectoryHandle, entry: TrashEntry) {
  if (!/^[a-zA-Z0-9-]+$/.test(entry.id)) throw new Error('復元情報が不正です。');
  const bin = await (await root.getDirectoryHandle(TRASH)).getDirectoryHandle(entry.id);
  const target = await resolve(root, entry.path.slice(0,-1), true);
  const name = entry.path.at(-1)!;
  if (entry.kind === 'file') await moveFileEntry(bin, name, target);
  else await moveFolderEntry(bin, name, target);
  await (await root.getDirectoryHandle(TRASH)).removeEntry(entry.id, { recursive: true });
}
