import { useEffect, useRef, useState } from 'react';
import { Calendar as CalIcon, Check, X } from 'lucide-react';
import { Status, STATUS_VALUES } from '../types';

// ────────────────────────────────────────────────────────────────────────────
// MatrixCell — compact cell showing date + state, with combined edit popover.
// ────────────────────────────────────────────────────────────────────────────

interface MatrixCellProps {
  date: string | null;
  state: string;
  onChange: (patch: { date?: string | null; state?: string }) => void | Promise<void>;
}

export function MatrixCell({ date, state, onChange }: MatrixCellProps) {
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<string>(date ?? '');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftDate(date ?? '');
  }, [date]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isCompleted = state === '済' || state === '完了';
  const hasContent = !!date || isCompleted;

  const commitDate = async () => {
    const cleaned = draftDate.trim();
    if (cleaned === (date ?? '')) {
      setOpen(false);
      return;
    }
    await onChange({ date: cleaned || null });
    setOpen(false);
  };

  const toggleState = async () => {
    await onChange({ state: isCompleted ? '未' : '済' });
  };

  return (
    <div ref={wrapperRef} className="relative h-full">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`flex h-full w-full flex-col items-center justify-center rounded px-1 py-1 text-[11px] transition ${
          isCompleted
            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : hasContent
              ? 'text-slate-700 hover:bg-slate-100'
              : 'text-slate-300 hover:bg-slate-50'
        }`}
      >
        {date ? (
          <span className="whitespace-nowrap font-medium">{formatShortDate(date)}</span>
        ) : isCompleted ? (
          <Check size={12} />
        ) : (
          <span className="opacity-0 group-hover:opacity-100">·</span>
        )}
        {date && isCompleted && <Check size={10} className="mt-0.5" />}
      </button>
      {open && (
        <div
          className="absolute left-1/2 top-full z-30 mt-1 flex -translate-x-1/2 items-center gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <CalIcon size={13} className="text-slate-400" />
          <input
            type="date"
            value={toIsoDate(draftDate)}
            onChange={(e) => setDraftDate(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitDate();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
              }
            }}
            autoFocus
            className="rounded border border-slate-200 px-2 py-1 text-xs"
          />
          <button
            onClick={commitDate}
            className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
            title="日付を保存 (Enter)"
          >
            <Check size={13} />
          </button>
          {date && (
            <button
              onClick={async () => {
                setOpen(false);
                await onChange({ date: null });
              }}
              className="rounded p-1 text-rose-500 hover:bg-rose-50"
              title="日付クリア"
            >
              <X size={13} />
            </button>
          )}
          <div className="ml-1 border-l border-slate-200 pl-1">
            <button
              onClick={async () => {
                await toggleState();
                setOpen(false);
              }}
              className={`whitespace-nowrap rounded px-2 py-1 text-[11px] transition ${
                isCompleted
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="状態を切替"
            >
              {isCompleted ? '済' : '未'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatShortDate(s: string): string {
  const iso = toIsoDate(s);
  if (!iso) return s;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return s;
  const m = d.getMonth() + 1;
  const dd = d.getDate();
  return `${m}/${dd}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Date cell — click to open popover with native date input.
// ────────────────────────────────────────────────────────────────────────────

interface DateCellProps {
  value: string | null;
  onChange: (value: string | null) => void | Promise<void>;
}

export function DateCell({ value, onChange }: DateCellProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>(value ?? '');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const commit = async () => {
    setOpen(false);
    const cleaned = draft.trim();
    if (cleaned === (value ?? '')) return;
    await onChange(cleaned || null);
  };

  const cancel = () => {
    setDraft(value ?? '');
    setOpen(false);
  };

  // Try to normalize displayed date. Accepts YYYY-MM-DD natively.
  const display = value ? formatDate(value) : null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-full w-full items-center rounded px-2 py-1 text-left text-slate-700 hover:bg-slate-100"
      >
        {display ?? <span className="text-slate-300">—</span>}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 flex items-center gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <CalIcon size={14} className="text-slate-400" />
          <input
            type="date"
            value={toIsoDate(draft)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            autoFocus
            className="rounded border border-slate-200 px-2 py-1 text-xs"
          />
          <button
            onClick={commit}
            className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
            title="保存 (Enter)"
          >
            <Check size={14} />
          </button>
          {value && (
            <button
              onClick={async () => {
                setOpen(false);
                await onChange(null);
              }}
              className="rounded p-1 text-rose-500 hover:bg-rose-50"
              title="クリア"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function toIsoDate(s: string): string {
  if (!s) return '';
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try parse
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatDate(s: string): string {
  // Display as YYYY-MM-DD (曜)
  const iso = toIsoDate(s);
  if (!iso) return s;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return s;
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${iso} (${dow})`;
}

// ────────────────────────────────────────────────────────────────────────────
// Selection-status dropdown cell (10 statuses)
// ────────────────────────────────────────────────────────────────────────────

const STATUS_DOT: Record<Status, string> = {
  '未応募': 'bg-slate-300',
  'エントリー済': 'bg-sky-400',
  'ES提出済': 'bg-blue-500',
  'GD': 'bg-cyan-500',
  'Webテスト': 'bg-teal-500',
  '1次面接': 'bg-indigo-500',
  '2次面接': 'bg-violet-500',
  '最終面接': 'bg-amber-500',
  '内定': 'bg-emerald-500',
  'お祈り': 'bg-rose-400',
};

interface StatusCellProps {
  value: Status | null;
  onChange: (s: Status) => void | Promise<void>;
}

export function StatusCell({ value, onChange }: StatusCellProps) {
  return (
    <Dropdown
      label={
        value ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[value]}`} />
            {value}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )
      }
      onSelect={(v) => onChange(v as Status)}
      options={STATUS_VALUES.map((s) => ({
        value: s,
        label: (
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
            {s}
          </span>
        ),
      }))}
      activeValue={value ?? null}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Task state dropdown cell (未 / 済)
// ────────────────────────────────────────────────────────────────────────────

const TASK_STATES = ['未', '済'] as const;

interface StateCellProps {
  value: string;
  onChange: (s: string) => void | Promise<void>;
}

export function StateCell({ value, onChange }: StateCellProps) {
  const isCompleted = value === '済' || value === '完了';
  return (
    <Dropdown
      label={
        isCompleted ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
            <Check size={10} /> 済
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            未
          </span>
        )
      }
      onSelect={(v) => onChange(v)}
      options={TASK_STATES.map((s) => ({
        value: s,
        label: <span>{s}</span>,
      }))}
      activeValue={isCompleted ? '済' : '未'}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Generic dropdown popover
// ────────────────────────────────────────────────────────────────────────────

interface DropdownProps {
  label: React.ReactNode;
  options: { value: string; label: React.ReactNode }[];
  activeValue: string | null;
  onSelect: (value: string) => void;
}

function Dropdown({ label, options, activeValue, onSelect }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-full w-full items-center rounded px-2 py-1 text-left hover:bg-slate-100"
      >
        {label}
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 min-w-[140px] overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setOpen(false);
                onSelect(opt.value);
              }}
              className={`flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-slate-100 ${
                opt.value === activeValue ? 'bg-slate-50 font-semibold' : ''
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
