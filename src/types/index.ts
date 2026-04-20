export const INDUSTRY_RESEARCH_FILE = '業界研究.md';
export const TEMPLATE_DIR = '_テンプレート';
export const COMPANY_TEMPLATE_DIR = '企業名_テンプレート';
export const SELF_ANALYSIS_DIR = '自己分析';
export const ENTRY_SHEET_DIR = 'エントリーシート';

export const IGNORED_TOP_DIRS: ReadonlySet<string> = new Set([
  TEMPLATE_DIR,
  '.claude',
  '.git',
  '.obsidian',
  'node_modules',
]);

/**
 * A single, generic recursive node representing any folder or markdown file
 * inside the workspace tree. There is no special "category" or "company"
 * layer anymore — every non-ignored folder under the root is just a
 * WorkspaceNode, and their children can themselves be WorkspaceNodes to any
 * depth. The "Add company" UI remains a shortcut that drops a template-
 * populated folder at a chosen parent, but structurally that folder is
 * indistinguishable from any other.
 *
 * `path` is the ordered list of folder names from the workspace root down to
 * this node (the node's own name is the last element). All names are stored
 * NFC-normalized so string comparisons work consistently on macOS (which
 * returns NFD from the FS API).
 */
export type WorkspaceNode =
  | {
      kind: 'folder';
      name: string;
      path: string[];
      handle: FileSystemDirectoryHandle;
      children: WorkspaceNode[];
    }
  | {
      kind: 'file';
      name: string;
      path: string[];
      handle: FileSystemFileHandle;
    };

export interface SelfAnalysisFile {
  name: string;
  handle: FileSystemFileHandle;
}

export interface TemplateFileEntry {
  name: string;             // 表示名 (例: "企業名_テンプレート/企業分析.md")
  handle: FileSystemFileHandle;
}

export interface Workspace {
  root: FileSystemDirectoryHandle;
  /**
   * Root-level nodes (excluding `IGNORED_TOP_DIRS`). This is a fully expanded
   * recursive tree — the UI never needs to re-walk the FS to render deeper
   * levels.
   */
  tree: WorkspaceNode[];
  selfAnalysis: { dirHandle: FileSystemDirectoryHandle | null; files: SelfAnalysisFile[] };
  templates: { dirHandle: FileSystemDirectoryHandle | null; files: TemplateFileEntry[] };
}

export type Section = 'companies' | 'industry' | 'self' | 'templates';
