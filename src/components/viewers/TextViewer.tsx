import { useEffect, useState } from 'react';
import { ViewerShell, downloadFile } from './ViewerShell';

interface Props {
  handle: FileSystemFileHandle;
  label: string;
  breadcrumb?: string[];
  rootName?: string;
  onNavigate?: (index: number) => void;
}

/**
 * Plain-text / source-file viewer. Reads the file as UTF-8 and displays it
 * in a `<pre>` with preserved whitespace. No syntax highlighting — users who
 * need rich rendering should save as markdown.
 */
export function TextViewer({ handle, label, breadcrumb, rootName, onNavigate }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [fileRef, setFileRef] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const file = await handle.getFile();
        if (cancelled) return;
        const content = await file.text();
        if (cancelled) return;
        setText(content);
        setFileRef(file);
      } catch (e) {
        console.error('[TextViewer] load failed', e);
        if (!cancelled) setError('ファイルを読み込めませんでした');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return (
    <ViewerShell
      label={label}
      badge="テキスト"
      onDownload={fileRef ? () => downloadFile(fileRef, label) : undefined}
      breadcrumb={breadcrumb}
      breadcrumbRootLabel={rootName}
      onNavigate={onNavigate}
    >
      <div className="h-full px-6 py-4">
        {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : text !== null ? (
          <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-slate-800">
            {text}
          </pre>
        ) : (
          <p className="text-sm text-slate-500">読み込み中…</p>
        )}
      </div>
    </ViewerShell>
  );
}
