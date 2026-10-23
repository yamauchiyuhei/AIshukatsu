import { TESTS, type TestType } from './types';

interface Props {
  onSelect: (testType: TestType) => void;
  onLock: () => void;
}

export function TestSelectScreen({ onSelect, onLock }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4 py-3">
          <h1 className="text-base font-semibold text-slate-900">
            Webテスト 回答検索
          </h1>
          <button
            type="button"
            onClick={onLock}
            className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            ロック
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-screen-sm px-4 pt-6">
        <p className="mb-4 text-sm text-slate-500">
          受験中のテストを選んでください。
        </p>
        <ul className="grid grid-cols-2 gap-3">
          {TESTS.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                onClick={() => onSelect(t.key)}
                className="flex h-full w-full flex-col items-start gap-1 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-900 hover:shadow active:scale-[0.99]"
              >
                <span className="text-base font-semibold text-slate-900">
                  {t.label}
                </span>
                <span className="text-xs text-slate-500">
                  {t.categories.length} カテゴリ
                </span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
