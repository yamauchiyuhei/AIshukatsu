import { OnboardingShell } from './LoginScreen';
import industryCompanies from '../../data/industryCompanies.json';

interface Props {
  selected: string[];
  onToggle: (industry: string) => void;
  onNext: () => void;
  onBack?: () => void;
}

// Use the keys of the curated JSON so that the screen always stays in sync
// with the data file (also happens to match presetColumns.ts's 12 industries).
const INDUSTRIES = Object.keys(industryCompanies);

export function IndustrySelectScreen({ selected, onToggle, onNext, onBack }: Props) {
  const canProceed = selected.length > 0;

  return (
    <OnboardingShell step={3} total={4}>
      <h1 className="text-2xl font-bold text-slate-900">
        興味のある業界を選んでください
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        複数選択できます。次の画面で各業界の代表的な企業を選べます。
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 text-left">
        {INDUSTRIES.map((name) => {
          const isSelected = selected.includes(name);
          return (
            <button
              key={name}
              onClick={() => onToggle(name)}
              className={`rounded-lg border px-4 py-3 text-sm transition-colors ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-slate-300'
                  }`}
                >
                  {isSelected && (
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="3.5,8.5 6.5,11.5 12.5,5" />
                    </svg>
                  )}
                </span>
                <span className="font-medium">{name}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        {onBack ? (
          <button
            onClick={onBack}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            戻る
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="rounded-lg bg-slate-900 px-5 py-3 text-white shadow hover:bg-slate-800 disabled:opacity-40"
        >
          次へ ({selected.length})
        </button>
      </div>
    </OnboardingShell>
  );
}
