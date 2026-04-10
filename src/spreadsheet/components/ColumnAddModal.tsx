import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ColumnType } from '../types/sheet';
import { useSheet } from '../lib/store';

const TYPE_LABELS: Record<ColumnType, string> = {
  text: '短いテキスト',
  longtext: '長いテキスト',
  date: '日付',
  datetime: '日時',
  select: '選択肢',
  rating: '評価 (★1-5)',
  url: 'URL',
  checkbox: 'チェックボックス',
  password: 'パスワード',
};

export function ColumnAddModal({ onClose }: { onClose: () => void }) {
  const addColumn = useSheet((s) => s.addColumn);
  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('text');
  const [optionsText, setOptionsText] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    if (!name.trim()) return;
    const options =
      type === 'select'
        ? optionsText
            .split(/[,、\n]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    addColumn({ name: name.trim(), type, options, width: 130 });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-[420px] overflow-hidden rounded-2xl bg-white shadow-2xl animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">列を追加</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 px-5 pb-4 pt-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">列名</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              placeholder="例: OB訪問"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">種類</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ColumnType)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {type === 'select' && (
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">
                選択肢 (カンマ区切り)
              </span>
              <textarea
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white"
                rows={3}
                placeholder="A, B, C"
              />
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/40 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            キャンセル
          </button>
          <button
            onClick={submit}
            className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:bg-slate-300"
            disabled={!name.trim()}
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
