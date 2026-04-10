import { useRef, useState } from 'react';
import {
  Cloud,
  CloudOff,
  CloudUpload,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { useSheet } from '../lib/store';
import { toast, confirmDialog } from './Toast';
import { Popover } from './Popover';

export function AuthButton() {
  const cloudEnabled = useSheet((s) => s.cloudEnabled);
  const user = useSheet((s) => s.user);
  const status = useSheet((s) => s.cloudStatus);
  const lastSyncedAt = useSheet((s) => s.cloudLastSyncedAt);
  const passphrase = useSheet((s) => s.passphrase);
  const setPassphrase = useSheet((s) => s.setPassphrase);
  const signInGoogle = useSheet((s) => s.signInGoogle);
  const signOutCloud = useSheet((s) => s.signOutCloud);
  const pullFromCloud = useSheet((s) => s.pullFromCloud);
  const pushToCloud = useSheet((s) => s.pushToCloud);

  const [open, setOpen] = useState(false);
  const [passOpen, setPassOpen] = useState(false);
  const [passInput, setPassInput] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);

  if (!cloudEnabled) {
    return (
      <button
        type="button"
        title="Firebase が未設定です (.env.local を作成してください)"
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs text-slate-400 shadow-sm"
      >
        <CloudOff size={12} />
        オフライン
      </button>
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={async () => {
          try {
            await signInGoogle();
            toast.success('クラウドに接続しました');
          } catch (e) {
            toast.error(`サインインに失敗: ${e instanceof Error ? e.message : String(e)}`);
          }
        }}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
      >
        <Cloud size={12} />
        サインイン
      </button>
    );
  }

  const StatusIcon =
    status === 'syncing'
      ? CloudUpload
      : status === 'error'
        ? AlertTriangle
        : status === 'synced'
          ? CheckCircle2
          : Cloud;
  const statusColor =
    status === 'syncing'
      ? 'text-indigo-500'
      : status === 'error'
        ? 'text-rose-500'
        : status === 'synced'
          ? 'text-emerald-500'
          : 'text-slate-500';
  const label =
    status === 'syncing'
      ? '同期中…'
      : status === 'error'
        ? 'エラー'
        : status === 'synced'
          ? '同期済'
          : '待機中';

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200/70 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
        title={user.email ?? user.uid}
      >
        <StatusIcon size={12} className={statusColor} />
        <span className="max-w-[100px] truncate">
          {user.displayName ?? user.email ?? 'ユーザー'}
        </span>
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={btnRef}
        align="right"
      >
        <div className="w-64 overflow-hidden rounded-xl border border-slate-200/70 bg-white text-xs shadow-xl animate-pop-in">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <div className="font-semibold text-slate-800">
              {user.displayName ?? 'サインイン中'}
            </div>
            {user.email && (
              <div className="truncate text-[10px] text-slate-500">{user.email}</div>
            )}
            <div className={`mt-1 flex items-center gap-1 text-[10px] ${statusColor}`}>
              <StatusIcon size={10} /> <span className="whitespace-nowrap">{label}</span>
              {lastSyncedAt && status === 'synced' && (
                <span className="whitespace-nowrap text-slate-400">
                  ・{formatRelative(lastSyncedAt)}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              setOpen(false);
              setPassInput(passphrase ?? '');
              setPassOpen(true);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
          >
            <KeyRound size={12} className="shrink-0 text-amber-500" />
            <div className="flex-1">
              <div className="whitespace-nowrap">暗号化パスフレーズ</div>
              <div className="text-[10px] text-slate-400">
                {passphrase ? '設定済 (パスワード列を暗号化)' : '未設定 (平文で送信)'}
              </div>
            </div>
          </button>

          <button
            onClick={async () => {
              setOpen(false);
              await pullFromCloud();
              toast.info('クラウドから取得しました');
            }}
            className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left hover:bg-slate-50"
          >
            <Cloud size={12} className="shrink-0 text-slate-500" />
            クラウドから取得
          </button>

          <button
            onClick={async () => {
              setOpen(false);
              await pushToCloud();
              toast.info('クラウドへ送信しました');
            }}
            className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left hover:bg-slate-50"
          >
            <CloudUpload size={12} className="shrink-0 text-slate-500" />
            今すぐ同期
          </button>

          <div className="border-t border-slate-100" />
          <button
            onClick={async () => {
              setOpen(false);
              const ok = await confirmDialog(
                'サインアウトします。ローカルデータは保持されます。',
                { title: 'サインアウト', okLabel: 'サインアウト' },
              );
              if (ok) {
                await signOutCloud();
                toast.info('サインアウトしました');
              }
            }}
            className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-rose-600 hover:bg-rose-50"
          >
            <LogOut size={12} /> サインアウト
          </button>
        </div>
      </Popover>

      {passOpen && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center bg-slate-900/30 backdrop-blur-md"
          onClick={() => setPassOpen(false)}
        >
          <div
            className="w-[400px] overflow-hidden rounded-2xl bg-white shadow-2xl animate-pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pb-2 pt-5">
              <h3 className="text-base font-semibold tracking-tight text-slate-900">
                暗号化パスフレーズ
              </h3>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                パスワード列はこのフレーズを使って暗号化してからクラウドに送信されます。
                <br />
                <strong>このフレーズはサーバーには送信されません。</strong>
                忘れると復号できなくなります。別の端末でも同じフレーズを入力してください。
              </p>
            </div>
            <div className="px-5 pb-3 pt-3">
              <input
                autoFocus
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPassphrase(passInput || null);
                    setPassOpen(false);
                    if (passInput) {
                      toast.success('パスフレーズを設定しました');
                      void pushToCloud();
                    }
                  }
                  if (e.key === 'Escape') setPassOpen(false);
                }}
                placeholder="パスフレーズを入力"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>
            <div className="flex justify-between gap-2 border-t border-slate-100 bg-slate-50/40 px-5 py-3">
              <button
                onClick={() => {
                  setPassphrase(null);
                  setPassOpen(false);
                  toast.info('暗号化を無効化しました');
                }}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
              >
                暗号化を無効化
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setPassOpen(false)}
                  className="rounded-full px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    setPassphrase(passInput || null);
                    setPassOpen(false);
                    if (passInput) {
                      toast.success('パスフレーズを設定しました');
                      void pushToCloud();
                    }
                  }}
                  className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelative(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}時間前`;
  return `${Math.floor(sec / 86400)}日前`;
}
