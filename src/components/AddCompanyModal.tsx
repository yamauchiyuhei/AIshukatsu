import { useState } from 'react';
import { X } from 'lucide-react';
import { Workspace } from '../types';
import { CompanyCombobox } from './CompanyCombobox';
import { LocationPicker, TargetLocation } from './LocationPicker';
import { lookupIndustry } from '../lib/companyIndustryMap';
import { collectFolders } from '../lib/workspace';

interface Props {
  workspace: Workspace;
  /** Master list of company names for autocomplete suggestions. */
  companySuggestions?: string[];
  onClose: () => void;
  onSubmit: (parentPath: string[], companyName: string) => Promise<void>;
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
  workspace,
  companySuggestions = [],
  onClose,
  onSubmit,
}: Props) {
  const [location, setLocation] = useState<TargetLocation>({ path: [] });
  const [userTouchedLocation, setUserTouchedLocation] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Auto-select the matching folder when the typed/picked company name maps
  // to a known industry AND the user hasn't manually picked a target yet.
  // Searches the entire tree (depth-first) and prefers the shallowest match,
  // which naturally picks top-level industry folders when present but still
  // works inside nested structures like `2026卒/メーカー/`.
  const tryAutoFillLocation = (companyName: string) => {
    if (userTouchedLocation) return;
    const industry = lookupIndustry(companyName);
    if (!industry) return;
    const industryNfkc = industry.normalize('NFKC');
    const all = collectFolders(workspace.tree);
    let best: { path: string[]; depth: number } | null = null;
    for (const f of all) {
      if (
        f.name === industry ||
        f.name.normalize('NFKC') === industryNfkc
      ) {
        const depth = f.path.length;
        if (!best || depth < best.depth) {
          best = { path: f.path, depth };
        }
      }
    }
    if (best) setLocation({ path: best.path });
  };

  const handleLocationChange = (next: TargetLocation) => {
    setUserTouchedLocation(true);
    setLocation(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateName(name);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSubmit(location.path, name.trim());
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
          <LocationPicker
            workspace={workspace}
            value={location}
            onChange={handleLocationChange}
          />

          <label className="mt-4 block text-sm font-medium text-slate-700">企業名</label>
          <CompanyCombobox
            value={name}
            onChange={(v) => {
              setName(v);
              tryAutoFillLocation(v);
            }}
            onSelect={(picked) => tryAutoFillLocation(picked)}
            suggestions={companySuggestions}
            placeholder="例: アサヒ飲料 (入力で候補を絞り込み)"
            autoFocus
          />

          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          <p className="mt-2 text-xs text-slate-500">
            選択した場所に企業フォルダを作成し、`_テンプレート/企業名_テンプレート/` の内容をコピーします。
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
