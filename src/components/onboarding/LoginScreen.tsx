import { useState } from 'react';
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
}

export function LoginScreen({ user, onNext, variant = 'onboarding' }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);

  const handleLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      // Auth listener in App.tsx will flip `user` to non-null; onNext is
      // invoked by the OnboardingFlow effect once that happens.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingShell step={variant === 'onboarding' ? 1 : null} total={4}>
      <div className="mx-auto mb-4 h-20 w-20">
        <img
          src="/logo.png"
          alt="AI就活"
          className="h-full w-full rounded-2xl object-contain"
        />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">AI就活へようこそ</h1>
      <p className="mt-3 text-sm text-slate-600">
        まずは Google アカウントでログインしてください。
        <br />
        データは引き続きあなたの PC に保存されます。
        <br />
        ログインはスプレッドシート同期のために利用します。
      </p>

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
        <div className="mt-8">
          <button
            onClick={handleLogin}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-white shadow hover:bg-slate-800 disabled:opacity-60"
          >
            <LogIn size={18} />
            {busy ? 'ログイン中…' : 'Google でログイン'}
          </button>
          {error && (
            <p className="mt-3 text-xs text-rose-600">{error}</p>
          )}
        </div>
      )}

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
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-xl rounded-2xl bg-white p-10 text-center shadow-lg ring-1 ring-slate-200">
        {step !== null && <StepIndicator step={step} total={total} />}
        {children}
      </div>
    </div>
  );
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
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
