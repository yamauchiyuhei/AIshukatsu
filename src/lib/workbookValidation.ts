import type { Workbook } from '../spreadsheet/types/sheet';
const types=new Set(['text','longtext','date','datetime','select','rating','url','checkbox','password']);
export function parseWorkbook(text:string):Workbook {
 if(text.length>20*1024*1024)throw new Error('一覧のバックアップは20MB以内にしてください。');
 const value=JSON.parse(text);
 if(value?.version!==2||!Array.isArray(value.sheets)||!value.sheets.length||value.sheets.length>100)throw new Error('AI就活の全シートJSONを選択してください。');
 let rows=0;
 for(const sheet of value.sheets){
  if(typeof sheet.id!=='string'||typeof sheet.name!=='string'||!Array.isArray(sheet.columns)||!Array.isArray(sheet.rows)||sheet.columns.length>200)throw new Error('シートの形式が不正です。');
  const ids=new Set<string>();for(const col of sheet.columns){if(typeof col.id!=='string'||typeof col.name!=='string'||!types.has(col.type)||ids.has(col.id))throw new Error('列の形式が不正です。');ids.add(col.id);if(col.options&&!Array.isArray(col.options))throw new Error('選択肢の形式が不正です。');}
  const rowIds=new Set<string>();for(const row of sheet.rows){if(typeof row.id!=='string'||rowIds.has(row.id)||!row.cells||typeof row.cells!=='object'||Array.isArray(row.cells)||Object.values(row.cells).some(v=>v!==null&&!['string','boolean','number'].includes(typeof v)))throw new Error('行の形式が不正です。');rowIds.add(row.id);}rows+=sheet.rows.length;
 }
 if(rows>100000)throw new Error('復元する行数が上限を超えています。');return value;
}
