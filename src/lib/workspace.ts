import {
  IGNORED_TOP_DIRS,
  SELF_ANALYSIS_DIR,
  SelfAnalysisFile,
  TEMPLATE_DIR,
  TemplateFileEntry,
  Workspace,
  WorkspaceNode,
} from '../types';
import { listSubdirectories } from './fs';

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

/**
 * Recursively scan a directory into `WorkspaceNode`s. Returns all markdown
 * files and sub-folders (any depth). Folders are listed before files, both
 * sorted with ja-locale aware comparison. Hidden entries (dot-prefixed) are
 * skipped by the underlying helpers.
 */
async function scanFolder(
  dir: FileSystemDirectoryHandle,
  parentPath: string[],
): Promise<WorkspaceNode[]> {
  const [files, subDirs] = await Promise.all([
    listMarkdownFileHandles(dir),
    listSubdirectories(dir),
  ]);

  const folderNodes: WorkspaceNode[] = await Promise.all(
    subDirs.map(async (sub) => {
      const name = sub.name.normalize('NFC');
      const path = [...parentPath, name];
      return {
        kind: 'folder' as const,
        name,
        path,
        handle: sub,
        children: await scanFolder(sub, path),
      };
    }),
  );

  const fileNodes: WorkspaceNode[] = files.map((f) => {
    const name = f.name.normalize('NFC');
    return {
      kind: 'file' as const,
      name,
      path: [...parentPath, name],
      handle: f.handle,
    };
  });

  folderNodes.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  fileNodes.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  return [...folderNodes, ...fileNodes];
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

  // Everything at the root except the special/ignored directories becomes a
  // top-level tree node. Nested levels are walked unconditionally.
  const topFolders = top.filter(
    (d) => !IGNORED_TOP_DIRS.has(d.name.normalize('NFC')),
  );

  const tree: WorkspaceNode[] = await Promise.all(
    topFolders.map(async (sub) => {
      const name = sub.name.normalize('NFC');
      const path = [name];
      return {
        kind: 'folder' as const,
        name,
        path,
        handle: sub,
        children: await scanFolder(sub, path),
      };
    }),
  );
  tree.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  const [selfAnalysis, templates] = await Promise.all([
    loadSelfAnalysis(root),
    loadTemplates(root),
  ]);

  return {
    root,
    tree,
    selfAnalysis,
    templates,
  };
}

/**
 * Walk `Workspace.tree` using NFC-normalized path segments and return the
 * matching folder node. Returns `null` if any segment is missing or the
 * terminal node is a file.
 */
export function resolveFolderByPath(
  tree: WorkspaceNode[],
  path: string[],
): Extract<WorkspaceNode, { kind: 'folder' }> | null {
  let nodes: WorkspaceNode[] = tree;
  let current: Extract<WorkspaceNode, { kind: 'folder' }> | null = null;
  for (const raw of path) {
    const seg = raw.normalize('NFC');
    const next = nodes.find(
      (n): n is Extract<WorkspaceNode, { kind: 'folder' }> =>
        n.kind === 'folder' && n.name === seg,
    );
    if (!next) return null;
    current = next;
    nodes = next.children;
  }
  return current;
}

/**
 * Return all folder nodes in the tree (flat list, depth-first). Useful for
 * industry → folder auto-matching: callers can pick the shallowest matching
 * folder.
 */
export function collectFolders(
  tree: WorkspaceNode[],
): Extract<WorkspaceNode, { kind: 'folder' }>[] {
  const out: Extract<WorkspaceNode, { kind: 'folder' }>[] = [];
  const walk = (nodes: WorkspaceNode[]) => {
    for (const n of nodes) {
      if (n.kind === 'folder') {
        out.push(n);
        walk(n.children);
      }
    }
  };
  walk(tree);
  return out;
}
