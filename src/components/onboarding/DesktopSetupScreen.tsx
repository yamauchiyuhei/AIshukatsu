import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { pickRootDirectory } from '../../lib/fs';
import { OnboardingShell } from './LoginScreen';

interface Props {
  onReady: (handle: FileSystemDirectoryHandle) => void;
}

const EXPECTED_NAME = 'AI就活';

export function DesktopSetupScreen({ onReady }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameWarning, setNameWarning] = useState<string | null>(null);

  const handlePick = async () => {
    setBusy(true);
    setError(null);
    setNameWarning(null);
    try {
      // Open the native picker already positioned at Desktop. The user has
      // already created the "AI就活" folder there (we just instructed them to),
      // so they can pick it directly — Chrome only blocks picking the Desktop
      // root itself, not user-created subfolders inside it. Works on iCloud
      // Desktop and any other parent location.
      const picked = await pickRootDirectory({ startIn: 'desktop' });
      // Soft validation: warn if the folder isn't named "AI就活", but still
      // accept it so power users can choose an alternative name.
      if (picked.name !== EXPECTED_NAME) {
        setNameWarning(
          `選択されたフォルダ「${picked.name}」は "${EXPECTED_NAME}" ではありませんが、そのまま使用します。問題なければ次へ進めます。`,
        );
      }
      onReady(picked);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setBusy(false);
        return;
      }
      if (
        e instanceof DOMException &&
        (e.name === 'SecurityError' || e.name === 'NotAllowedError')
      ) {
        setError(
          'そのフォルダはブラウザの制限で開けません。親フォルダ (デスクトップ等) ではなく、その中に作成した「AI就活」フォルダを選択してください。',
        );
        setBusy(false);
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <OnboardingShell step={2} total={4}>
      <h1 className="text-2xl font-bold text-slate-900">
        「AI就活」フォルダを作成してください
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        就活情報の保存先となるフォルダを用意します。
        <br />
        次の 2 ステップだけで完了します。
      </p>

      <ol className="mt-6 space-y-3 text-left">
        <li className="flex gap-3 rounded-lg bg-slate-50 p-4">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
            1
          </span>
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              Finder でお好きな場所 (デスクトップ推奨) に{' '}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-indigo-700 ring-1 ring-slate-200">
                AI就活
              </code>{' '}
              という名前のフォルダを作成
            </p>
            <p className="mt-1 text-xs text-slate-500">
              例: デスクトップで右クリック → 新規フォルダ → 「AI就活」と入力
            </p>
          </div>
        </li>
        <li className="flex gap-3 rounded-lg bg-slate-50 p-4">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
            2
          </span>
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              下のボタンから、作成した「AI就活」フォルダを選択
            </p>
            <p className="mt-1 text-xs text-slate-500">
              以降、企業の情報はすべてこのフォルダの中に保存されます。
            </p>
          </div>
        </li>
      </ol>

      <div className="mt-8">
        <button
          onClick={handlePick}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-white shadow hover:bg-slate-800 disabled:opacity-60"
        >
          <FolderOpen size={18} />
          {busy ? '選択待ち…' : '作成した AI就活 フォルダを選択'}
        </button>
        {nameWarning && (
          <p className="mt-3 text-xs text-amber-700">{nameWarning}</p>
        )}
        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
      </div>
    </OnboardingShell>
  );
}
