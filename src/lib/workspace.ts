import {
  Category,
  Company,
  IGNORED_TOP_DIRS,
  INDUSTRY_RESEARCH_FILE,
  SELF_ANALYSIS_DIR,
  STATUS_FILE,
  SelfAnalysisFile,
  TEMPLATE_DIR,
  TemplateFileEntry,
  Workspace,
} from '../types';
import {
  fileExists,
  listSubdirectories,
  readTextFile,
} from './fs';
import { parseStatus } from './statusParser';

/**
 * Find a subdirectory by name with NFC normalization (macOS may store NFD).
 */
async function findSubdirectory(
  root: FileSystemDirectoryHandle,
  targetName: string,
): Promise<FileSystemDirectoryHandle | null> {
  const target = targetName.normalize('NFC');
  for await (const entry of root.values()) {
    if (
      entry.kind === 'directory' &&
      entry.name.normalize('NFC') === target
    ) {
      return entry as FileSystemDirectoryHandle;
    }
  }
  return null;
}

async function listMarkdownFileHandles(
  dir: FileSystemDirectoryHandle,
): Promise<{ name: string; handle: FileSystemFileHandle }[]> {
  const out: { name: string; handle: FileSystemFileHandle }[] = [];
  for await (const entry of dir.values()) {
    if (
      entry.kind === 'file' &&
      entry.name.toLowerCase().endsWith('.md') &&
      !entry.name.startsWith('.')
    ) {
      out.push({ name: entry.name, handle: entry as FileSystemFileHandle });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return out;
}

async function loadCompany(
  category: string,
  dir: FileSystemDirectoryHandle,
): Promise<Company> {
  let status: Company['status'] = null;
  let statusFlow: Company['statusFlow'];

  const files = await listMarkdownFileHandles(dir);
  // 選考フロー・ステータス.md を先頭に
  files.sort((a, b) => {
    if (a.name === STATUS_FILE) return -1;
    if (b.name === STATUS_FILE) return 1;
    return a.name.localeCompare(b.name, 'ja');
  });

  if (await fileExists(dir, STATUS_FILE)) {
    try {
      const raw = await readTextFile(dir, STATUS_FILE);
      const parsed = parseStatus(raw);
      status = parsed.status;
      statusFlow = parsed.flow;
    } catch (e) {
      console.warn(`failed to parse status for ${category}/${dir.name}:`, e);
    }
  }
  return {
    category,
    name: dir.name,
    handle: dir,
    status,
    statusFlow,
    files,
  };
}

async function loadCategory(
  dir: FileSystemDirectoryHandle,
): Promise<Category> {
  const subDirs = await listSubdirectories(dir);
  const companies = await Promise.all(
    subDirs.map((sub) => loadCompany(dir.name, sub)),
  );
  companies.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const industryResearchFile = (await fileExists(dir, INDUSTRY_RESEARCH_FILE))
    ? INDUSTRY_RESEARCH_FILE
    : undefined;

  return {
    name: dir.name,
    handle: dir,
    companies,
    industryResearchFile,
  };
}

async function loadSelfAnalysis(root: FileSystemDirectoryHandle): Promise<{
  dirHandle: FileSystemDirectoryHandle | null;
  files: SelfAnalysisFile[];
}> {
  try {
    const dir = await findSubdirectory(root, SELF_ANALYSIS_DIR);
    if (!dir) return { dirHandle: null, files: [] };
    const files = await listMarkdownFileHandles(dir);
    return { dirHandle: dir, files };
  } catch {
    return { dirHandle: null, files: [] };
  }
}

async function loadTemplates(root: FileSystemDirectoryHandle): Promise<{
  dirHandle: FileSystemDirectoryHandle | null;
  files: TemplateFileEntry[];
}> {
  try {
    const tplDir = await findSubdirectory(root, TEMPLATE_DIR);
    if (!tplDir) return { dirHandle: null, files: [] };
    const out: TemplateFileEntry[] = [];

    // top-level md files in _テンプレート
    const topFiles = await listMarkdownFileHandles(tplDir);
    for (const f of topFiles) {
      out.push({ name: f.name, handle: f.handle });
    }

    // _テンプレート/企業名_テンプレート/*.md
    const subDirs = await listSubdirectories(tplDir);
    for (const sub of subDirs) {
      const files = await listMarkdownFileHandles(sub);
      for (const f of files) {
        out.push({ name: `${sub.name}/${f.name}`, handle: f.handle });
      }
    }

    out.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    return { dirHandle: tplDir, files: out };
  } catch {
    return { dirHandle: null, files: [] };
  }
}

export async function loadWorkspace(
  root: FileSystemDirectoryHandle,
): Promise<Workspace> {
  const top = await listSubdirectories(root);

  // macOS returns directory names in NFD; normalize to NFC for comparison.
  const categoryDirs = top.filter(
    (d) => !IGNORED_TOP_DIRS.has(d.name.normalize('NFC')),
  );

  const categories = await Promise.all(categoryDirs.map(loadCategory));
  categories.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const [selfAnalysis, templates] = await Promise.all([
    loadSelfAnalysis(root),
    loadTemplates(root),
  ]);

  return {
    root,
    categories,
    selfAnalysis,
    templates,
  };
}
