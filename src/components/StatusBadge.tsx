import { SelectionStatus } from '../types';

const COLORS: Record<SelectionStatus, string> = {
  '未エントリー': 'bg-slate-100 text-slate-700 border-slate-200',
  'ES提出済': 'bg-blue-50 text-blue-700 border-blue-200',
  '一次面接': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '二次面接': 'bg-violet-50 text-violet-700 border-violet-200',
  '最終面接': 'bg-amber-50 text-amber-700 border-amber-200',
  '内定': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'お祈り': 'bg-rose-50 text-rose-700 border-rose-200',
};

export function StatusBadge({ status }: { status: SelectionStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${COLORS[status]}`}
    >
      {status}
    </span>
  );
}
