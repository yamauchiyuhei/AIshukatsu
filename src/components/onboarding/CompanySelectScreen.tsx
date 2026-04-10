import { useMemo, useState } from 'react';
import { OnboardingShell } from './LoginScreen';
import industryCompaniesJson from '../../data/industryCompanies.json';

const industryCompanies = industryCompaniesJson as Record<string, string[]>;

export interface SelectedCompany {
  industry: string;
  name: string;
}

interface Props {
  industries: string[];
  selected: SelectedCompany[];
  onToggle: (pick: SelectedCompany) => void;
  onSelectAllFor: (industry: string) => void;
  onClearAllFor: (industry: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function CompanySelectScreen({
  industries,
  selected,
  onToggle,
  onSelectAllFor,
  onClearAllFor,
  onBack,
  onSubmit,
}: Props) {
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(
    () => new Set(selected.map((s) => `${s.industry}::${s.name}`)),
    [selected],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return industries.map((ind) => ({
      industry: ind,
      companies: (industryCompanies[ind] ?? []).filter((name) =>
        q === '' ? true : name.toLowerCase().includes(q),
      ),
    }));
  }, [industries, query]);

  const canSubmit = selected.length > 0;

  return (
    <OnboardingShell step={4} total={4}>
      <h1 className="text-2xl font-bold text-slate-900">
        気になる企業を選んでください
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        チェックした企業のフォルダを自動作成します (後から追加・削除できます)。
      </p>

      <div className="mt-5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="企業名で絞り込み…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      <div className="mt-4 max-h-[46vh] overflow-y-auto rounded-lg border border-slate-200 bg-white text-left">
        {filtered.map(({ industry, companies }) => (
          <section key={industry} className="border-b border-slate-100 last:border-b-0">
            <header className="sticky top-0 flex items-center justify-between bg-slate-50/95 px-4 py-2 backdrop-blur">
              <h2 className="text-sm font-semibold text-slate-700">{industry}</h2>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => onSelectAllFor(industry)}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  すべて選択
                </button>
                <button
                  onClick={() => onClearAllFor(industry)}
                  className="text-slate-500 hover:text-slate-700"
                >
                  すべて解除
                </button>
              </div>
            </header>
            {companies.length === 0 ? (
              <p className="px-4 py-3 text-xs text-slate-400">該当なし</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {companies.map((name) => {
                  const key = `${industry}::${name}`;
                  const checked = selectedSet.has(key);
                  return (
                    <li key={key}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggle({ industry, name })}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                        />
                        <span className="text-slate-800">{name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          戻る
        </button>
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="rounded-lg bg-slate-900 px-5 py-3 text-white shadow hover:bg-slate-800 disabled:opacity-40"
        >
          {selected.length} 社のフォルダを作成
        </button>
      </div>
    </OnboardingShell>
  );
}
