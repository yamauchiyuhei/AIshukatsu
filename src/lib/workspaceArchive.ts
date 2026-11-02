import { zip, unzip, strToU8, strFromU8 } from 'fflate';
import { validateFileName } from './fileNames';
import { isSecretColumn } from './cellValues';
import { createSubdirectory, fileExists, writeTextFile } from './fs';
import { downloadBlob } from './download';
import { flushAllSaves } from './saveQueue';
import type { Workbook } from '../spreadsheet/types/sheet';

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_FILES = 15000;
const OMIT = new Set(['.git', 'node_modules', '.DS_Store', 'Thumbs.db', '.aishukatsu-trash']);
export function withoutCredentials(workbook: Workbook): Workbook {
  return { ...workbook, sheets: workbook.sheets.map(sheet => {
    const secret = new Set(sheet.columns.filter(isSecretColumn).map(column => column.id));
    return { ...sheet, rows: sheet.rows.map(row => ({ ...row, cells: Object.fromEntries(Object.entries(row.cells).filter(([id]) => !secret.has(id))) })) };
  }) };
}
function sanitizeSidecar(text: string) {
  const sidecar = JSON.parse(text);
  return JSON.stringify({ ...sidecar, secrets: [], extraSheets: withoutCredentials({ version: 2, activeSheetId: '', sheets: sidecar.extraSheets ?? [] }).sheets }, null, 2);
}
export async function createWorkspaceArchive(root: FileSystemDirectoryHandle, includeCredentials = false, progress?: (message: string) => void) {
  await flushAllSaves();
  const files: Record<string, Uint8Array> = {};
  let size = 0;
  const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
    for await (const entry of dir.values()) {
      if (OMIT.has(entry.name) || (entry.name.startsWith('.') && entry.name !== '.エントリー一覧.meta.json') || entry.name.startsWith('.aishukatsu-write-') || /\.(pending|recovery)\.json$/.test(entry.name)) continue;
      const path = prefix + entry.name;
      if (entry.kind === 'directory') { files[path+'/']=new Uint8Array(); await walk(entry as FileSystemDirectoryHandle, path + '/'); }
      else {
        progress?.(`バックアップ中：${path}`);
        const file = await (entry as FileSystemFileHandle).getFile();
        let bytes = new Uint8Array(await file.arrayBuffer());
        if (!includeCredentials && entry.name === '.エントリー一覧.meta.json') bytes = strToU8(sanitizeSidecar(strFromU8(bytes)));
        size += bytes.byteLength;
        if (size > MAX_BYTES || Object.keys(files).length >= MAX_FILES) throw new Error('容量が大きいため、この操作ではバックアップできません。OSでフォルダをコピーしてください。');
        files[path] = bytes;
      }
    }
  };
  await walk(root, '');
  files['aishukatsu-backup.json'] = strToU8(JSON.stringify({ version: 1, createdAt: new Date().toISOString(), credentialsIncluded: includeCredentials, files: Object.keys(files) }));
  const bytes = await new Promise<Uint8Array>((resolve, reject) => zip(files, { level: 3 }, (error, result) => error ? reject(error) : resolve(result)));
  return new Blob([new Uint8Array(bytes)], { type: 'application/zip' });
}
export async function readWorkspaceArchive(file: File) {
  if (file.size > MAX_BYTES) throw new Error('バックアップは256MB以内のZIPを選択してください。');
  let size = 0, count = 0;
  const archive = await new Promise<Record<string, Uint8Array>>(async (resolve, reject) => {
    try {
      unzip(new Uint8Array(await file.arrayBuffer()), { filter: entry => {
        size += entry.originalSize; count++;
        return size <= MAX_BYTES && count <= MAX_FILES;
      } }, (error, result) => error ? reject(error) : resolve(result));
    } catch (error) { reject(error); }
  });
  if (size > MAX_BYTES || count > MAX_FILES) throw new Error('展開後の容量またはファイル数が上限を超えています。');
  for (const path of Object.keys(archive)) {
    const parts = path.replace(/\/$/, '').split('/');
    if (path.startsWith('/') || parts.some(part => OMIT.has(part) || (part !== '.エントリー一覧.meta.json' && validateFileName(part)))) throw new Error('安全でないファイル名を含むZIPのため、復元を停止しました。');
  }
  return archive;
}
export async function restoreWorkspaceArchive(files: Record<string, Uint8Array>, target: FileSystemDirectoryHandle, progress?: (message: string) => void) {
  let created = 0, skipped = 0;
  for (const [path, bytes] of Object.entries(files)) {
    if (path === 'aishukatsu-backup.json') continue;
    const segments=path.replace(/\/$/,'').split('/');
    if(path.startsWith('/')||segments.some(part=>OMIT.has(part)||(part!=='.エントリー一覧.meta.json'&&validateFileName(part))))throw new Error('復元先のパスが不正です。');
    if(path.endsWith('/')){let dir=target;for(const part of segments)dir=await createSubdirectory(dir,part);continue;}
    const parts = path.split('/'); const name = parts.pop()!;
    let dir = target;
    for (const part of parts) dir = await createSubdirectory(dir, part);
    if (await fileExists(dir, name)) { skipped++; continue; }
    progress?.(`復元中：${path}`);
    const handle = await dir.getFileHandle(name, { create: true });
    const stream = await handle.createWritable(); await stream.write(new Uint8Array(bytes)); await stream.close(); created++;
  }
  return { created, skipped };
}
export async function downloadWorkspaceArchive(root: FileSystemDirectoryHandle, includeCredentials: boolean, progress?: (message: string) => void) {
  const blob = await createWorkspaceArchive(root, includeCredentials, progress);
  return downloadBlob(blob, `AI就活-フォルダ全体-${new Date().toLocaleDateString('en-CA')}.zip`);
}
