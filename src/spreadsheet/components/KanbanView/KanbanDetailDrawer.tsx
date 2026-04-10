import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useSheet, getActiveSheet } from '../../lib/store';
import { CellEditor } from '../SheetView/CellEditor';

interface Props {
  rowId: string;
  onClose: () => void;
}

export function KanbanDetailDrawer({ rowId, onClose }: Props) {
  const sheet = useSheet((s) => getActiveSheet(s));
  const updateCell = useSheet((s) => s.updateCell);

  const row = sheet.rows.find((r) => r.id === rowId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!row) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" />
      <div
        className="absolute right-0 top-0 h-full w-[400px] overflow-auto border-l border-slate-200/70 bg-white shadow-2xl animate-drawer-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200/70 bg-white/90 px-5 py-3 backdrop-blur">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            {String(row.cells['company'] ?? '(無題)')}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {sheet.columns.map((col) => (
            <div key={col.id}>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {col.name}
              </div>
              <CellEditor
                column={col}
                value={row.cells[col.id] ?? ''}
                onChange={(v) => updateCell(row.id, col.id, v)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
