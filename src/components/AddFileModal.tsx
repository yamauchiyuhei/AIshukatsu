import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Workspace } from '../types';
import { LocationPicker, TargetLocation } from './LocationPicker';
import { ensureMdExtension } from '../lib/fs';

interface Props {
  workspace: Workspace;
  onClose: () => void;
  onSubmit: (location: TargetLocation, fileName: string) => Promise<void>;
}

const FORBIDDEN = /[\\/:*?"<>|]/;

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'ファイル名を入力してください';
  if (FORBIDDEN.test(trimmed))
    return '使用できない文字が含まれています ( \\ / : * ? " < > | )';
  if (trimmed.length > 120) return 'ファイル名が長すぎます';
  return null;
}

export function AddFileModal({ workspace, onClose, onSubmit }: Props) {
  const [location, setLocation] = useState<TargetLocation>({ path: [] });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const previewName = useMemo(
    () => (name.trim() ? ensureMdExtension(name) : ''),
    [name],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) {
      setError('作成先を選択してください');
      return;
    }
    const v = validateName(name);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(location, name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">ファイルを追加</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <LocationPicker
            workspace={workspace}
            value={location}
            onChange={setLocation}
          />

          <label className="mt-4 block text-sm font-medium text-slate-700">
            ファイル名
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: メモ (拡張子なしで .md を自動付与)"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
          />
          {previewName && previewName !== name.trim() && (
            <p className="mt-1 text-xs text-slate-500">
              実際のファイル名: <span className="font-mono">{previewName}</span>
            </p>
          )}

          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          <p className="mt-2 text-xs text-slate-500">
            拡張子を省略すると <code>.md</code> を自動付与します。
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? '作成中…' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
