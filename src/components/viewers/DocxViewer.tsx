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
 * Read-only preview for Word (`.docx`) files. Uses `mammoth` to convert the
 * document to plain HTML (headings / paragraphs / lists / tables / inline
 * formatting). Complex layouts, headers/footers, and embedded objects are
 * intentionally not preserved — this is a "read my ES draft" viewer, not a
 * full Word replacement.
 *
 * Mammoth is dynamically imported so it only loads the first time a user
 * actually opens a `.docx` file.
 */
export function DocxViewer({ handle, label, breadcrumb, rootName, onNavigate }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [fileRef, setFileRef] = useState<File | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const file = await handle.getFile();
        if (cancelled) return;
        setFileRef(file);
        // Vite picks up mammoth's `browser` field so the Node-specific
        // unzip shim is swapped out automatically — just `import('mammoth')`.
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (cancelled) return;
        setHtml(result.value);
        setWarnings(
          result.messages
            .filter((m: { type?: string }) => m.type === 'warning')
            .map((m: { message: string }) => m.message),
        );
      } catch (e) {
        console.error('[DocxViewer] load failed', e);
        if (!cancelled) setError('Word ファイルを読み込めませんでした');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return (
    <ViewerShell
      label={label}
      badge="Word"
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
      ) : html !== null ? (
        <div className="mx-auto max-w-[820px] px-8 py-8">
          {warnings.length > 0 && (
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              一部の書式は簡略化して表示されています (mammoth 変換時の警告:{' '}
              {warnings.length} 件)
            </div>
          )}
          <div
            className="docx-preview prose max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-slate-500">読み込み中…</p>
        </div>
      )}
    </ViewerShell>
  );
}
