/**
 * Cross-document "vocabulary" search (語彙検索) over the user's own workspace
 * files. v1 scope:
 *   - CONTENT is searched for Markdown / plain-text files only (the kinds we
 *     can cheaply read as text). Front-matter is stripped from Markdown so YAML
 *     keys don't pollute matches.
 *   - FILE NAMES are searched for every file (including PDFs / images / docx),
 *     so "find that PDF by name" works even when we can't read its contents.
 *
 * Everything is in-memory and library-free, mirroring the app's existing
 * hand-rolled search style (normalize + substring, capped results). The index
 * is built lazily and lives only for the session; see useDocumentSearch.
 */
import matter from 'gray-matter';
import { getFileKind } from './fileKind';
import { buildSnippet, matchRank, normalize } from './textMatch';
import type { Workspace, WorkspaceNode } from '../types';

/** A file that can be opened from a search result. */
export interface SearchableFile {
  key: string;
  label: string;
  breadcrumb: string[];
  handle: FileSystemFileHandle;
  /** Whether we can read this file's text content (markdown / plain text). */
  readable: boolean;
}

/** A built index entry: a searchable file plus its (possibly empty) body text. */
export interface IndexedFile extends SearchableFile {
  body: string;
}

export interface SearchResult {
  key: string;
  label: string;
  breadcrumb: string[];
  handle: FileSystemFileHandle;
  /** Lower is better. 0–2 = name match, 3 = content-only match. */
  score: number;
  /** Whether the match came from the file body (vs the name only). */
  contentMatch: boolean;
  snippet: string;
}

export const MAX_RESULTS = 50;

/** A file kind is text-readable iff we can extract a meaningful string body. */
function isReadable(name: string): boolean {
  const kind = getFileKind(name);
  return kind === 'markdown' || kind === 'text';
}

/**
 * Flatten the workspace into the set of files that participate in search:
 * the main tree (any depth), plus the 自己分析 and _テンプレート special
 * folders. Keys match exactly what {@link FileTree} uses so opening a result
 * activates the same tab.
 */
export function collectSearchableFiles(workspace: Workspace): SearchableFile[] {
  const out: SearchableFile[] = [];

  const walk = (nodes: WorkspaceNode[]) => {
    for (const n of nodes) {
      if (n.kind === 'file') {
        out.push({
          key: `co:${n.path.join('/')}`,
          label: n.name,
          breadcrumb: n.path.slice(0, -1),
          handle: n.handle,
          readable: isReadable(n.name),
        });
      } else {
        walk(n.children);
      }
    }
  };
  walk(workspace.tree);

  for (const f of workspace.selfAnalysis.files) {
    out.push({
      key: `self/${f.name}`,
      label: f.name,
      breadcrumb: ['自己分析'],
      handle: f.handle,
      readable: isReadable(f.name),
    });
  }
  for (const f of workspace.templates.files) {
    out.push({
      key: `tpl/${f.name}`,
      label: f.name,
      breadcrumb: ['_テンプレート'],
      handle: f.handle,
      readable: isReadable(f.name),
    });
  }

  return out;
}

/** Read a file's searchable body. Markdown has its front-matter stripped. */
async function readBody(file: SearchableFile): Promise<string> {
  if (!file.readable) return '';
  try {
    const text = await (await file.handle.getFile()).text();
    if (getFileKind(file.label) === 'markdown') {
      try {
        return matter(text).content;
      } catch {
        return text; // malformed front-matter → search the raw text
      }
    }
    return text;
  } catch {
    return ''; // unreadable (permissions / deleted) → name-only
  }
}

/** Map `files` to {@link IndexedFile}s, reading bodies with bounded concurrency. */
export async function buildIndex(
  files: SearchableFile[],
  concurrency = 12,
): Promise<IndexedFile[]> {
  const out: IndexedFile[] = new Array(files.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < files.length) {
      const i = cursor++;
      const file = files[i];
      out[i] = { ...file, body: await readBody(file) };
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, worker),
  );
  return out;
}

/**
 * Rank `index` against `query`. Name matches (score 0–2) outrank content-only
 * matches (score 3); ties break on ja-locale name order. Capped at
 * {@link MAX_RESULTS}.
 */
export function searchIndex(query: string, index: IndexedFile[]): SearchResult[] {
  const q = query.trim();
  if (!q) return [];
  const nq = normalize(q);
  if (!nq) return [];

  const results: SearchResult[] = [];
  for (const file of index) {
    const nameRank = matchRank(q, file.label); // 0..2 or -1
    const contentHit =
      file.readable && file.body !== '' && normalize(file.body).includes(nq);

    if (nameRank < 0 && !contentHit) continue;

    const score = nameRank >= 0 ? nameRank : 3;
    results.push({
      key: file.key,
      label: file.label,
      breadcrumb: file.breadcrumb,
      handle: file.handle,
      score,
      contentMatch: contentHit && nameRank < 0,
      snippet: contentHit ? buildSnippet(file.body, q) : '',
    });
  }

  results.sort(
    (a, b) => a.score - b.score || a.label.localeCompare(b.label, 'ja'),
  );
  return results.slice(0, MAX_RESULTS);
}
