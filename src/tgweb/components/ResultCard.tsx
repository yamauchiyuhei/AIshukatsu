import { useState } from 'react';
import type { Rank, TgWebItem } from '../types';

interface Props {
  item: TgWebItem;
}

const RANK_STYLE: Record<Rank, string> = {
  A: 'bg-emerald-100 text-emerald-800',
  B: 'bg-sky-100 text-sky-800',
  C: 'bg-amber-100 text-amber-800',
  D: 'bg-rose-100 text-rose-800',
  N: 'bg-slate-200 text-slate-700',
};

const PREVIEW_LEN = 120;

export function ResultCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false);
  const needsTrunc = item.q.length > PREVIEW_LEN;
  const text = expanded || !needsTrunc ? item.q : item.q.slice(0, PREVIEW_LEN) + '…';
  const isLow = item.rank === 'D' || item.rank === 'N';

  return (
    <article
      className={`rounded-xl border bg-white p-4 ${
        isLow ? 'border-rose-200' : 'border-slate-200'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RANK_STYLE[item.rank]}`}
        >
          ランク {item.rank}
        </span>
        {item.verify && (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
            要検証
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400">No. {item.id}</span>
      </div>
      <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
        {text}
      </p>
      {needsTrunc && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mb-3 text-xs text-slate-500 hover:text-slate-800"
        >
          {expanded ? '折りたたむ' : '全文表示'}
        </button>
      )}
      <div className="rounded-md bg-slate-50 px-3 py-2">
        <p className="mb-0.5 text-xs text-slate-500">採用解答</p>
        <p className="whitespace-pre-wrap text-base font-semibold text-slate-900">
          {item.a || '（解答なし）'}
        </p>
      </div>
    </article>
  );
}
