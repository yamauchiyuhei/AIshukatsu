import { useEffect } from 'react';
import { create } from 'zustand';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience helper accessible from anywhere (not just React). */
export const toast = {
  info: (m: string) => useToastStore.getState().push('info', m),
  success: (m: string) => useToastStore.getState().push('success', m),
  warn: (m: string) => useToastStore.getState().push('warn', m),
  error: (m: string) => useToastStore.getState().push('error', m),
};

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
};
const COLORS: Record<ToastKind, string> = {
  info: 'text-slate-600 bg-white',
  success: 'text-emerald-700 bg-white',
  warn: 'text-amber-700 bg-white',
  error: 'text-rose-700 bg-white',
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex min-w-[220px] max-w-sm items-start gap-2 rounded-xl border border-slate-200/70 px-3 py-2 text-xs shadow-lg animate-toast-in ${COLORS[t.kind]}`}
          >
            <Icon size={14} className="mt-0.5 shrink-0" />
            <div className="flex-1 leading-5">{t.message}</div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-slate-400 hover:text-slate-700"
              title="閉じる"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Lightweight confirm modal (replaces window.confirm). */
interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  okLabel: string;
  cancelLabel: string;
  destructive: boolean;
  resolver: ((ok: boolean) => void) | null;
}

const useConfirmStore = create<{
  state: ConfirmState;
  ask: (opts: Partial<Omit<ConfirmState, 'open' | 'resolver'>>) => Promise<boolean>;
  resolve: (ok: boolean) => void;
}>((set, get) => ({
  state: {
    open: false,
    title: '確認',
    message: '',
    okLabel: 'OK',
    cancelLabel: 'キャンセル',
    destructive: false,
    resolver: null,
  },
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      set({
        state: {
          open: true,
          title: opts.title ?? '確認',
          message: opts.message ?? '',
          okLabel: opts.okLabel ?? 'OK',
          cancelLabel: opts.cancelLabel ?? 'キャンセル',
          destructive: opts.destructive ?? false,
          resolver: resolve,
        },
      });
    }),
  resolve: (ok) => {
    const { state } = get();
    state.resolver?.(ok);
    set({ state: { ...state, open: false, resolver: null } });
  },
}));

export const confirmDialog = (
  message: string,
  opts: { title?: string; okLabel?: string; destructive?: boolean } = {},
): Promise<boolean> => useConfirmStore.getState().ask({ message, ...opts });

export function ConfirmHost() {
  const state = useConfirmStore((s) => s.state);
  const resolve = useConfirmStore((s) => s.resolve);

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolve(false);
      if (e.key === 'Enter') resolve(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.open, resolve]);

  if (!state.open) return null;
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm">
      <div className="w-[360px] rounded-2xl bg-white p-5 shadow-2xl animate-pop-in">
        <h3 className="mb-1 text-sm font-semibold text-slate-900">{state.title}</h3>
        <p className="mb-4 whitespace-pre-wrap text-xs leading-5 text-slate-600">
          {state.message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => resolve(false)}
            className="rounded-full px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            {state.cancelLabel}
          </button>
          <button
            onClick={() => resolve(true)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-sm ${
              state.destructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {state.okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
