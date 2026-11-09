import { useIncomingArticle } from '../../hooks/useIncomingArticle';
import { enableLocalMode } from '../../lib/preferences';
import { isTauri } from '../../lib/tauriFsaShim';
import { useState, useRef, useEffect } from 'react';
import { LogIn } from 'lucide-react';
import { signInWithGoogle, firebaseEnabled } from '../../spreadsheet/lib/firebase';
import type { User } from '../../spreadsheet/lib/firebase';
import { LegalModal } from './LegalModal';
import { TERMS_OF_SERVICE, PRIVACY_POLICY } from '../../data/legal';

interface Props {
  user: User | null;
  onNext: () => void;
  /**
   * 'onboarding' (default): rendered as step 1 of the initial setup flow,
   * with a step indicator visible.
   * 'gate': rendered as a standalone auth gate after sign-out, with the
   * step indicator hidden.
   */
  variant?: 'onboarding' | 'gate';
  showWebsiteLinks?: boolean;
}

export function LoginScreen({ user, onNext, variant = 'onboarding', showWebsiteLinks = false }: Props) {
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);

  const handleLogin = async () => {
    controller.current = new AbortController();
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle(controller.current.signal);
      // Auth listener in App.tsx will flip `user` to non-null; onNext is
      // invoked by the OnboardingFlow effect once that happens.
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError('ログインできませんでした。接続とブラウザのポップアップ設定を確認し、もう一度お試しください。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingShell step={null} total={4}>
      <div className="mx-auto mb-4 h-20 w-20">
        <img
          src="/logo.png"
          alt="AI就活"
          className="h-full w-full rounded-2xl object-contain"
        />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">AI就活へようこそ</h1>
      <p className="mt-3 text-sm text-slate-600">
        利用方法を選んでください。Googleでログインすると、任意のクラウドバックアップを利用できます。
      </p>

      <ol className="mt-5 grid gap-2 rounded-xl bg-slate-50 p-4 text-left text-sm text-slate-700" aria-label="使い始めるまでの流れ"><li>1. PC内の保存先フォルダを選ぶ</li><li>2. 気になる企業のメモを用意する（後からでも可）</li><li>3. 選考管理の表に、次の締切を記入する</li></ol>
      {!firebaseEnabled ? (
        <div className="mt-8 rounded-lg bg-amber-50 p-4 text-left text-sm text-amber-800">
          Firebase が設定されていないため、ログインはスキップされます。
          <div className="mt-3">
            <button
              onClick={onNext}
              className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
            >
              次へ
            </button>
          </div>
        </div>
      ) : user ? (
        <div className="mt-8">
          <p className="text-sm text-emerald-700">
            {user.displayName ?? user.email ?? 'ログイン済み'} としてログイン中
          </p>
          <button
            onClick={onNext}
            className="mt-4 rounded-lg bg-slate-900 px-5 py-3 text-white shadow hover:bg-slate-800"
          >
            次へ
          </button>
        </div>
      ) : (
        <div className="mx-auto mt-6 grid max-w-xs gap-3">
          <button type="button" className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-900 hover:bg-slate-50" onClick={enableLocalMode}>ログインせず、この端末だけで使う</button>
          <button
            onClick={handleLogin}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <LogIn size={18} />
            {busy ? 'ログイン中…' : 'Google でログイン'}
          </button>
          {busy && isTauri() && <button className="ml-3 text-sm underline" onClick={() => controller.current?.abort()}>ログインをキャンセル</button>}
          {error && (
            <p className="mt-3 text-xs text-rose-600">{error}</p>
          )}
        </div>
      )}

      {!user && !firebaseEnabled && <button type="button" className="mt-5 text-sm text-indigo-700 underline" onClick={enableLocalMode}>ログインせず、この端末だけで使う</button>}
      {!isTauri() && typeof window.showDirectoryPicker !== 'function' && <p role="alert" className="mt-4 text-sm text-amber-800">保存フォルダの操作にはChrome・Edge、またはデスクトップ版が必要です。<a href="/#download" className="underline">ダウンロード案内</a></p>}
      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        ログインすることで、
        <button
          type="button"
          onClick={() => setLegal('terms')}
          className="underline hover:text-slate-700"
        >
          利用規約
        </button>
        および
        <button
          type="button"
          onClick={() => setLegal('privacy')}
          className="underline hover:text-slate-700"
        >
          プライバシーポリシー
        </button>
        に同意したものとみなされます。
      </p>

      {showWebsiteLinks && <nav aria-label="サイトへのリンク" className="mt-6 flex justify-center gap-6 text-xs text-slate-600"><a href="/" className="underline underline-offset-4 hover:text-slate-900">サイト紹介に戻る</a><a href="/magazine/" className="underline underline-offset-4 hover:text-slate-900">マガジンを読む</a></nav>}

      {legal === 'terms' && (
        <LegalModal
          title="利用規約"
          body={TERMS_OF_SERVICE}
          onClose={() => setLegal(null)}
        />
      )}
      {legal === 'privacy' && (
        <LegalModal
          title="プライバシーポリシー"
          body={PRIVACY_POLICY}
          onClose={() => setLegal(null)}
        />
      )}
    </OnboardingShell>
  );
}

/** Shared layout shell so every onboarding step has the same centered card. */
export function OnboardingShell({
  children,
  step,
  total,
}: {
  children: React.ReactNode;
  /** Pass `null` to hide the step indicator (used by the standalone auth gate). */
  step: number | null;
  total: number;
}) {
  const {request} = useIncomingArticle();
  return (
    <div className="flex min-h-dvh items-center justify-center overflow-auto bg-slate-50 px-4 py-8">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 sm:p-8 text-center shadow-lg ring-1 ring-slate-200">
        {step !== null && <><StepIndicator step={step} total={total} /><p className="mb-5 text-sm text-slate-600">{step} / {total}　{['保存先','業界','企業','メモの準備'][step-1]}{step === 2 || step === 3 ? '（あとで設定できます）' : ''}</p></>}
        {request && <p className="mb-4 rounded-lg bg-indigo-50 p-3 text-sm leading-6 text-indigo-800">記事からの研究メモを受け取りました。ログインや保存先の設定後に、内容を確認して作成できます。</p>}
        {children}
      </div>
    </div>
  );
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2" aria-label={`セットアップ ${step} / ${total}`} role="status">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 w-10 rounded-full transition-colors ${
            i < step ? 'bg-indigo-600' : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}
