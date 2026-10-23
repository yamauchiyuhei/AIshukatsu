import { useState, type FormEvent } from 'react';
import { loadCategory, clearCache } from './lib/loader';

interface Props {
  onUnlock: (password: string) => void;
}

export function TgWebGate({ onUnlock }: Props) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Probe with TG-WEB の言語データ（最も古くからある安定パス）でパス検証
      await loadCategory('tgweb', 'gengo', input);
      onUnlock(input);
    } catch (err) {
      clearCache();
      const name = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : String(err);
      const isDecryptFail = name === 'OperationError' || /decrypt/i.test(msg);
      if (isDecryptFail) {
        setError('パスワードが正しくありません');
      } else {
        setError(`読み込みエラー: ${msg || name || 'unknown'}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <header className="space-y-1">
          <h1 className="text-lg font-semibold text-slate-900">
            Webテスト 回答検索
          </h1>
          <p className="text-sm text-slate-500">
            パスワードを入力してください。
          </p>
        </header>
        <input
          type="password"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder="パスワード"
          className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none disabled:opacity-60"
        />
        {error && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !input}
          className="w-full rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? '解錠中…' : '開く'}
        </button>
      </form>
    </div>
  );
}
