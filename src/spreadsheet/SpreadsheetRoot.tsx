import { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { useSheet } from './lib/store';
import { Toolbar } from './components/Toolbar';
import { StatsBar } from './components/StatsBar';
import { SheetTabs } from './components/SheetTabs';
import { SheetGrid } from './components/SheetView/SheetGrid';
import { KanbanBoard } from './components/KanbanView/KanbanBoard';
import { MonthCalendar } from './components/CalendarView/MonthCalendar';
import { ToastHost, ConfirmHost, toast } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { CSV_DISPLAY_PATH } from './lib/csvStore';

const SECURITY_NOTICE_KEY = 'shukatsu-sheet-security-notice-dismissed-v1';

interface Props {
  /**
   * Whether this view is currently active (visible). Global keyboard
   * shortcuts (⌘Z / ⌘⇧Z / ⌘K) are only registered when active so they
   * don't steal keystrokes from other tabs (markdown editor, etc.).
   */
  active: boolean;
  /** Workspace root handle for bulk-restore to write files. */
  rootHandle?: FileSystemDirectoryHandle | null;
  /** Callback after bulk restore so the caller can refresh workspace. */
  onRestoreComplete?: () => void;
}

export function SpreadsheetRoot({ active, rootHandle, onRestoreComplete }: Props) {
  const hydrate = useSheet((s) => s.hydrate);
  const hydrated = useSheet((s) => s.hydrated);
  const user = useSheet((s) => s.user);
  const view = useSheet((s) => s.view);
  const undo = useSheet((s) => s.undo);
  const redo = useSheet((s) => s.redo);
  const checkExternalCsvChange = useSheet((s) => s.checkExternalCsvChange);
  const flushCsvNow = useSheet((s) => s.flushCsvNow);

  const [showNotice, setShowNotice] = useState(
    () => !localStorage.getItem(SECURITY_NOTICE_KEY),
  );
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (user?.uid) hydrate(user.uid);
  }, [hydrate, user?.uid]);

  // Keep in sync with データ/エントリー一覧.csv when it's edited outside the app
  // (e.g. by Claude). On focus/visibility we diff the file and reload if it
  // changed; on blur/hide we flush any pending write first so local edits
  // aren't lost when switching away to let Claude run.
  useEffect(() => {
    if (!active || !rootHandle || !hydrated) return;

    const onMaybeChanged = () => {
      void checkExternalCsvChange().then((r) => {
        if (r === 'reloaded') toast.info('外部の変更を読み込みました');
        else if (r === 'conflict')
          toast.warn(
            '外部で変更されています。アプリの変更を保存するか、再読み込みしてください',
          );
      });
    };
    const onHide = () => {
      void flushCsvNow();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onMaybeChanged();
      else onHide();
    };

    window.addEventListener('focus', onMaybeChanged);
    window.addEventListener('blur', onHide);
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onMaybeChanged);
      window.removeEventListener('blur', onHide);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, rootHandle, hydrated, checkExternalCsvChange, flushCsvNow]);

  // Auth is subscribed at App-level (src/App.tsx) so the store stays in sync
  // even while this view is unmounted.

  // Global keyboard shortcuts (Undo/Redo, ⌘K) — only when active
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      // ⌘K → command palette
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }

      // ⌘Z / ⌘⇧Z → undo / redo
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (redo()) toast.info('やり直しました');
          else toast.warn('やり直す操作がありません');
        } else {
          if (undo()) toast.info('元に戻しました');
          else toast.warn('戻す操作がありません');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, active]);

  if (!hydrated) {
    return (
      <div className="shukatsu-spreadsheet-root flex h-full items-center justify-center bg-gradient-to-b from-white to-slate-50 text-slate-500">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="shukatsu-spreadsheet-root flex h-full flex-col bg-gradient-to-b from-white to-slate-50">
      {showNotice && (
        <div className="mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-5xl items-start gap-2 rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-900 shadow-sm backdrop-blur">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1 leading-5">
            エントリー一覧は <code className="rounded bg-amber-100/70 px-1">{CSV_DISPLAY_PATH}</code> にローカル保存されます
            （ID・パスワードはCSVに含めず端末内のみに保持）。
            共有 PC では機密情報の入力にご注意ください。定期的なバックアップ（エクスポート）もおすすめします。
          </span>
          <button
            onClick={() => {
              localStorage.setItem(SECURITY_NOTICE_KEY, '1');
              setShowNotice(false);
            }}
            className="rounded-full p-1 text-amber-700 hover:bg-amber-100"
            title="閉じる"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <Toolbar onOpenPalette={() => setPaletteOpen(true)} rootHandle={rootHandle} onRestoreComplete={onRestoreComplete} />
      <SheetTabs />
      <StatsBar />
      <div className="flex flex-1 overflow-hidden">
        {view === 'sheet' && <SheetGrid />}
        {view === 'kanban' && <KanbanBoard />}
        {view === 'calendar' && <MonthCalendar />}
      </div>
      <ToastHost />
      <ConfirmHost />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
