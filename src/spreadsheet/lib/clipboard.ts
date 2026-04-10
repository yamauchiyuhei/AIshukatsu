import { CellCoord, CellValue, Column, Row, SelectionRange, Sheet } from '../types/sheet';

/** Build a TSV string from the cells inside a range. */
export function rangeToTsv(sheet: Sheet, range: SelectionRange): string {
  const rect = normalizeRange(sheet, range);
  if (!rect) return '';
  const lines: string[] = [];
  for (let r = rect.r1; r <= rect.r2; r++) {
    const row = sheet.rows[r];
    const cells: string[] = [];
    for (let c = rect.c1; c <= rect.c2; c++) {
      const col = sheet.columns[c];
      const v = row.cells[col.id];
      cells.push(stringifyCell(v));
    }
    lines.push(cells.join('\t'));
  }
  return lines.join('\n');
}

export function singleCellToTsv(sheet: Sheet, coord: CellCoord): string {
  const row = sheet.rows.find((r) => r.id === coord.rowId);
  if (!row) return '';
  const v = row.cells[coord.colId];
  return stringifyCell(v);
}

/** Parse pasted text (TSV / single value) into a 2D array of strings. */
export function parseTsv(text: string): string[][] {
  if (!text) return [];
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // remove trailing newline so an extra empty row is not created
  const trimmed = cleaned.endsWith('\n') ? cleaned.slice(0, -1) : cleaned;
  return trimmed.split('\n').map((line) => line.split('\t'));
}

export interface PasteResult {
  updates: { rowId: string; colId: string; value: CellValue }[];
}

/** Compute updates by writing 2D values starting at a top-left coord. */
export function buildPasteUpdates(
  sheet: Sheet,
  topLeft: CellCoord,
  values: string[][],
): PasteResult {
  const startRow = sheet.rows.findIndex((r) => r.id === topLeft.rowId);
  const startCol = sheet.columns.findIndex((c) => c.id === topLeft.colId);
  if (startRow < 0 || startCol < 0) return { updates: [] };

  const updates: PasteResult['updates'] = [];
  for (let dr = 0; dr < values.length; dr++) {
    const targetRow = sheet.rows[startRow + dr];
    if (!targetRow) break;
    for (let dc = 0; dc < values[dr].length; dc++) {
      const targetCol = sheet.columns[startCol + dc];
      if (!targetCol) break;
      const raw = values[dr][dc];
      updates.push({
        rowId: targetRow.id,
        colId: targetCol.id,
        value: coerce(raw, targetCol),
      });
    }
  }
  return { updates };
}

function coerce(raw: string, col: Column): CellValue {
  if (raw === '') return '';
  if (col.type === 'rating') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  if (col.type === 'checkbox') {
    return raw === 'true' || raw === '1' || raw === '✓';
  }
  return raw;
}

function stringifyCell(v: CellValue): string {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

interface RectIdx {
  r1: number;
  r2: number;
  c1: number;
  c2: number;
}
function normalizeRange(sheet: Sheet, range: SelectionRange): RectIdx | null {
  const r1 = sheet.rows.findIndex((r) => r.id === range.start.rowId);
  const r2 = sheet.rows.findIndex((r) => r.id === range.end.rowId);
  const c1 = sheet.columns.findIndex((c) => c.id === range.start.colId);
  const c2 = sheet.columns.findIndex((c) => c.id === range.end.colId);
  if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) return null;
  return {
    r1: Math.min(r1, r2),
    r2: Math.max(r1, r2),
    c1: Math.min(c1, c2),
    c2: Math.max(c1, c2),
  };
}

/** Read values from the upper neighbour for ⌘D fill-down. */
export function fillDownUpdate(
  sheet: Sheet,
  coord: CellCoord,
): { rowId: string; colId: string; value: CellValue } | null {
  const idx = sheet.rows.findIndex((r) => r.id === coord.rowId);
  if (idx <= 0) return null;
  const above = sheet.rows[idx - 1];
  return { rowId: coord.rowId, colId: coord.colId, value: above.cells[coord.colId] ?? '' };
}
