import { Column, Row } from '../types/sheet';

export interface FilterOpts {
  query: string;
  industry: string | null;
  status: string | null;
  sortColumnId: string | null;
  sortDir: 'asc' | 'desc';
}

export function applyFilters(rows: Row[], columns: Column[], opts: FilterOpts): Row[] {
  const q = opts.query.trim().toLowerCase();
  let out = rows.filter((r) => {
    if (opts.industry && String(r.cells['industry'] ?? '') !== opts.industry) return false;
    if (opts.status && String(r.cells['status'] ?? '') !== opts.status) return false;
    if (q) {
      let hit = false;
      for (const c of columns) {
        const v = r.cells[c.id];
        if (v == null) continue;
        if (String(v).toLowerCase().includes(q)) {
          hit = true;
          break;
        }
      }
      if (!hit) return false;
    }
    return true;
  });

  if (opts.sortColumnId) {
    const col = columns.find((c) => c.id === opts.sortColumnId);
    if (col) {
      const dir = opts.sortDir === 'asc' ? 1 : -1;
      out = [...out].sort((a, b) => {
        const av = a.cells[col.id];
        const bv = b.cells[col.id];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv), 'ja') * dir;
      });
    }
  }
  return out;
}
