import { parseLocalDate } from '../../lib/deadlines';
import * as XLSX from 'xlsx';
import type { Column, Row, Workbook } from '../types/sheet';
import { normalizeCell, isSecretColumn } from '../../lib/cellValues';
import { parseCsv, serializeCsv } from './csv';
import { downloadBlob } from '../../lib/download';
import { withoutCredentials } from '../../lib/workspaceArchive';

export interface SheetData { columns: Column[]; rows: Row[]; warnings?: string[]; }
export interface ImportSource { names: string[]; book: XLSX.WorkBook | null; csv: { headers: string[]; rows: string[][] } | null; }
export async function readImportSource(file: File): Promise<ImportSource> {
  if (file.size > 20 * 1024 * 1024) throw new Error('取込ファイルは20MB以内にしてください。');
  if (/\.csv$/i.test(file.name)) return { names: [file.name], book: null, csv: parseCsv(await file.text()) };
  const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
  if (!book.SheetNames.length) throw new Error('読み込めるシートがありません。');
  return { names: book.SheetNames, book, csv: null };
}
export function previewImport(source: ImportSource, existing: Column[], sheetName = source.names[0], mapping: Record<number,string> = {}): SheetData {
  const sheet = source.book?.Sheets[sheetName];
  const aoa = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: true, defval: '' }) : [source.csv!.headers, ...source.csv!.rows];
  if (!aoa.length) throw new Error('データが空です。');
  if (aoa.length > 20001 || (aoa[0]?.length ?? 0) > 200) throw new Error('取込は2万行・200列以内にしてください。');
  const headers = aoa[0].map((value,index) => String(value ?? '').trim() || `列${index+1}`);
  const columns: Column[] = [], indices: number[] = [], warnings: string[] = [];
  const used = new Set<string>();
  for (let index=0; index<headers.length; index++) {
    if (mapping[index] === 'skip' || headers[index] === '__aishukatsu_row_id') continue;
    const match = mapping[index] ? existing.find(column => column.id === mapping[index]) : existing.find(column => column.name === headers[index]);
    if (match && used.has(match.id)) { warnings.push(`「${headers[index]}」が重複しています。列の対応を選び直してください。`); continue; }
    const column = match ? { ...match } : { id: `import_${index}_${headers[index]}`, name: headers[index], type: 'text' as const, width: 160 };
    if (columns.some(c => c.name === column.name)) column.name += ` (${index+1})`;
    used.add(column.id); columns.push(column); indices.push(index);
  }
  const rows: Row[] = [];
  const date1904 = !!source.book?.Workbook?.WBProps?.date1904;
  for (let rowIndex=1; rowIndex<aoa.length; rowIndex++) {
    const values = aoa[rowIndex]; if (values.every(value => value === '' || value == null)) continue;
    const cells: Row['cells'] = {};
    columns.forEach((column, index) => {
      const inputIndex = indices[index]; let value = values[inputIndex] ?? '';
      if (column.type === 'date' || column.type === 'datetime') {
        if (typeof value === 'number') {
          const date = XLSX.SSF.parse_date_code(value, { date1904 });
          if (date) value = `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}` + (column.type === 'datetime' ? `T${String(date.H).padStart(2,'0')}:${String(date.M).padStart(2,'0')}` : '');
        } else if (typeof value === 'string' && value) {
          const match = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
          if (match) value = `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}` + (column.type === 'datetime' ? `T${(match[4] ?? '00').padStart(2,'0')}:${match[5] ?? '00'}` : '');
        }
        if (value && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value) || !parseLocalDate(String(value)))) warnings.push(`${rowIndex+1}行目「${column.name}」の日付を確認してください。`);
      }
      if (sheet && isSecretColumn(column)) {
        const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: inputIndex })];
        if (cell?.w && typeof cell.v === 'number') value = cell.w;
      }
      cells[column.id] = normalizeCell(value,column);
    });
    rows.push({ id: `import_${crypto.randomUUID()}`, cells });
  }
  if (!columns.length) throw new Error('取り込む列を1つ以上選択してください。');
  for (const column of existing.filter(c=>c.id==='company'||c.id==='status')) { if (!columns.some(c=>c.id===column.id)) { columns.push({...column}); rows.forEach(row=>{row.cells[column.id]='';}); warnings.push(`「${column.name}」列は未対応のため、空欄で追加します。`); } }
  const names = rows.map(row => String(row.cells.company ?? '')).filter(Boolean);
  const duplicates = names.length-new Set(names).size;
  if (duplicates) warnings.push(`同じ企業名が${duplicates}件あります。別エントリーとして取り込みます。`);
  return { columns, rows, warnings: [...new Set(warnings)] };
}
export async function importFromFile(file: File, existingColumns: Column[]): Promise<SheetData> {
  return previewImport(await readImportSource(file), existingColumns);
}
function publicData(data: SheetData, includeCredentials = false) {
  return { ...data, columns: includeCredentials ? data.columns : data.columns.filter(column => !isSecretColumn(column)) };
}
export async function exportToXlsx(data: SheetData, filename = '就活スプレッドシート.xlsx', includeCredentials = false) {
  const safe = publicData(data,includeCredentials);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([safe.columns.map(c => c.name), ...safe.rows.map(r => safe.columns.map(c => r.cells[c.id] ?? ''))]), 'エントリー一覧');
  return downloadBlob(new Blob([XLSX.write(book, { type: 'array', bookType: 'xlsx' })]), filename);
}
export async function exportToCsv(data: SheetData, filename = '就活スプレッドシート.csv', includeCredentials = false) {
  const safe = publicData(data,includeCredentials);
  const csv = serializeCsv(safe.columns.map(c=>c.name), safe.rows.map(row => safe.columns.map(column => {
    const value = String(row.cells[column.id] ?? '');
    // Spreadsheet applications must not evaluate user-entered strings as formulas.
    return /^[\t\r\n ]*[=+@-]/.test(value) ? "'"+value : value;
  })));
  return downloadBlob(new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' }), filename);
}
export async function exportWorkbook(workbook: Workbook, format: 'xlsx' | 'json', includeCredentials: boolean) {
  const safe = includeCredentials ? workbook : withoutCredentials(workbook);
  if (format === 'json') return downloadBlob(new Blob([JSON.stringify(safe,null,2)], { type: 'application/json' }), 'AI就活-全シート.json');
  const book = XLSX.utils.book_new(); const used = new Set<string>();
  safe.sheets.forEach((sheet,index) => {
    const data = publicData(sheet,includeCredentials);
    let name = sheet.name.replace(/[\\/?*\[\]:]/g,' ').slice(0,25) || 'シート';
    if (used.has(name)) name += ` ${index+1}`; used.add(name);
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([data.columns.map(c=>c.name), ...data.rows.map(row=>data.columns.map(c=>row.cells[c.id] ?? ''))]), name);
  });
  return downloadBlob(new Blob([XLSX.write(book,{type:'array',bookType:'xlsx'})]), 'AI就活-全シート.xlsx');
}
