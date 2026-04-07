import { Status } from '../types';

const COLORS: Record<Status, string> = {
  '未応募': 'bg-slate-100 text-slate-600 border-slate-200',
  'エントリー済': 'bg-sky-50 text-sky-700 border-sky-200',
  'ES提出済': 'bg-blue-50 text-blue-700 border-blue-200',
  'GD': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Webテスト': 'bg-teal-50 text-teal-700 border-teal-200',
  '1次面接': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '2次面接': 'bg-violet-50 text-violet-700 border-violet-200',
  '最終面接': 'bg-amber-50 text-amber-700 border-amber-200',
  '内定': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'お祈り': 'bg-rose-50 text-rose-700 border-rose-200',
};

export function StatusBadge({ status }: { status: Status | null }) {
  if (status === null) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${COLORS[status]}`}
    >
      {status}
    </span>
  );
}
