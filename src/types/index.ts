export const SELECTION_STATUSES = [
  '未エントリー',
  'ES提出済',
  '一次面接',
  '二次面接',
  '最終面接',
  '内定',
  'お祈り',
] as const;

export type SelectionStatus = (typeof SELECTION_STATUSES)[number];

export interface CompanyFrontMatter {
  status: SelectionStatus;
  next_action_date?: string; // YYYY-MM-DD
  next_action_label?: string;
  company_name: string;
  created_at: string;
  updated_at: string;
}

export interface Company {
  folderName: string;
  handle: FileSystemDirectoryHandle;
  frontmatter: CompanyFrontMatter;
}

export const STATUS_FILE = '選考状況.md';
