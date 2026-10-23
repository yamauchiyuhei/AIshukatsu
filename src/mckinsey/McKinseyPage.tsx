import { useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Sun, Lock } from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { QuestionDrawer } from './components/QuestionDrawer';
import { loadInterview, clearInterviewCache } from './lib/loader';
import { useWakeLock } from './lib/useWakeLock';
import type { Question } from './types';

interface Props {
  password: string;
  onLock: () => void;
}

const CURRENT_ID_KEY = 'mckinsey-current-id';

export function McKinseyPage({ password, onLock }: Props) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string>(() => {
    try {
      return sessionStorage.getItem(CURRENT_ID_KEY) ?? 'Q0';
    } catch {
      return 'Q0';
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wakeLockOn, setWakeLockOn] = useState(true);
  const articleRef = useRef<HTMLDivElement>(null);

  const wakeStatus = useWakeLock(wakeLockOn);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadInterview(password)
      .then((qs) => {
        if (!cancelled) setQuestions(qs);
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
  }, [password]);

  useEffect(() => {
    try {
      sessionStorage.setItem(CURRENT_ID_KEY, currentId);
    } catch {
      /* ignore */
    }
    if (articleRef.current) {
      articleRef.current.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [currentId]);

  const { current, prev, next } = useMemo(() => {
    if (!questions || questions.length === 0) {
      return { current: null, prev: null, next: null };
    }
    const idx = Math.max(
      0,
      questions.findIndex((q) => q.id === currentId),
    );
    return {
      current: questions[idx],
      prev: idx > 0 ? questions[idx - 1] : null,
      next: idx < questions.length - 1 ? questions[idx + 1] : null,
    };
  }, [questions, currentId]);

  const handleLock = () => {
    clearInterviewCache();
    onLock();
  };

  const wakeLabel =
    wakeStatus === 'active'
      ? '画面オン保持中'
      : wakeStatus === 'unsupported'
        ? 'この端末は非対応'
        : wakeStatus === 'error'
          ? '取得失敗'
          : wakeLockOn
            ? '準備中'
            : 'OFF';

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="目次を開く"
            className="-ml-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
            <span className="text-sm font-medium">目次</span>
          </button>
          <h1 className="truncate text-sm font-semibold text-slate-900">
            マッキンゼー Q&A
          </h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWakeLockOn((v) => !v)}
              title={wakeLabel}
              aria-label={`画面オン保持 ${wakeLockOn ? 'ON' : 'OFF'}`}
              className={`rounded-md p-2 transition ${
                wakeStatus === 'active'
                  ? 'bg-amber-100 text-amber-700'
                  : wakeLockOn
                    ? 'text-slate-400'
                    : 'text-slate-300'
              }`}
            >
              <Sun className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleLock}
              aria-label="ロック"
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <Lock className="h-5 w-5" />
            </button>
          </div>
        </div>
        {/* Current question header */}
        {current && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="block w-full border-t border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
          >
            <div className="mx-auto max-w-screen-sm">
              {current.category && (
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {current.id} · {current.category}
                </p>
              )}
              {!current.category && (
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {current.id}
                </p>
              )}
              <p className="text-base font-semibold text-slate-900">
                {current.title}
              </p>
            </div>
          </button>
        )}
      </header>

      <main
        ref={articleRef}
        className="mx-auto w-full max-w-screen-sm flex-1 px-4 py-5"
      >
        {loading && (
          <p className="py-16 text-center text-sm text-slate-400">読み込み中…</p>
        )}
        {err && !loading && (
          <p className="rounded-md bg-rose-50 px-3 py-3 text-sm text-rose-700">
            {err}
          </p>
        )}
        {!loading && !err && current && (
          <article
            className="mckinsey-prose text-slate-800"
            dangerouslySetInnerHTML={{ __html: current.html }}
          />
        )}
      </main>

      <BottomNav prev={prev} next={next} onSelect={setCurrentId} />

      {questions && (
        <QuestionDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          questions={questions}
          currentId={currentId}
          onSelect={setCurrentId}
        />
      )}
    </div>
  );
}
