import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Question } from '../types';

interface Props {
  prev: Question | null;
  next: Question | null;
  onSelect: (id: string) => void;
}

export function BottomNav({ prev, next, onSelect }: Props) {
  return (
    <nav className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-screen-sm items-stretch gap-2 px-3 py-2">
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && onSelect(prev.id)}
          className="flex min-h-[48px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
        >
          <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />
          {prev ? (
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase text-slate-400">
                前 {prev.id}
              </p>
              <p className="truncate text-sm">{prev.title}</p>
            </div>
          ) : (
            <span className="text-xs text-slate-400">最初</span>
          )}
        </button>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && onSelect(next.id)}
          className="flex min-h-[48px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
        >
          {next ? (
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase text-slate-400">
                次 {next.id}
              </p>
              <p className="truncate text-sm">{next.title}</p>
            </div>
          ) : (
            <span className="flex-1 text-xs text-slate-400">最後</span>
          )}
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </div>
    </nav>
  );
}
