export const STATUS_VALUES = [
  '未応募',
  'エントリー済',
  'ES提出済',
  'GD',
  'Webテスト',
  '1次面接',
  '2次面接',
  '最終面接',
  '内定',
  'お祈り',
] as const;

export type Status = (typeof STATUS_VALUES)[number];

export const STATUS_FILE = '選考フロー・ステータス.md';
export const INDUSTRY_RESEARCH_FILE = '業界研究.md';
export const TEMPLATE_DIR = '_テンプレート';
export const COMPANY_TEMPLATE_DIR = '企業名_テンプレート';
export const SELF_ANALYSIS_DIR = '自己分析';

export const IGNORED_TOP_DIRS: ReadonlySet<string> = new Set([
  TEMPLATE_DIR,
  SELF_ANALYSIS_DIR,
  '.claude',
  '.git',
  '.obsidian',
  'node_modules',
]);

export interface CompanyFile {
  name: string;
  handle: FileSystemFileHandle;
}

export interface Company {
  category: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  status: Status | null;
  statusFlow?: Status[];
  files: CompanyFile[];
}

export interface Category {
  name: string;
  handle: FileSystemDirectoryHandle;
  companies: Company[];
  industryResearchFile?: string;
}

export interface SelfAnalysisFile {
  name: string;
  handle: FileSystemFileHandle;
}

export interface TemplateFileEntry {
  name: string;             // 表示名 (例: "企業名_テンプレート/選考フロー・ステータス.md")
  handle: FileSystemFileHandle;
}

export interface Workspace {
  root: FileSystemDirectoryHandle;
  categories: Category[];
  selfAnalysis: { dirHandle: FileSystemDirectoryHandle | null; files: SelfAnalysisFile[] };
  templates: { dirHandle: FileSystemDirectoryHandle | null; files: TemplateFileEntry[] };
}

export type Section = 'companies' | 'industry' | 'self' | 'templates';
