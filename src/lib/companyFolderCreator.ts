/**
 * Unified "create a company folder" helper used by both the onboarding bulk
 * generator and the manual "企業追加" button.
 *
 * Strategy:
 *  1. Try Firestore (`companyContent/{companyName}`) — populated templates.
 *  2. On miss or error, fall back to the existing empty-template path
 *     (`loadCompanyTemplates` + `materializeTemplate`), preserving the legacy
 *     behaviour. Fallback is a complete superset of the old code path, so
 *     existing users of `_テンプレート/企業名_テンプレート/` keep working.
 */

import {
  createSubdirectory,
  subdirectoryExists,
  writeTextFile,
  fileExists,
} from './fs';
import {
  loadCompanyTemplates,
  materializeTemplate,
  type CompanyTemplateFile,
} from './templateLoader';
import { withTimeout } from './async';
import { validateFileName } from './fileNames';
import { pullCompanyContent } from './companyContentSync';

export type WriteCompanyResult = 'created-populated' | 'created-empty';

/**
 * Create `categoryDir/companyName/` and fill it with Markdown files.
 *
 * Throws if the company subdirectory already exists (caller should check
 * first if they want a "skip silently" behaviour — the onboarding flow does
 * this explicitly).
 */
export async function writeCompanyFolder(
  root: FileSystemDirectoryHandle,
  categoryDir: FileSystemDirectoryHandle,
  companyName: string,
  // Optional: allow the caller to pre-load templates once when generating
  // many companies in a row, to avoid re-reading the user's _テンプレート
  // folder on every single fallback. Onboarding uses this; handleAddCompany
  // does not need to.
  preloadedFallbackTemplates?: CompanyTemplateFile[],
  resumeExisting = false,
): Promise<WriteCompanyResult> {
  if (!resumeExisting && await subdirectoryExists(categoryDir, companyName)) {
    throw new Error('同じ名前の企業フォルダが既に存在します');
  }
  const dir = await createSubdirectory(categoryDir, companyName);

  // ── 1. Populated content from Firestore ────────────────────────────────
  let content: Awaited<ReturnType<typeof pullCompanyContent>> = null;
  try { content=await withTimeout(pullCompanyContent(companyName)); } catch { /* offline uses bundled templates */ }
  if(content){
    for(const [filename,text] of Object.entries(content.files)){
      if(validateFileName(filename))throw new Error('テンプレートのファイル名が不正です。');
      if(!await fileExists(dir,filename))await writeTextFile(dir,filename,text);
    }
    return 'created-populated';
  }

  // ── 2. Fallback: empty templates with placeholder substitution ────────
  const templates =
    preloadedFallbackTemplates ?? (await loadCompanyTemplates(root));
  for (const t of templates) {
    if (!await fileExists(dir, t.name)) await writeTextFile(dir, t.name, materializeTemplate(t, companyName));
  }
  return 'created-empty';
}

/**
 * Load the fallback templates once so bulk callers (e.g. the onboarding
 * generator) can pass them into `writeCompanyFolder` on every iteration.
 */
export async function loadFallbackTemplates(
  root: FileSystemDirectoryHandle,
): Promise<CompanyTemplateFile[]> {
  return loadCompanyTemplates(root);
}
