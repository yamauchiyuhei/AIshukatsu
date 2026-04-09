import { X } from 'lucide-react';
import { useEffect } from 'react';

interface Props {
  title: string;
  body: string;
  onClose: () => void;
}

/**
 * Full-screen overlay modal used to show the Terms of Service and Privacy
 * Policy text from the login screen. Kept intentionally simple: no markdown
 * rendering, no external deps — body text is shown verbatim with preserved
 * line breaks via `whitespace-pre-wrap`.
 */
export function LegalModal({ title, body, onClose }: Props) {
  // Close on Escape so keyboard users aren't trapped.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">
          <pre
            className="select-none whitespace-pre-wrap break-words text-left font-sans text-sm leading-relaxed text-slate-700"
            style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          >
            {body}
          </pre>
        </div>
        <div className="border-t border-slate-200 px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
