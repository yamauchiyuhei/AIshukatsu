export type ColumnType =
  | 'text'
  | 'longtext'
  | 'date'
  | 'datetime'
  | 'select'
  | 'rating'
  | 'url'
  | 'checkbox'
  | 'password';

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  options?: string[];
  width?: number;
  role?: 'status' | 'company' | 'category' | null;
}

export type CellValue = string | number | boolean | null;

export interface Row {
  id: string;
  cells: Record<string, CellValue>;
  pinned?: boolean;
}

/** A single sheet (tab) inside the workbook. */
export interface Sheet {
  id: string;
  name: string;
  color?: string; // tailwind color suffix e.g. 'indigo'
  columns: Column[];
  rows: Row[];
}

/** Top level workbook persisted in IndexedDB. */
export interface Workbook {
  version: 2;
  sheets: Sheet[];
  activeSheetId: string;
}

/** Single-cell selection coordinate. */
export interface CellCoord {
  rowId: string;
  colId: string;
}

/** Optional 2D selection range (anchor + focus, both inclusive). */
export interface SelectionRange {
  start: CellCoord;
  end: CellCoord;
}

export interface SavedView {
  id: string;
  name: string;
  sheetId: string;
  search: string;
  industry: string | null;
  status: string | null;
  sortColumnId: string | null;
  sortDir: 'asc' | 'desc';
  builtin?: boolean;
}

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

export type StatusValue = (typeof STATUS_VALUES)[number];

export const COMPLETED_STATUSES: ReadonlySet<string> = new Set(['内定']);
export const REJECTED_STATUSES: ReadonlySet<string> = new Set(['お祈り']);

/** Per-status accent color (used by Kanban header stripe + badges). */
export const STATUS_ACCENT: Record<StatusValue, string> = {
  '未応募': 'bg-slate-300',
  'エントリー済': 'bg-sky-400',
  'ES提出済': 'bg-blue-500',
  'GD': 'bg-cyan-500',
  'Webテスト': 'bg-teal-500',
  '1次面接': 'bg-indigo-500',
  '2次面接': 'bg-violet-500',
  '最終面接': 'bg-amber-500',
  '内定': 'bg-emerald-500',
  'お祈り': 'bg-rose-400',
};

export type ViewMode = 'sheet' | 'kanban' | 'calendar';
