import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Columns3,
  Download,
  KanbanSquare,
  Plus,
  Redo2,
  Search,
  Table,
  Undo2,
  Upload,
} from 'lucide-react';
import { useSheet, getActiveSheet } from '../lib/store';
import { exportToCsv, exportToXlsx } from '../lib/importExport';
import { toast } from './Toast';

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  Icon: typeof Search;
  run: () => void;
}

interface Props {
  onClose: () => void;
}

export function CommandPalette({ onClose }: Props) {
  const setView = useSheet((s) => s.setView);
  const addRow = useSheet((s) => s.addRow);
  const undo = useSheet((s) => s.undo);
  const redo = useSheet((s) => s.redo);
  const sheets = useSheet((s) => s.workbook.sheets);
  const switchSheet = useSheet((s) => s.switchSheet);
  const addSheet = useSheet((s) => s.addSheet);
  const savedViews = useSheet((s) => s.savedViews);
  const applySavedView = useSheet((s) => s.applySavedView);

  const close = onClose;

  const commands: Cmd[] = useMemo(() => {
    const cmds: Cmd[] = [
      {
        id: 'view-sheet',
        label: '表ビューに切替',
        hint: 'ビュー',
        Icon: Table,
        run: () => setView('sheet'),
      },
      {
        id: 'view-kanban',
        label: 'Kanban に切替',
        hint: 'ビュー',
        Icon: KanbanSquare,
        run: () => setView('kanban'),
      },
      {
        id: 'view-cal',
        label: 'カレンダーに切替',
        hint: 'ビュー',
        Icon: CalendarDays,
        run: () => setView('calendar'),
      },
      {
        id: 'add-row',
        label: '新しい行を追加',
        hint: '操作',
        Icon: Plus,
        run: () => {
          const id = addRow();
          const a = getActiveSheet(useSheet.getState());
          useSheet.getState().setSelection({ rowId: id, colId: a.columns[0].id });
          toast.success('行を追加しました');
        },
      },
      {
        id: 'add-sheet',
        label: 'シートを追加',
        hint: 'シート',
        Icon: Columns3,
        run: () => {
          addSheet();
          toast.success('シートを追加しました');
        },
      },
      {
        id: 'undo',
        label: '元に戻す',
        hint: '⌘Z',
        Icon: Undo2,
        run: () => {
          if (undo()) toast.info('元に戻しました');
          else toast.warn('戻す操作がありません');
        },
      },
      {
        id: 'redo',
        label: 'やり直し',
        hint: '⌘⇧Z',
        Icon: Redo2,
        run: () => {
          if (redo()) toast.info('やり直しました');
          else toast.warn('やり直す操作がありません');
        },
      },
      {
        id: 'export-xlsx',
        label: 'Excel (.xlsx) にエクスポート',
        hint: '出力',
        Icon: Download,
        run: () => {
          const a = getActiveSheet(useSheet.getState());
          exportToXlsx({ columns: a.columns, rows: a.rows });
        },
      },
      {
        id: 'export-csv',
        label: 'CSV にエクスポート',
        hint: '出力',
        Icon: Download,
        run: () => {
          const a = getActiveSheet(useSheet.getState());
          exportToCsv({ columns: a.columns, rows: a.rows });
        },
      },
      {
        id: 'import-stub',
        label: 'インポートはツールバーから',
        hint: 'ヘルプ',
        Icon: Upload,
        run: () => toast.info('ツールバーの「インポート」をご利用ください'),
      },
    ];
    for (const s of sheets) {
      cmds.push({
        id: `switch-${s.id}`,
        label: `シート: ${s.name}`,
        hint: 'シート切替',
        Icon: ArrowRight,
        run: () => switchSheet(s.id),
      });
    }
    for (const v of savedViews) {
      cmds.push({
        id: `view-${v.id}`,
        label: `ビュー: ${v.name}`,
        hint: '保存済みビュー',
        Icon: Search,
        run: () => applySavedView(v.id),
      });
    }
    return cmds;
  }, [setView, addRow, addSheet, undo, redo, sheets, switchSheet, savedViews, applySavedView]);

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = `${c.label} ${c.hint ?? ''}`.toLowerCase();
      // simple fuzzy: every char of q must appear in order
      let i = 0;
      for (const ch of hay) {
        if (ch === q[i]) i++;
        if (i === q.length) return true;
      }
      return false;
    });
  }, [query, commands]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(filtered.length - 1, a + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[active];
        if (cmd) {
          cmd.run();
          close();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, active, close]);

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-start justify-center bg-slate-900/30 pt-24 backdrop-blur-md"
      onClick={close}
    >
      <div
        className="w-[560px] overflow-hidden rounded-2xl bg-white shadow-2xl animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-200/70 px-4 py-3">
          <Search size={16} className="text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="コマンドを入力..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
            ESC
          </span>
        </div>
        <div className="max-h-80 overflow-auto py-1">
          {filtered.map((c, i) => {
            const Icon = c.Icon;
            return (
              <button
                key={c.id}
                onClick={() => {
                  c.run();
                  close();
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
                  i === active ? 'bg-indigo-50' : 'hover:bg-slate-50'
                }`}
              >
                <Icon size={14} className="text-slate-500" />
                <span className="flex-1 text-slate-800">{c.label}</span>
                {c.hint && (
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">
                    {c.hint}
                  </span>
                )}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-slate-400">
              一致するコマンドがありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
