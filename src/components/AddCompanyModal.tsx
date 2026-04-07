import { useState } from 'react';
import { X } from 'lucide-react';
import { Category } from '../types';

interface Props {
  categories: Category[];
  defaultCategory?: string;
  onClose: () => void;
  onSubmit: (categoryName: string, companyName: string) => Promise<void>;
}

const FORBIDDEN = /[\\/:*?"<>|]/;

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return '企業名を入力してください';
  if (FORBIDDEN.test(trimmed)) return '使用できない文字が含まれています ( \\ / : * ? " < > | )';
  if (trimmed.length > 80) return '企業名が長すぎます';
  return null;
}

export function AddCompanyModal({
  categories,
  defaultCategory,
  onClose,
  onSubmit,
}: Props) {
  const [categoryName, setCategoryName] = useState(
    defaultCategory ?? categories[0]?.name ?? '',
  );
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName) {
      setError('カテゴリを選択してください');
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
      await onSubmit(categoryName, name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">企業を追加</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">カテゴリ</label>
          {categories.length === 0 ? (
            <p className="mt-1 text-sm text-rose-600">
              カテゴリ (業界フォルダ) が見つかりません。先にルート直下にカテゴリフォルダを作成してください。
            </p>
          ) : (
            <select
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-slate-500 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <label className="mt-4 block text-sm font-medium text-slate-700">企業名</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 株式会社サンプル"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
          />

          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          <p className="mt-2 text-xs text-slate-500">
            選択したカテゴリ配下に企業フォルダを作成し、`_テンプレート/企業名_テンプレート/` の内容をコピーします。
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
              disabled={busy || categories.length === 0}
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
