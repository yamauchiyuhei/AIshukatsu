import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';

interface Props {
  open: boolean;
  /** Pre-filled name (including extension). */
  initialName: string;
  title?: string;
  onCancel: () => void;
  onSubmit: (newName: string) => Promise<void> | void;
}

/**
 * Rename prompt dialog. Auto-selects the file stem on mount so typing
 * replaces the base name while keeping the extension — matches
 * Finder / VSCode behaviour.
 *
 * Layered on the shared {@link Modal} + {@link Input} + {@link Button}
 * primitives; submit/cancel behaviour is unchanged.
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
    <Modal open={open} onClose={onCancel} ariaLabel={title}>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <Input
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
        className="mt-3"
      />
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          キャンセル
        </Button>
        <Button
          size="sm"
          onClick={() => void doSubmit()}
          disabled={submitting}
        >
          {submitting ? '処理中…' : '変更'}
        </Button>
      </div>
    </Modal>
  );
}
