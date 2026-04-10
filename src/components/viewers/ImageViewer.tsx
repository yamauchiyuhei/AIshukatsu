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
 * Full-pane image viewer. Loads the underlying `File` via the FS Access API,
 * hands it to a blob URL, and displays it with `object-contain` so the whole
 * image always fits the pane regardless of aspect ratio.
 */
export function ImageViewer({ handle, label, breadcrumb, rootName, onNavigate }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [fileRef, setFileRef] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const file = await handle.getFile();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);
        setFileRef(file);
      } catch (e) {
        console.error('[ImageViewer] load failed', e);
        if (!cancelled) setError('画像を読み込めませんでした');
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [handle]);

  return (
    <ViewerShell
      label={label}
      badge="画像"
      enableFocusMode
      onDownload={fileRef ? () => downloadFile(fileRef, label) : undefined}
      breadcrumb={breadcrumb}
      breadcrumbRootLabel={rootName}
      onNavigate={onNavigate}
    >
      <div className="flex h-full items-center justify-center bg-slate-50 p-6">
        {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : url ? (
          <img
            src={url}
            alt={label}
            className="max-h-full max-w-full object-contain shadow-sm"
          />
        ) : (
          <p className="text-sm text-slate-500">読み込み中…</p>
        )}
      </div>
    </ViewerShell>
  );
}
