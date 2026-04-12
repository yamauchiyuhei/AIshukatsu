import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { CellValue, Column } from '../../types/sheet';
import { CellEditor } from './CellEditor';
import { URGENCY_BG, URGENCY_TEXT, urgencyForDate } from '../../lib/conditionalFormat';

interface Props {
  column: Column;
  value: CellValue;
  status: string;
  selected: boolean;
  onChange: (v: CellValue) => void;
  onEditingChange?: (editing: boolean) => void;
}

const STATUS_BADGE: Record<string, string> = {
  '未応募': 'bg-slate-200 text-slate-700',
  'エントリー済': 'bg-sky-100 text-sky-800',
  'ES提出済': 'bg-blue-100 text-blue-800',
  'GD': 'bg-cyan-100 text-cyan-800',
  'Webテスト': 'bg-teal-100 text-teal-800',
  '1次面接': 'bg-indigo-100 text-indigo-800',
  '2次面接': 'bg-violet-100 text-violet-800',
  '最終面接': 'bg-amber-100 text-amber-800',
  '内定': 'bg-emerald-200 text-emerald-900 font-semibold',
  'お祈り': 'bg-rose-100 text-rose-700 line-through',
};

export function DataCell({
  column,
  value,
  status,
  selected,
  onChange,
  onEditingChange,
}: Props) {
  const [editing, setEditing] = useState(false);

  // notify parent
  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  const completed = status === '内定' || status === 'お祈り';

  // Conditional formatting for date cells
  let bgClass = '';
  let textClass = '';
  if (column.type === 'date' || column.type === 'datetime') {
    const u = urgencyForDate(value, completed);
    bgClass = URGENCY_BG[u];
    textClass = URGENCY_TEXT[u];
  }

  // Inline editors for checkbox / rating (no popover)
  if (column.type === 'checkbox') {
    return (
      <div className="flex h-full items-center justify-center px-1 py-1">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded"
        />
      </div>
    );
  }
  if (column.type === 'rating') {
    return (
      <div className="flex h-full items-center justify-center gap-0.5 px-1 py-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(Number(value) === n ? 0 : n)}
            className="transition hover:scale-110"
          >
            <Star
              size={12}
              className={
                n <= Number(value || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
              }
            />
          </button>
        ))}
      </div>
    );
  }

  // Status select: render as colored badge that opens select on click
  if (column.id === 'status') {
    const v = String(value ?? '');
    if (editing) {
      return (
        <div className="px-1 py-1">
          <CellEditor
            column={column}
            value={value}
            onChange={onChange}
            onBlur={() => setEditing(false)}
            autoFocus
          />
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`m-1 inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[11px] ${
          STATUS_BADGE[v] ?? 'bg-slate-100 text-slate-600'
        }`}
        title="クリックで変更"
      >
        <span className="truncate">{v || '未設定'}</span>
      </button>
    );
  }

  if (editing) {
    return (
      <div className="px-1 py-1">
        <CellEditor
          column={column}
          value={value}
          onChange={onChange}
          onBlur={() => setEditing(false)}
          autoFocus
        />
      </div>
    );
  }

  // Display mode
  const display = formatDisplay(column, value);
  // Auto-detect URLs: column.type === 'url' OR the cell value starts with http(s)://
  const strVal = typeof value === 'string' ? value.trim() : '';
  const isUrl =
    (column.type === 'url' && strVal) ||
    /^https?:\/\//i.test(strVal);

  // For URL cells: single click opens the link, double click enters edit mode.
  // For other cells: single click enters edit mode (unchanged).
  if (isUrl) {
    return (
      <div
        className={`flex h-full w-full items-center px-2 py-1.5 text-left text-xs transition ${bgClass} ${textClass} ${
          selected ? '' : 'hover:bg-indigo-50/40'
        }`}
        onDoubleClick={() => setEditing(true)}
        title="クリックで開く / ダブルクリックで編集"
      >
        <a
          href={strVal}
          target="_blank"
          rel="noreferrer"
          className="truncate text-indigo-600 underline hover:text-indigo-800"
          title={strVal}
        >
          {display || '\u00A0'}
        </a>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      onDoubleClick={() => setEditing(true)}
      className={`flex h-full w-full items-center px-2 py-1.5 text-left text-xs transition ${bgClass} ${textClass} ${
        selected ? '' : 'hover:bg-indigo-50/40'
      }`}
      title="クリックで編集"
    >
      <span className="truncate whitespace-pre-wrap">{display || '\u00A0'}</span>
    </button>
  );
}

function formatDisplay(column: Column, value: CellValue): string {
  if (value == null || value === '') return '';
  if (column.type === 'password') {
    return '••••••';
  }
  if (column.type === 'date') {
    // Input format is ISO YYYY-MM-DD. Display as YYYY/M/D so the day is not
    // dropped — the previous implementation destructured the match array as
    // `[, m, d]`, which actually captured year+month (skipping day entirely)
    // and produced "2026/5" instead of "2026/5/13".
    const s = String(value);
    const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, mo, d] = match;
      return `${y}/${Number(mo)}/${Number(d)}`;
    }
    return s;
  }
  if (column.type === 'datetime') {
    const s = String(value);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (m) return `${m[1]}/${Number(m[2])}/${Number(m[3])} ${m[4]}:${m[5]}`;
    return s;
  }
  return String(value);
}
