import { useEffect, useRef, useState } from 'react';
import { Building2, FilePlus, FolderPlus, Plus } from 'lucide-react';

interface Props {
  onAddCompany: () => void;
  onAddFolder: () => void;
  onAddFile: () => void;
}

/**
 * The "+" button in the sidebar header. Click opens a popover with three
 * choices: add company / add folder / add file. Closes on outside click,
 * Escape, or after a choice is made.
 */
export function AddMenu({ onAddCompany, onAddFolder, onAddFile }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const choose = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="追加"
        className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <Plus size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
          <button
            type="button"
            onClick={() => choose(onAddCompany)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
          >
            <Building2 size={14} className="text-slate-500" />
            企業を追加
          </button>
          <button
            type="button"
            onClick={() => choose(onAddFolder)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
          >
            <FolderPlus size={14} className="text-slate-500" />
            フォルダを追加
          </button>
          <button
            type="button"
            onClick={() => choose(onAddFile)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100"
          >
            <FilePlus size={14} className="text-slate-500" />
            ファイルを追加
          </button>
        </div>
      )}
    </div>
  );
}
