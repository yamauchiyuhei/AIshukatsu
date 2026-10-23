import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { CategoryTabs } from './components/CategoryTabs';
import { SearchBox } from './components/SearchBox';
import { ResultCard } from './components/ResultCard';
import { clearCache, loadCategory } from './lib/loader';
import { searchItems } from './lib/search';
import { findTest, type TestType, type TgWebItem } from './types';

interface Props {
  testType: TestType;
  password: string;
  onBack: () => void;
  onLock: () => void;
}

export function TgWebSearchPage({ testType, password, onBack, onLock }: Props) {
  const test = findTest(testType);
  const [category, setCategory] = useState<string>(test.categories[0].key);
  const [items, setItems] = useState<TgWebItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [includeLow, setIncludeLow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset selected category when switching test type (in case the previous
  // test had a category that doesn't exist in the new one).
  useEffect(() => {
    setCategory(test.categories[0].key);
    setQuery('');
  }, [testType, test]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setItems(null);
    loadCategory(testType, category, password)
      .then((loaded) => {
        if (!cancelled) setItems(loaded);
      })
      .catch((e) => {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setErr(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [testType, category, password]);

  const results = useMemo(() => {
    if (!items) return [];
    return searchItems(items, debouncedQuery, includeLow);
  }, [items, debouncedQuery, includeLow]);

  const poolSize = useMemo(() => {
    if (!items) return 0;
    return includeLow
      ? items.length
      : items.filter((it) => it.rank !== 'D' && it.rank !== 'N').length;
  }, [items, includeLow]);

  const handleLock = () => {
    clearCache();
    onLock();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-sm items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 flex items-center rounded-md px-1.5 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="テスト選択へ戻る"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="ml-0.5">戻る</span>
          </button>
          <h1 className="ml-1 truncate text-base font-semibold text-slate-900">
            {test.label} 回答検索
          </h1>
          <button
            type="button"
            onClick={handleLock}
            className="ml-auto rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            ロック
          </button>
        </div>
        <div className="mx-auto max-w-screen-sm space-y-3 px-4 pb-3">
          <CategoryTabs
            categories={test.categories}
            value={category}
            onChange={setCategory}
          />
          <SearchBox value={query} onChange={setQuery} />
        </div>
      </header>

      <main className="mx-auto max-w-screen-sm px-4 pt-4">
        <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={includeLow}
            onChange={(e) => setIncludeLow(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
          />
          低信頼度 (D / N) も表示
        </label>

        {loading && (
          <p className="py-16 text-center text-sm text-slate-400">
            読み込み中…
          </p>
        )}
        {err && !loading && (
          <p className="rounded-md bg-rose-50 px-3 py-3 text-sm text-rose-700">
            {err}
          </p>
        )}
        {!loading && !err && items && (
          <>
            <p className="mb-2 text-xs text-slate-400">
              {results.length} 件表示 / 対象 {poolSize} 件
            </p>
            <ul className="space-y-3">
              {results.map((item) => (
                <li key={item.id}>
                  <ResultCard item={item} />
                </li>
              ))}
            </ul>
            {results.length === 0 && debouncedQuery && (
              <p className="py-16 text-center text-sm text-slate-400">
                該当なし
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
