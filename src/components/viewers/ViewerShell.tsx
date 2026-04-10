import { useEffect, useState, type ReactNode } from 'react';
import { Download, Maximize2, Minimize2 } from 'lucide-react';
import { Breadcrumb } from '../Breadcrumb';

interface Props {
  label: string;
  /** Extra badge shown next to the label, e.g. "閲覧のみ · 画像". */
  badge?: string;
  /** Optional download handler — if provided, a download button is shown. */
  onDownload?: () => void;
  /**
   * Show the focus-mode toggle button. When enabled, clicking the button
   * makes this shell cover the whole viewport (hiding the sidebar / tab bar).
   * Press Esc or click again to exit.
   */
  enableFocusMode?: boolean;
  /**
   * Breadcrumb path segments from the workspace root (exclusive) down to the
   * current item (inclusive). When provided, a Breadcrumb strip is rendered
   * under the header.
   */
  breadcrumb?: string[];
  /** Workspace root label for the breadcrumb's Home button. */
  breadcrumbRootLabel?: string;
  /** Navigation handler: -1 = workspace root, else 0-based segment index. */
  onNavigate?: (index: number) => void;
  children: ReactNode;
}

/**
 * Common chrome for every non-markdown viewer: a slim top bar with the file
 * label, a read-only badge, and (optionally) a download button. The body
 * slot fills the remaining space and scrolls independently.
 *
 * Viewers that handle big, screen-hungry content (PDFs, images) can opt into
 * a "focus mode" by passing `enableFocusMode`. Focus mode pins the shell to
 * the viewport via `position: fixed; inset: 0` so it covers the sidebar and
 * tab bar; Esc exits.
 */
export function ViewerShell({
  label,
  badge,
  onDownload,
  enableFocusMode = false,
  breadcrumb,
  breadcrumbRootLabel,
  onNavigate,
  children,
}: Props) {
  const [focus, setFocus] = useState(false);

  // Let the user bail out of focus mode with Escape — matches the native
  // Fullscreen API convention and is discoverable.
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setFocus(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus]);

  // When the tab changes (component unmount) make sure we don't leave the
  // focus overlay stuck on the next tab — React handles this automatically
  // because state resets with the component, but keep this comment as a
  // reminder for future refactors.

  const outerClass = focus
    ? 'fixed inset-0 z-[100] flex flex-col overflow-hidden bg-white'
    : 'flex h-full flex-col overflow-hidden bg-white';

  return (
    <div className={outerClass}>
      <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-6 py-2">
        <span className="truncate text-sm font-medium text-slate-800">
          {label}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
          {badge ?? '閲覧のみ'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {enableFocusMode && (
            <button
              type="button"
              onClick={() => setFocus((v) => !v)}
              title={focus ? '集中モードを終了 (Esc)' : '集中モード'}
              className="flex h-7 items-center gap-1 rounded px-2 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {focus ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              <span>{focus ? '解除' : '集中モード'}</span>
            </button>
          )}
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              title="ダウンロード"
              className="flex h-7 items-center gap-1 rounded px-2 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <Download size={13} />
              <span>ダウンロード</span>
            </button>
          )}
        </div>
      </div>
      {breadcrumb && breadcrumbRootLabel && onNavigate && (
        <Breadcrumb
          segments={breadcrumb}
          rootLabel={breadcrumbRootLabel}
          onNavigate={onNavigate}
        />
      )}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

/**
 * Trigger a browser download for the given File object (obtained from a
 * FileSystemFileHandle.getFile()). Used by viewers' download buttons.
 */
export function downloadFile(file: File, suggestedName?: string) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName ?? file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on next tick so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
