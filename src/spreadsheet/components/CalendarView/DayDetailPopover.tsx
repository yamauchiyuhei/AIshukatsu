import { Modal } from '../../../components/ui/Modal';
import type { DeadlineEntry } from './MonthCalendar';
interface Props {date:Date;entries:DeadlineEntry[];x:number;y:number;onJump:(rowId:string)=>void;onClose:()=>void;}
export function DayDetailPopover({date,entries,onJump,onClose}:Props){
 return <Modal open onClose={onClose} ariaLabel="この日の予定" className="max-w-md"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{date.toLocaleDateString('ja-JP')}の予定</h2><button className="rounded border px-3 py-2 text-sm" onClick={onClose}>閉じる</button></div><div className="mt-4 space-y-2">{entries.length?entries.map((entry,index)=><button key={`${entry.rowId}:${entry.columnId}:${index}`} onClick={()=>onJump(entry.rowId)} className="block w-full rounded border p-3 text-left hover:bg-indigo-50"><div className="font-medium">{entry.company}</div><div className="text-sm text-slate-600">{entry.kind}</div></button>):<p className="py-6 text-slate-600">予定はありません。</p>}</div></Modal>;
}
