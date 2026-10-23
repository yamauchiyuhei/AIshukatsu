import type { Rank, TgWebItem } from '../types';
import { matchRank } from './normalize';

const RANK_ORDER: Record<Rank, number> = { A: 0, B: 1, C: 2, D: 3, N: 4 };
const MAX_RESULTS = 50;

export function searchItems(
  items: TgWebItem[],
  query: string,
  includeLowConfidence: boolean,
): TgWebItem[] {
  const pool = includeLowConfidence
    ? items
    : items.filter((it) => it.rank !== 'D' && it.rank !== 'N');

  if (!query.trim()) {
    return [...pool]
      .sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || a.id - b.id)
      .slice(0, MAX_RESULTS);
  }

  const scored: { item: TgWebItem; m: number }[] = [];
  for (const item of pool) {
    const r = matchRank(query, item.q);
    if (r >= 0) scored.push({ item, m: r });
  }
  scored.sort((a, b) => {
    if (a.m !== b.m) return a.m - b.m;
    const ra = RANK_ORDER[a.item.rank];
    const rb = RANK_ORDER[b.item.rank];
    if (ra !== rb) return ra - rb;
    return a.item.id - b.item.id;
  });
  return scored.slice(0, MAX_RESULTS).map((s) => s.item);
}
