import { ChevronRight, Home } from 'lucide-react';

interface Props {
  /** Ordered path segments from the workspace root down to the current item. */
  segments: string[];
  /** Root label shown as the leftmost segment (usually the workspace folder name). */
  rootLabel: string;
  /**
   * Home click callback. `index = -1` means "workspace root" (spreadsheet).
   * Parent segments are intentionally non-interactive here — the user
   * navigates via the sidebar tree, so we only offer a single shortcut
   * back to the top-level spreadsheet view.
   */
  onNavigate: (index: number) => void;
}

/**
 * Thin breadcrumb strip rendered at the top of every viewer (markdown /
 * image / pdf / etc.). Shows the full path for orientation. Only the Home
 * button is clickable; parent folder segments are plain text because we
 * removed the folder-view tabs — clicking them would have nothing to open.
 */
export function Breadcrumb({ segments, rootLabel, onNavigate }: Props) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50/60 px-4 py-1 text-[12px] text-slate-500">
      <button
        type="button"
        onClick={() => onNavigate(-1)}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-200/60 hover:text-slate-700"
        title={rootLabel}
      >
        <Home size={11} />
        <span className="max-w-[120px] truncate">{rootLabel}</span>
      </button>
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        return (
          <div key={idx} className="flex items-center gap-1">
            <ChevronRight size={11} className="text-slate-300" />
            <span
              className={`truncate px-1.5 py-0.5 ${
                isLast ? 'text-slate-700' : 'text-slate-500'
              }`}
            >
              {seg}
            </span>
          </div>
        );
      })}
    </div>
  );
}
