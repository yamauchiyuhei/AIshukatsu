import { useEffect } from 'react';
import { X } from 'lucide-react';
import { DeadlineEntry } from './MonthCalendar';

interface Props {
  date: Date;
  entries: DeadlineEntry[];
  x: number;
  y: number;
  onJump: (rowId: string) => void;
  onClose: () => void;
}

export function DayDetailPopover({ date, entries, x, y, onJump, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Clamp position to viewport
  const left = Math.min(window.innerWidth - 280, x);
  const top = Math.min(window.innerHeight - 300, y);

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute w-64 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl animate-pop-in"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-2.5">
          <div className="text-xs font-semibold tracking-tight text-slate-900">
            {date.getFullYear()}/{date.getMonth() + 1}/{date.getDate()} の予定
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={12} />
          </button>
        </div>
        <div className="max-h-72 overflow-auto p-2">
          {entries.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-400">予定はありません</div>
          ) : (
            entries.map((e, i) => (
              <button
                key={i}
                onClick={() => onJump(e.rowId)}
                className="block w-full rounded-xl px-3 py-2 text-left text-xs hover:bg-indigo-50"
              >
                <div className="font-semibold text-slate-800">{e.company}</div>
                <div className="text-[10px] text-rose-600">{e.kind} 締切</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
