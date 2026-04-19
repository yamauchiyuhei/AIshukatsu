import { useEffect, useState } from 'react';
import { Check, Copy, Link as LinkIcon, Star } from 'lucide-react';
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

  // For URL cells: render a compact chip with favicon + hostname so long
  // マイページURLs don't blow up column width. Click opens the link, double
  // click enters edit mode, a hover-only copy icon yanks the full URL.
  if (isUrl) {
    return (
      <UrlCell
        url={strVal}
        bgClass={bgClass}
        textClass={textClass}
        selected={selected}
        onEnterEdit={() => setEditing(true)}
      />
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

/**
 * Compact URL display: favicon + hostname, click to open, hover-only copy
 * button, full URL in tooltip. Keeps the column width predictable regardless
 * of actual URL length.
 */
function UrlCell({
  url,
  bgClass,
  textClass,
  selected,
  onEnterEdit,
}: {
  url: string;
  bgClass: string;
  textClass: string;
  selected: boolean;
  onEnterEdit: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);

  let hostname = '';
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // Fall back to truncated raw string for malformed URLs (rare — already
    // filtered by isUrl at the call site, but keep a safety net).
    hostname = url.length > 40 ? `${url.slice(0, 40)}…` : url;
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    hostname,
  )}&sz=32`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard failures — not critical.
    }
  };

  return (
    <div
      className={`group flex h-full w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs transition ${bgClass} ${textClass} ${
        selected ? '' : 'hover:bg-indigo-50/40'
      }`}
      onDoubleClick={onEnterEdit}
      title={`${url}\n(クリックで開く / ダブルクリックで編集)`}
    >
      {faviconFailed ? (
        <LinkIcon size={12} className="shrink-0 text-slate-400" />
      ) : (
        <img
          src={faviconUrl}
          alt=""
          className="h-4 w-4 shrink-0 rounded-sm object-contain"
          onError={() => setFaviconFailed(true)}
          loading="lazy"
          aria-hidden
        />
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1 truncate text-indigo-600 hover:text-indigo-800 hover:underline"
      >
        {hostname}
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100"
        title={copied ? 'コピーしました' : 'URLをコピー'}
        aria-label="URLをコピー"
      >
        {copied ? (
          <Check size={11} className="text-emerald-500" />
        ) : (
          <Copy size={11} />
        )}
      </button>
    </div>
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
