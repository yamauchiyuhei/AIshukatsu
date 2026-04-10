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
 * PDF viewer backed by the browser's built-in PDF renderer. We deliberately
 * avoid bundling PDF.js (which would add ~1.5MB) and instead just hand a
 * blob URL to an `<iframe>`; every modern browser (Chrome, Edge, Safari,
 * Firefox) already ships a capable PDF viewer behind that.
 */
export function PdfViewer({ handle, label, breadcrumb, rootName, onNavigate }: Props) {
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
        // Explicitly type the blob so browsers pick the PDF viewer rather
        // than falling back to "download as octet-stream".
        const blob = new Blob([await file.arrayBuffer()], {
          type: 'application/pdf',
        });
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setFileRef(file);
      } catch (e) {
        console.error('[PdfViewer] load failed', e);
        if (!cancelled) setError('PDF を読み込めませんでした');
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
      badge="PDF"
      enableFocusMode
      onDownload={fileRef ? () => downloadFile(fileRef, label) : undefined}
      breadcrumb={breadcrumb}
      breadcrumbRootLabel={rootName}
      onNavigate={onNavigate}
    >
      {error ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-rose-600">{error}</p>
        </div>
      ) : url ? (
        // `#view=FitH` tells Chrome's built-in PDF viewer to open the file
        // at fit-to-width zoom instead of the default 29%-ish auto scale.
        // Every modern browser (Chrome/Edge/Safari/Firefox) honours this
        // URL fragment for PDFs.
        <iframe
          src={`${url}#view=FitH`}
          title={label}
          className="h-full w-full border-0"
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-slate-500">読み込み中…</p>
        </div>
      )}
    </ViewerShell>
  );
}
