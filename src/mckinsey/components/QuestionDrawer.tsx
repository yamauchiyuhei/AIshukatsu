import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Question } from '../types';
import { normalize } from '../lib/normalize';

interface Props {
  open: boolean;
  onClose: () => void;
  questions: Question[];
  currentId: string;
  onSelect: (id: string) => void;
}

export function QuestionDrawer({ open, onClose, questions, currentId, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return questions;
    const q = normalize(query);
    return questions.filter((it) => {
      const hay = normalize(
        `${it.id} ${it.category ?? ''} ${it.title} ${it.html.replace(/<[^>]*>/g, '')}`,
      );
      return hay.includes(q);
    });
  }, [questions, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute inset-x-0 top-0 flex max-h-[92vh] flex-col rounded-b-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">目次</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="-mr-2 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="キーワード検索"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            />
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 pb-4">
          <ul className="space-y-1">
            {filtered.map((q) => {
              const active = q.id === currentId;
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(q.id);
                      onClose();
                    }}
                    className={`block w-full rounded-lg px-3 py-3 text-left transition ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`min-w-[2.25rem] shrink-0 text-xs font-semibold ${
                          active ? 'text-white/80' : 'text-slate-500'
                        }`}
                      >
                        {q.id}
                      </span>
                      <div className="min-w-0 flex-1">
                        {q.category && (
                          <p
                            className={`mb-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              active ? 'text-white/70' : 'text-slate-400'
                            }`}
                          >
                            {q.category}
                          </p>
                        )}
                        <p className="text-sm leading-snug">{q.title}</p>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-slate-400">
                該当なし
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
