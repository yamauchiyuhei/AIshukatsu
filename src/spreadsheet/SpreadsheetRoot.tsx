import { isTextInput } from '../lib/cellValues';
import { restoreCsvRecovery } from './lib/csvStore';
import { createManualBackup } from './lib/persistence';
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
  const localError = useSheet(s => s.localError);
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
    void hydrate(user?.uid ?? 'local-guest');
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
      }).catch(() => toast.error('外部の変更を読み込めません。保存先を確認してください。'));
    };
    const onHide = () => {
      void flushCsvNow().catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onMaybeChanged();
      else onHide();
    };

    onMaybeChanged();
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
      if (e.isComposing || isTextInput(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      // ⌘K → command palette
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }

      // ⌘Z / ⌘⇧Z → undo / redo
      if (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (e.shiftKey || e.key.toLowerCase() === 'y') {
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
    return <div className="space-y-4 p-8" role={localError ? 'alert' : 'status'}><p>{localError ?? '一覧を読み込み中…'}</p>{localError && <><button className="rounded border px-4 py-2" onClick={() => void hydrate(user?.uid ?? 'local-guest')}>再試行</button><button className="ml-3 rounded border px-4 py-2" onClick={() => window.dispatchEvent(new Event('aishukatsu-open-settings'))}>バックアップと復元</button>{rootHandle && <button className="ml-3 rounded border px-4 py-2" onClick={async () => { const ok=await import('./components/Toast').then(m=>m.confirmDialog('保存直前の復旧データへ戻します。元のファイルを確認してから実行してください。',{title:'保存直前の状態へ復旧',okLabel:'復旧する'}));if(!ok)return;try{await restoreCsvRecovery(rootHandle);await hydrate(user?.uid ?? 'local-guest');}catch{toast.error('復旧できませんでした。ZIPバックアップを別のフォルダへ復元してください。');} }}>保存直前の状態へ復旧</button>}</>}</div>;
  }

  return (
    <div className="shukatsu-spreadsheet-root flex h-full flex-col bg-gradient-to-b from-white to-slate-50">
      {showNotice && (
        <div className="mx-auto mt-3 flex w-[calc(100%-1.5rem)] max-w-5xl items-start gap-2 rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-900 shadow-sm backdrop-blur">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1 leading-5">
            エントリー一覧は <code className="rounded bg-amber-100/70 px-1">{CSV_DISPLAY_PATH}</code> にローカル保存されます
            （ID・パスワードはCSVに含めず、隠し保存ファイルに保持）。クラウドへバックアップする際は合言葉で暗号化します。
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
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
