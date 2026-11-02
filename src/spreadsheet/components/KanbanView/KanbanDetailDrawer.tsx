import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { useSheet, getActiveSheet } from '../../lib/store';
import { CellEditor } from '../SheetView/CellEditor';
import type { CellValue } from '../../types/sheet';

export function KanbanDetailDrawer({ rowId, onClose }: {rowId:string;onClose:()=>void}) {
  const sheet=useSheet(s=>getActiveSheet(s));
  const row=sheet.rows.find(r=>r.id===rowId);
  const [draft,setDraft]=useState<Record<string,CellValue>>(()=>({...row?.cells}));
  if(!row)return null;
  return <Modal open onClose={onClose} ariaLabel="エントリーの詳細" className="max-w-xl">
    <h2 className="mb-5 text-lg font-semibold">{String(row.cells.company||'企業名未入力')}</h2>
    <form onSubmit={event=>{event.preventDefault();const changes=sheet.columns.filter(c=>draft[c.id]!==row.cells[c.id]).map(c=>({rowId,colId:c.id,value:draft[c.id]??''}));useSheet.getState().applyCellUpdates(changes);onClose();}}>
      <div className="space-y-4">{sheet.columns.map(column=><div key={column.id}><div className="mb-1 text-sm font-medium">{column.name}</div><CellEditor column={column} value={draft[column.id]??''} onChange={value=>setDraft(previous=>({...previous,[column.id]:value}))}/></div>)}</div>
      <div className="mt-6 flex justify-end gap-3"><button type="button" className="rounded border px-4 py-2" onClick={onClose}>キャンセル</button><button type="submit" className="rounded bg-indigo-700 px-4 py-2 text-white">変更を保存</button></div>
    </form>
  </Modal>;
}
