import type { Column, Row } from '../spreadsheet/types/sheet';
export function parseLocalDate(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!match) return null;
  const [,y,m,d,h='00',minute='00']=match;
  const date=new Date(+y,+m-1,+d,+h,+minute);
  return date.getFullYear()===+y&&date.getMonth()===+m-1&&date.getDate()===+d&&date.getHours()===+h&&date.getMinutes()===+minute ? date : null;
}
export function isClosedStatus(value: unknown) { return ['内定','内々定','お祈り','不合格','辞退','終了'].includes(String(value)); }
export function collectDeadlines(rows: Row[], columns: Column[], includeCompleted = false) {
  return rows.flatMap(row => {
    if (!includeCompleted && isClosedStatus(row.cells.status)) return [];
    return columns.filter(column=>column.type==='date'||column.type==='datetime').flatMap(column=>{
      const value=row.cells[column.id]; const date=typeof value==='string'&&value?parseLocalDate(value):null;
      return date?[{rowId:row.id,company:String(row.cells.company||'企業名未入力'),kind:column.name,columnId:column.id,date,hasTime:column.type==='datetime'}]:[];
    });
  });
}
