import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSheet, getActiveSheet } from '../../lib/store';
import { applyFilters } from '../../lib/filtering';
import { Row } from '../../types/sheet';
import { DayDetailPopover } from './DayDetailPopover';

export interface DeadlineEntry {
  rowId: string;
  company: string;
  kind: string;
  date: Date;
}

const WEEK_LABEL = ['日', '月', '火', '水', '木', '金', '土'];

export function MonthCalendar() {
  const sheet = useSheet((s) => getActiveSheet(s));
  const search = useSheet((s) => s.searchQuery);
  const fIndustry = useSheet((s) => s.filterIndustry);
  const fStatus = useSheet((s) => s.filterStatus);
  const setView = useSheet((s) => s.setView);
  const setSelection = useSheet((s) => s.setSelection);
  const addRow = useSheet((s) => s.addRow);
  const updateCell = useSheet((s) => s.updateCell);

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

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [popoverDate, setPopoverDate] = useState<Date | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    date: Date;
  } | null>(null);

  const entries = useMemo(() => collectDeadlines(filtered), [filtered]);
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const byDate = useMemo(() => {
    const m = new Map<string, DeadlineEntry[]>();
    for (const e of entries) {
      const key = `${e.date.getFullYear()}-${e.date.getMonth()}-${e.date.getDate()}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(e);
    }
    return m;
  }, [entries]);

  const prev = () => {
    const d = new Date(year, month - 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const next = () => {
    const d = new Date(year, month + 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const jumpToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const jumpToRow = (rowId: string) => {
    setView('sheet');
    const colId = sheet.columns[0]?.id;
    if (colId) setSelection({ rowId, colId });
    setPopoverDate(null);
  };

  const addOnDate = (date: Date, kind: 'es' | 'web' | 'interview') => {
    const id = addRow();
    const iso = date.toISOString().slice(0, 10);
    if (kind === 'es') updateCell(id, 'es_deadline', iso);
    if (kind === 'web') updateCell(id, 'webtest_deadline', iso);
    if (kind === 'interview') {
      const t = `${iso}T10:00`;
      updateCell(id, 'interview_at', t);
    }
    setContextMenu(null);
    setView('sheet');
    const colId = sheet.columns[0]?.id;
    if (colId) setSelection({ rowId: id, colId });
  };

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-white to-slate-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={prev}
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-base font-semibold tracking-tight text-slate-900">
          {year}年 {month + 1}月
        </div>
        <button
          onClick={next}
          className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={jumpToday}
          className="ml-2 rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
        >
          今日
        </button>
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        {WEEK_LABEL.map((w, i) => (
          <div
            key={w}
            className={`border-b border-slate-200/60 bg-white/70 px-2 py-1.5 text-center text-[11px] font-semibold backdrop-blur ${
              i === 0 ? 'text-rose-500' : i === 6 ? 'text-sky-500' : 'text-slate-500'
            }`}
          >
            {w}
          </div>
        ))}
        {grid.map((cell, idx) => {
          const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
          const items = byDate.get(key) ?? [];
          const isToday =
            cell.date.getFullYear() === today.getFullYear() &&
            cell.date.getMonth() === today.getMonth() &&
            cell.date.getDate() === today.getDate();
          const dow = cell.date.getDay();
          const wkBg =
            dow === 0
              ? 'bg-rose-50/40'
              : dow === 6
                ? 'bg-sky-50/40'
                : 'bg-white';
          return (
            <div
              key={idx}
              onClick={(e) => {
                if (items.length === 0) return;
                setPopoverDate(cell.date);
                setPopoverPos({ x: e.clientX, y: e.clientY });
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, date: cell.date });
              }}
              className={`min-h-[96px] cursor-pointer border-b border-r border-slate-100 p-1.5 transition hover:bg-indigo-50/30 ${
                cell.outOfMonth ? 'bg-slate-50/60' : wkBg
              }`}
            >
              <div
                className={`text-[10px] ${
                  isToday
                    ? 'inline-block rounded-full bg-indigo-600 px-1.5 font-semibold text-white'
                    : cell.outOfMonth
                      ? 'text-slate-300'
                      : 'text-slate-500'
                }`}
              >
                {cell.date.getDate()}
              </div>
              <div className="mt-1 space-y-0.5">
                {items.slice(0, 4).map((e, i) => (
                  <div
                    key={i}
                    className="truncate rounded-md bg-rose-50 px-1 text-[10px] text-rose-700"
                    title={`${e.company} (${e.kind})`}
                  >
                    {e.company} {e.kind}
                  </div>
                ))}
                {items.length > 4 && (
                  <div className="px-1 text-[10px] text-slate-400">+{items.length - 4} 件</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {popoverDate && popoverPos && (
        <DayDetailPopover
          date={popoverDate}
          entries={byDate.get(`${popoverDate.getFullYear()}-${popoverDate.getMonth()}-${popoverDate.getDate()}`) ?? []}
          x={popoverPos.x}
          y={popoverPos.y}
          onJump={jumpToRow}
          onClose={() => setPopoverDate(null)}
        />
      )}

      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            className="absolute w-52 overflow-hidden rounded-xl border border-slate-200/70 bg-white py-1 text-xs shadow-xl animate-pop-in"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400">
              {contextMenu.date.getFullYear()}/{contextMenu.date.getMonth() + 1}/
              {contextMenu.date.getDate()} に追加
            </div>
            <button
              className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
              onClick={() => addOnDate(contextMenu.date, 'es')}
            >
              ES 締切で追加
            </button>
            <button
              className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
              onClick={() => addOnDate(contextMenu.date, 'web')}
            >
              Web テスト締切で追加
            </button>
            <button
              className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
              onClick={() => addOnDate(contextMenu.date, 'interview')}
            >
              面接日程で追加
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function collectDeadlines(rows: Row[]): DeadlineEntry[] {
  const out: DeadlineEntry[] = [];
  const fields: { key: string; label: string }[] = [
    { key: 'es_deadline', label: 'ES' },
    { key: 'webtest_deadline', label: 'Web' },
    { key: 'interview_at', label: '面接' },
  ];
  for (const r of rows) {
    const company = String(r.cells['company'] ?? '(無題)');
    for (const f of fields) {
      const v = r.cells[f.key];
      if (typeof v === 'string' && v) {
        const d = new Date(v);
        if (!isNaN(d.getTime())) {
          out.push({ rowId: r.id, company, kind: f.label, date: d });
        }
      }
    }
  }
  return out;
}

interface GridCell {
  date: Date;
  outOfMonth: boolean;
}

function buildMonthGrid(year: number, month: number): GridCell[] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const start = new Date(year, month, 1 - startDay);
  const cells: GridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: d, outOfMonth: d.getMonth() !== month });
  }
  return cells;
}
