import { useEffect, useState } from 'react';
import { ViewerShell, downloadFile } from './ViewerShell';
import { extOf } from '../../lib/fileKind';

interface Props {
  handle: FileSystemFileHandle;
  label: string;
  breadcrumb?: string[];
  rootName?: string;
  onNavigate?: (index: number) => void;
}

interface SheetData {
  /** Ordered list of sheet names from the workbook. */
  names: string[];
  /** Map of sheet name → inner HTML markup from `sheet_to_html`. */
  html: Record<string, string>;
}

/**
 * Read-only preview for spreadsheet files (.xlsx / .xls / .csv / .tsv).
 * Uses the already-bundled `xlsx` package (SheetJS) — `read` parses the
 * binary/text, and `utils.sheet_to_html` turns each sheet into a plain
 * HTML table that we drop into the DOM with `dangerouslySetInnerHTML`.
 *
 * Multiple sheets get a small tab row above the table.
 */
export function SheetPreviewer({ handle, label, breadcrumb, rootName, onNavigate }: Props) {
  const [data, setData] = useState<SheetData | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [fileRef, setFileRef] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ext = extOf(label);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const file = await handle.getFile();
        if (cancelled) return;
        setFileRef(file);
        // Dynamic import keeps xlsx out of the initial bundle. It's already
        // used by the spreadsheet module, so this is a no-op in practice
        // once that module has loaded.
        const XLSX = await import('xlsx');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const names = workbook.SheetNames.slice();
        const html: Record<string, string> = {};
        for (const name of names) {
          const ws = workbook.Sheets[name];
          html[name] = XLSX.utils.sheet_to_html(ws, { header: '', footer: '' });
        }
        if (cancelled) return;
        setData({ names, html });
        setActive(names[0] ?? null);
      } catch (e) {
        console.error('[SheetPreviewer] load failed', e);
        if (!cancelled) setError('スプレッドシートを読み込めませんでした');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  return (
    <ViewerShell
      label={label}
      badge={ext === 'csv' || ext === 'tsv' ? 'CSV' : 'Excel'}
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
      ) : data && active ? (
        <div className="flex h-full flex-col">
          {data.names.length > 1 && (
            <div className="flex gap-1 border-b border-slate-100 bg-slate-50 px-4 py-1.5">
              {data.names.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setActive(name)}
                  className={`rounded px-3 py-1 text-xs transition ${
                    active === name
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:bg-white/70'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          <div
            className="sheet-preview flex-1 overflow-auto px-6 py-4"
            dangerouslySetInnerHTML={{ __html: data.html[active] }}
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
