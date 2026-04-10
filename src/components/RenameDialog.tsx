import { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  /** Pre-filled name (including extension). */
  initialName: string;
  title?: string;
  onCancel: () => void;
  onSubmit: (newName: string) => Promise<void> | void;
}

/**
 * Minimal rename prompt dialog. Selects the filename stem on mount so that
 * typing immediately replaces the base name while keeping the extension —
 * matches Finder / VSCode behaviour.
 */
export function RenameDialog({
  open,
  initialName,
  title = '名前を変更',
  onCancel,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(initialName);
    setError(null);
    setSubmitting(false);
    // Auto-focus and select only the file stem (everything before the last dot).
    const t = window.setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const dot = initialName.lastIndexOf('.');
      if (dot > 0) {
        el.setSelectionRange(0, dot);
      } else {
        el.select();
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, initialName]);

  if (!open) return null;

  const doSubmit = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('名前を入力してください');
      return;
    }
    if (trimmed === initialName) {
      onCancel();
      return;
    }
    if (/[\\/:*?"<>|]/.test(trimmed)) {
      setError('使用できない文字が含まれています');
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void doSubmit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          disabled={submitting}
          className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
        {error && (
          <p className="mt-2 text-xs text-rose-600">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => void doSubmit()}
            disabled={submitting}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? '処理中…' : '変更'}
          </button>
        </div>
      </div>
    </div>
  );
}
