import { useEffect, useState } from 'react';
import { FileQuestion } from 'lucide-react';
import { ViewerShell, downloadFile } from './ViewerShell';
import { extOf } from '../../lib/fileKind';

interface Props {
  handle: FileSystemFileHandle;
  label: string;
  breadcrumb?: string[];
  rootName?: string;
  onNavigate?: (index: number) => void;
}

/**
 * Shown when the tab's file extension is not in our known allow-list
 * (e.g. `.doc`, `.zip`, `.pptx`, `.psd`). We still let the user download
 * the file so they can open it in a native app.
 */
export function UnsupportedFallback({ handle, label, breadcrumb, rootName, onNavigate }: Props) {
  const [fileRef, setFileRef] = useState<File | null>(null);
  const ext = extOf(label) || '不明';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const file = await handle.getFile();
        if (!cancelled) setFileRef(file);
      } catch (e) {
        console.warn('[UnsupportedFallback] load failed', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return (
    <ViewerShell
      label={label}
      badge={`非対応 (.${ext})`}
      onDownload={fileRef ? () => downloadFile(fileRef, label) : undefined}
      breadcrumb={breadcrumb}
      breadcrumbRootLabel={rootName}
      onNavigate={onNavigate}
    >
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <FileQuestion size={48} className="text-slate-300" />
        <div>
          <p className="text-sm font-medium text-slate-700">
            このファイル形式 (.{ext}) はプレビューできません
          </p>
          <p className="mt-1 text-xs text-slate-500">
            ダウンロードしてお使いの対応アプリで開いてください。
          </p>
        </div>
        {fileRef && (
          <button
            type="button"
            onClick={() => downloadFile(fileRef, label)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            ダウンロード
          </button>
        )}
      </div>
    </ViewerShell>
  );
}
