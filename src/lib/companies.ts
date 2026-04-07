import { Company, STATUS_FILE } from '../types';
import {
  createSubdirectory,
  fileExists,
  listSubdirectories,
  readTextFile,
  subdirectoryExists,
  writeTextFile,
} from './fs';
import { parseStatusFile, serializeStatusFile } from './frontmatter';
import { buildDefaultTemplates } from './templates';

export async function loadCompanies(
  root: FileSystemDirectoryHandle,
): Promise<Company[]> {
  const dirs = await listSubdirectories(root);
  const out: Company[] = [];
  for (const dir of dirs) {
    let fm;
    if (await fileExists(dir, STATUS_FILE)) {
      const raw = await readTextFile(dir, STATUS_FILE);
      fm = parseStatusFile(raw, dir.name).data;
    } else {
      const today = new Date().toISOString().slice(0, 10);
      fm = {
        status: '未エントリー' as const,
        company_name: dir.name,
        created_at: today,
        updated_at: today,
      };
    }
    out.push({ folderName: dir.name, handle: dir, frontmatter: fm });
  }
  out.sort((a, b) => b.frontmatter.updated_at.localeCompare(a.frontmatter.updated_at));
  return out;
}

const FORBIDDEN = /[\\/:*?"<>|]/;

export function validateCompanyName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return '企業名を入力してください';
  if (FORBIDDEN.test(trimmed)) return '使用できない文字が含まれています ( \\ / : * ? " < > | )';
  if (trimmed.length > 80) return '企業名が長すぎます';
  return null;
}

export async function createCompany(
  root: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> {
  const trimmed = name.trim();
  if (await subdirectoryExists(root, trimmed)) {
    throw new Error('同じ名前の企業フォルダが既に存在します');
  }
  const dir = await createSubdirectory(root, trimmed);
  const templates = buildDefaultTemplates(trimmed);
  for (const t of templates) {
    await writeTextFile(dir, t.name, t.content);
  }
  return dir;
}

export async function updateStatusFileBody(
  companyHandle: FileSystemDirectoryHandle,
  newBody: string,
): Promise<void> {
  let raw = '';
  if (await fileExists(companyHandle, STATUS_FILE)) {
    raw = await readTextFile(companyHandle, STATUS_FILE);
  }
  const parsed = parseStatusFile(raw, companyHandle.name);
  const today = new Date().toISOString().slice(0, 10);
  const newFm = { ...parsed.data, updated_at: today };
  const serialized = serializeStatusFile(newFm, newBody);
  await writeTextFile(companyHandle, STATUS_FILE, serialized);
}

export async function readMarkdownBody(
  dir: FileSystemDirectoryHandle,
  fileName: string,
): Promise<{ body: string; isStatus: boolean }> {
  const raw = await readTextFile(dir, fileName);
  if (fileName === STATUS_FILE) {
    const parsed = parseStatusFile(raw, dir.name);
    return { body: parsed.body, isStatus: true };
  }
  return { body: raw, isStatus: false };
}

export async function writeMarkdownBody(
  dir: FileSystemDirectoryHandle,
  fileName: string,
  body: string,
): Promise<void> {
  if (fileName === STATUS_FILE) {
    await updateStatusFileBody(dir, body);
  } else {
    await writeTextFile(dir, fileName, body);
  }
}
