import * as XLSX from 'xlsx';
import { Column, Row } from '../types/sheet';

/** Lightweight columns+rows pair used by import/export. */
export interface SheetData {
  columns: Column[];
  rows: Row[];
}

export function exportToXlsx(data: SheetData, filename = '就活スプレッドシート.xlsx') {
  const aoa: (string | number | boolean | null)[][] = [];
  aoa.push(data.columns.map((c) => c.name));
  for (const r of data.rows) {
    aoa.push(data.columns.map((c) => normalizeForExport(r.cells[c.id])));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // set column widths
  ws['!cols'] = data.columns.map((c) => ({ wch: Math.max(8, Math.floor((c.width ?? 120) / 8)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}

export function exportToCsv(data: SheetData, filename = '就活スプレッドシート.csv') {
  const aoa: (string | number | boolean | null)[][] = [];
  aoa.push(data.columns.map((c) => c.name));
  for (const r of data.rows) {
    aoa.push(data.columns.map((c) => normalizeForExport(r.cells[c.id])));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeForExport(v: unknown): string | number | boolean | null {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  return String(v);
}

/**
 * Import a workbook. Maps imported header names to existing column ids by name match;
 * unknown headers become new text columns.
 */
export async function importFromFile(
  file: File,
  existingColumns: Column[],
): Promise<SheetData> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, {
    header: 1,
    blankrows: false,
  });
  if (aoa.length === 0) return { columns: existingColumns, rows: [] };

  const headers = (aoa[0] ?? []).map((h) => String(h ?? '').trim());
  const columns: Column[] = [];
  const colIdByIndex: string[] = [];

  for (const h of headers) {
    const match = existingColumns.find((c) => c.name === h);
    if (match) {
      columns.push(match);
      colIdByIndex.push(match.id);
    } else {
      const id = `c_imp_${columns.length}_${Math.random().toString(36).slice(2, 6)}`;
      columns.push({ id, name: h || `列${columns.length + 1}`, type: 'text', width: 130 });
      colIdByIndex.push(id);
    }
  }

  const rows: Row[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const arr = aoa[i] ?? [];
    const cells: Record<string, string | number | boolean | null> = {};
    for (let j = 0; j < colIdByIndex.length; j++) {
      const v = arr[j];
      cells[colIdByIndex[j]] = v === undefined ? '' : (v as any);
    }
    rows.push({
      id: `r_imp_${i}_${Math.random().toString(36).slice(2, 6)}`,
      cells,
    });
  }
  return { columns, rows };
}
