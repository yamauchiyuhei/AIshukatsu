import { useMemo, useState } from 'react';
import { useSheet, getActiveSheet } from '../../lib/store';
import { STATUS_ACCENT, STATUS_VALUES, StatusValue } from '../../types/sheet';
import { applyFilters } from '../../lib/filtering';
import { urgencyForDate, URGENCY_TEXT } from '../../lib/conditionalFormat';
import { KanbanDetailDrawer } from './KanbanDetailDrawer';

export function KanbanBoard() {
  const sheet = useSheet((s) => getActiveSheet(s));
  const search = useSheet((s) => s.searchQuery);
  const fIndustry = useSheet((s) => s.filterIndustry);
  const fStatus = useSheet((s) => s.filterStatus);
  const setStatus = useSheet((s) => s.setStatus);

  const filtered = useMemo(
    () =>
      applyFilters(sheet.rows, sheet.columns, {
        query: search,
        industry: fIndustry,
        status: fStatus,
        sortColumnId: null,
        sortDir: 'asc',
      }),
    [sheet.rows, sheet.columns, search, fIndustry, fStatus],
  );

  const groups = useMemo(() => {
    const m = new Map<string, typeof sheet.rows>();
    for (const s of STATUS_VALUES) m.set(s, []);
    for (const r of filtered) {
      const s = String(r.cells['status'] ?? '未応募');
      if (!m.has(s)) m.set(s, []);
      m.get(s)!.push(r);
    }
    return m;
  }, [filtered, sheet.rows]);

  const [draggingFrom, setDraggingFrom] = useState<string | null>(null);
  const [drawerRowId, setDrawerRowId] = useState<string | null>(null);

  const handleDrop = (rowId: string, status: string) => {
    setStatus(rowId, status);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-auto bg-gradient-to-b from-white to-slate-50 p-4">
        <div className="flex gap-4">
          {STATUS_VALUES.map((status) => {
            const items = groups.get(status) ?? [];
            const accent = STATUS_ACCENT[status as StatusValue] ?? 'bg-slate-300';
            const isDropTarget = draggingFrom !== null && draggingFrom !== status;
            return (
              <div
                key={status}
                className={`flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition ${
                  draggingFrom === status ? 'opacity-60' : ''
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const rowId = e.dataTransfer.getData('text/plain');
                  if (rowId) handleDrop(rowId, status);
                  setDraggingFrom(null);
                }}
              >
                <div className={`h-1 w-full ${accent}`} />
                <div
                  className={`flex items-center justify-between px-3 py-2 ${
                    isDropTarget ? 'animate-pulse-soft' : ''
                  }`}
                >
                  <div className="text-xs font-semibold tracking-tight text-slate-800">
                    {status}
                  </div>
                  <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {items.length}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-auto p-2">
                  {items.map((row) => {
                    const company = String(row.cells['company'] ?? '(無題)');
                    const industry = String(row.cells['industry'] ?? '');
                    const rating = Number(row.cells['rating'] ?? 0);
                    const esDeadline = row.cells['es_deadline'];
                    const completed = status === '内定' || status === 'お祈り';
                    const u = urgencyForDate(esDeadline, completed);
                    return (
                      <div
                        key={row.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', row.id);
                          setDraggingFrom(status);
                        }}
                        onDragEnd={() => setDraggingFrom(null)}
                        onClick={() => setDrawerRowId(row.id)}
                        className="cursor-grab rounded-xl border border-slate-200/70 bg-white p-2.5 text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <div className="truncate font-semibold text-slate-800">{company}</div>
                          {rating > 0 && (
                            <div className="text-[10px] text-amber-500">{'★'.repeat(rating)}</div>
                          )}
                        </div>
                        {industry && (
                          <div className="mb-1 text-[10px] text-slate-500">{industry}</div>
                        )}
                        {esDeadline && (
                          <div className={`text-[10px] ${URGENCY_TEXT[u]}`}>
                            ES締切: {String(esDeadline)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200/70 px-2 py-6 text-center text-[10px] text-slate-300">
                      ここにドラッグ
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {drawerRowId && (
        <KanbanDetailDrawer rowId={drawerRowId} onClose={() => setDrawerRowId(null)} />
      )}
    </div>
  );
}
