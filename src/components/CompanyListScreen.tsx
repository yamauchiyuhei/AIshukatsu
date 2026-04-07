import { useMemo, useState } from 'react';
import { ArrowUpDown, FolderOpen, Plus, RefreshCw } from 'lucide-react';
import { Company } from '../types';
import { StatusBadge } from './StatusBadge';

type SortKey = 'name' | 'status' | 'next_date' | 'updated';
type SortDir = 'asc' | 'desc';

interface Props {
  rootName: string;
  companies: Company[];
  loading: boolean;
  error: string | null;
  onSelectCompany: (c: Company) => void;
  onAddCompany: () => void;
  onRefresh: () => void;
  onChangeFolder: () => void;
}

export function CompanyListScreen({
  rootName,
  companies,
  loading,
  error,
  onSelectCompany,
  onAddCompany,
  onRefresh,
  onChangeFolder,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    const arr = [...companies];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.frontmatter.company_name.localeCompare(b.frontmatter.company_name, 'ja');
          break;
        case 'status':
          cmp = a.frontmatter.status.localeCompare(b.frontmatter.status, 'ja');
          break;
        case 'next_date':
          cmp = (a.frontmatter.next_action_date ?? '').localeCompare(
            b.frontmatter.next_action_date ?? '',
          );
          break;
        case 'updated':
          cmp = a.frontmatter.updated_at.localeCompare(b.frontmatter.updated_at);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [companies, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const headerCell = (label: string, key: SortKey, className = '') => (
    <th className={`px-4 py-3 text-left font-medium text-slate-600 ${className}`}>
      <button
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 hover:text-slate-900"
      >
        {label}
        <ArrowUpDown size={12} className="opacity-60" />
      </button>
    </th>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">AIsyuukatsu</h1>
            <button
              onClick={onChangeFolder}
              className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <FolderOpen size={12} />
              {rootName}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              更新
            </button>
            <button
              onClick={onAddCompany}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
            >
              <Plus size={14} />
              企業を追加
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">読み込み中…</p>
        ) : sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-600">まだ企業が登録されていません。</p>
            <button
              onClick={onAddCompany}
              className="mt-4 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
            >
              <Plus size={14} />
              最初の企業を追加
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase">
                <tr>
                  {headerCell('企業名', 'name')}
                  {headerCell('ステータス', 'status')}
                  <th className="px-4 py-3 text-left font-medium text-slate-600">次回アクション</th>
                  {headerCell('期限', 'next_date')}
                  {headerCell('最終更新', 'updated')}
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => (
                  <tr
                    key={c.folderName}
                    onClick={() => onSelectCompany(c)}
                    className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {c.frontmatter.company_name}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.frontmatter.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {c.frontmatter.next_action_label ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {c.frontmatter.next_action_date ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.frontmatter.updated_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
