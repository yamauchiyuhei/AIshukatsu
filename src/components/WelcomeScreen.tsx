import { FolderOpen } from 'lucide-react';

interface Props {
  needsPermission: boolean;
  onPick: () => void;
  onRequestPermission: () => void;
}

export function WelcomeScreen({ needsPermission, onPick, onRequestPermission }: Props) {
  return (
    <div className="flex h-screen items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <div className="mx-auto mb-4 h-24 w-24">
          <img
            src="/logo.png"
            alt="AI就活"
            className="h-full w-full rounded-2xl object-contain"
          />
        </div>
        <p className="mt-3 text-slate-600">
          ローカルのMarkdownファイルで就活情報を管理する、AIフレンドリーなツール。
        </p>
        <p className="mt-1 text-sm text-slate-500">
          1企業=1フォルダ。データはあなたのPCに残り、AIにそのまま渡せます。
        </p>

        <div className="mt-10">
          {needsPermission ? (
            <>
              <p className="mb-4 text-sm text-amber-700">
                前回選択したフォルダへのアクセス許可が必要です。
              </p>
              <button
                onClick={onRequestPermission}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-white shadow hover:bg-slate-800"
              >
                <FolderOpen size={18} />
                フォルダへのアクセスを許可
              </button>
              <div className="mt-3">
                <button
                  onClick={onPick}
                  className="text-sm text-slate-500 underline hover:text-slate-700"
                >
                  別のフォルダを選択
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={onPick}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-white shadow hover:bg-slate-800"
            >
              <FolderOpen size={18} />
              就活フォルダを選択
            </button>
          )}
        </div>

        <p className="mt-8 text-xs text-slate-400">
          ※ Chrome / Edge など Chromium 系ブラウザで動作します。
        </p>
      </div>
    </div>
  );
}
