import { OnboardingShell } from './LoginScreen';

export interface GenerationFailure {
  industry: string;
  name: string;
  reason: string;
}

interface Props {
  progress: number;
  total: number;
  currentName: string | null;
  failures: GenerationFailure[];
  done: boolean;
  onFinish: () => void;
}

export function GeneratingScreen({
  progress,
  total,
  currentName,
  failures,
  done,
  onFinish,
}: Props) {
  const pct = total === 0 ? 0 : Math.round((progress / total) * 100);

  return (
    <OnboardingShell step={4} total={4}>
      <h1 className="text-2xl font-bold text-slate-900">
        {done ? 'セットアップ完了' : 'フォルダを作成しています…'}
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        {done
          ? `${progress - failures.length} 社分のフォルダとテンプレートを作成しました。`
          : `${progress} / ${total} 社`}
      </p>

      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>

      {!done && currentName && (
        <p className="mt-3 text-xs text-slate-500">作成中: {currentName}</p>
      )}

      {done && failures.length > 0 && (
        <div className="mt-5 rounded-lg bg-amber-50 p-4 text-left text-xs text-amber-800">
          <p className="font-semibold">
            {failures.length} 件のフォルダ作成に失敗しました
          </p>
          <ul className="mt-2 list-disc pl-5">
            {failures.slice(0, 5).map((f) => (
              <li key={`${f.industry}::${f.name}`}>
                {f.name} ({f.industry}) — {f.reason}
              </li>
            ))}
            {failures.length > 5 && <li>…他 {failures.length - 5} 件</li>}
          </ul>
        </div>
      )}

      {done && (
        <div className="mt-8">
          <button
            onClick={onFinish}
            className="rounded-lg bg-slate-900 px-5 py-3 text-white shadow hover:bg-slate-800"
          >
            はじめる
          </button>
        </div>
      )}
    </OnboardingShell>
  );
}
