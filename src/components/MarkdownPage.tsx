import { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, Code2, Eye, Redo2, Undo2 } from 'lucide-react';
import { MarkdownEditor, MarkdownEditorHandle } from './MarkdownEditor';
import { Breadcrumb } from './Breadcrumb';
import { useAutoSave } from '../hooks/useAutoSave';
import { useSheet } from '../spreadsheet/lib/store';
import { pullNote, pushNote } from '../lib/markdownCloudSync';

interface Props {
  fileHandle: FileSystemFileHandle;
  /** Stable identifier so the editor remounts when the file changes. */
  fileKey: string;
  /** File name (e.g. `業界研究.md`), used for Firestore metadata. */
  label: string;
  /** Ancestor labels (e.g. `['IT・通信', 'DeNA']`), used for Firestore metadata. */
  breadcrumb: string[];
  /** Workspace root label used by the optional Breadcrumb header. */
  rootName?: string;
  /** Breadcrumb click handler: -1 = root, else 0-based segment index. */
  onNavigate?: (index: number) => void;
}

interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Full-bleed WYSIWYG markdown editor for an arbitrary file handle.
 * Saves to the local PC file AND mirrors to Firestore when signed in.
 */
export function MarkdownPage({
  fileHandle,
  fileKey,
  label,
  breadcrumb,
  rootName,
  onNavigate,
}: Props) {
  const [body, setBody] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [cloudBanner, setCloudBanner] = useState<string | null>(null);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const [history, setHistory] = useState<HistoryState>({
    canUndo: false,
    canRedo: false,
  });
  /** preview = Milkdown WYSIWYG (default), source = read-only raw markdown */
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');

  // Cloud sync state (subscribed from the shared spreadsheet store)
  const user = useSheet((s) => s.user);
  const passphrase = useSheet((s) => s.passphrase);
  // Per-file salt is cached so crypto.ts can reuse its derived AES key.
  const cloudSaltRef = useRef<string | null>(null);

  // Keep the latest auth state in refs so the autosave closure always sees
  // them without needing to re-create the hook on every auth change.
  const userRef = useRef(user);
  const passphraseRef = useRef(passphrase);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    passphraseRef.current = passphrase;
  }, [passphrase]);

  // Guard: track the fileHandle this component was mounted with so the
  // autosave closure never writes to the wrong file, even if React somehow
  // reuses this component instance across different tabs.
  const mountedHandleRef = useRef(fileHandle);
  useEffect(() => {
    mountedHandleRef.current = fileHandle;
  }, [fileHandle]);

  const { state, schedule, flush, reset } = useAutoSave({
    onSave: async (value) => {
      // Safety check: abort if the fileHandle changed since the edit was made.
      if (mountedHandleRef.current !== fileHandle) {
        console.warn('[autosave] fileHandle mismatch — skipping save to prevent cross-file write');
        return;
      }
      // ① Local save (existing behavior) — must not be skipped on cloud error.
      const writable = await fileHandle.createWritable();
      await writable.write(value);
      await writable.close();

      // ② Cloud save (best-effort, fire-and-forget).
      const u = userRef.current;
      if (u) {
        try {
          const result = await pushNote({
            uid: u.uid,
            fileKey,
            label,
            breadcrumb,
            content: value,
            passphrase: passphraseRef.current,
            saltReuse: cloudSaltRef.current,
          });
          if (result) cloudSaltRef.current = result.salt;
        } catch (e) {
          console.warn('cloud push failed (markdown):', e);
        }
      }
    },
  });

  // Mirror edits from either editor (Milkdown WYSIWYG or the raw textarea)
  // back into `body` so toggling between view modes always shows the latest
  // content — Milkdown reinitialises from `initialValue={body}` on remount.
  const handleChange = useCallback(
    (value: string) => {
      setBody(value);
      schedule(value);
    },
    [schedule],
  );

  // Load: parallel local + cloud fetch, adopt the newer version.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await flush();
      reset();
      setLoading(true);
      setCloudBanner(null);
      setHistory({ canUndo: false, canRedo: false });
      cloudSaltRef.current = null;
      try {
        const u = userRef.current;
        const [file, cloudResult] = await Promise.all([
          fileHandle.getFile(),
          u
            ? pullNote(u.uid, fileKey, passphraseRef.current).catch((e) => {
                console.warn('cloud pull failed (markdown):', e);
                return null;
              })
            : Promise.resolve(null),
        ]);
        const localText = await file.text();
        const localMtime = new Date(file.lastModified);

        let chosen = localText;
        let adoptedCloud = false;

        if (cloudResult) {
          cloudSaltRef.current = cloudResult.salt;

          if (cloudResult.decryptFailed) {
            console.warn(
              'cloud note is encrypted but could not be decrypted (no/wrong passphrase); keeping local copy',
            );
          } else if (
            cloudResult.updatedAt &&
            cloudResult.updatedAt.getTime() > localMtime.getTime() + 1000 &&
            cloudResult.content !== localText
          ) {
            // Cloud is meaningfully newer → adopt and write back to disk.
            chosen = cloudResult.content;
            adoptedCloud = true;
            try {
              const w = await fileHandle.createWritable();
              await w.write(chosen);
              await w.close();
            } catch (e) {
              console.warn('local write-back failed:', e);
            }
          } else if (
            !cloudResult.updatedAt ||
            localMtime.getTime() > (cloudResult.updatedAt?.getTime() ?? 0) + 1000
          ) {
            // Local is newer → push current local up so cloud catches up.
            if (u && localText) {
              try {
                const result = await pushNote({
                  uid: u.uid,
                  fileKey,
                  label,
                  breadcrumb,
                  content: localText,
                  passphrase: passphraseRef.current,
                  saltReuse: cloudSaltRef.current,
                });
                if (result) cloudSaltRef.current = result.salt;
              } catch (e) {
                console.warn('initial cloud push failed:', e);
              }
            }
          }
        } else if (u) {
          // No cloud doc yet → upload current local as initial version.
          try {
            const result = await pushNote({
              uid: u.uid,
              fileKey,
              label,
              breadcrumb,
              content: localText,
              passphrase: passphraseRef.current,
              saltReuse: cloudSaltRef.current,
            });
            if (result) cloudSaltRef.current = result.salt;
          } catch (e) {
            console.warn('initial cloud push failed:', e);
          }
        }

        if (!cancelled) {
          setBody(chosen);
          if (adoptedCloud) {
            setCloudBanner('クラウドから最新版を取得しました');
            window.setTimeout(() => {
              if (!cancelled) setCloudBanner(null);
            }, 4000);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-run when the file changes OR the user signs in/out so a fresh login
    // triggers a one-shot cloud reconciliation for the currently open file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileHandle, user?.uid]);

  const saveLabel: Record<typeof state, string> = {
    idle: '',
    dirty: '未保存',
    saving: '保存中…',
    saved: user ? '保存済み (ローカル + クラウド)' : '保存済み',
    error: '保存エラー',
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      {/* Top toolbar — always visible */}
      <div className="flex items-center gap-1 border-b border-slate-100 bg-white px-12 py-1.5">
        <ToolbarBtn
          disabled={!history.canUndo || viewMode === 'source'}
          onClick={() => editorRef.current?.undo()}
          title="戻る (⌘Z)"
        >
          <Undo2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          disabled={!history.canRedo || viewMode === 'source'}
          onClick={() => editorRef.current?.redo()}
          title="進む (⌘⇧Z)"
        >
          <Redo2 size={14} />
        </ToolbarBtn>
        <div className="ml-auto">
          {/* Intentionally subtle toggle — markdown preview stays the
              default experience and the source view is an advanced escape
              hatch ("地味目" per user request). */}
          <button
            type="button"
            onClick={() =>
              setViewMode((m) => (m === 'preview' ? 'source' : 'preview'))
            }
            title={
              viewMode === 'preview'
                ? 'ソース表示に切替'
                : 'プレビューに戻す'
            }
            className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            {viewMode === 'preview' ? (
              <>
                <Code2 size={12} />
                <span>ソース</span>
              </>
            ) : (
              <>
                <Eye size={12} />
                <span>プレビュー</span>
              </>
            )}
          </button>
        </div>
      </div>
      {rootName && onNavigate && (
        <Breadcrumb
          segments={[...breadcrumb, label]}
          rootLabel={rootName}
          onNavigate={onNavigate}
        />
      )}

      <div className="relative flex-1 overflow-auto px-12 py-8">
        {cloudBanner && (
          <div className="pointer-events-none mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/90 px-3 py-1.5 text-xs text-indigo-800 shadow-sm">
            <Cloud size={13} />
            <span>{cloudBanner}</span>
          </div>
        )}
        {loading ? (
          <p className="text-sm text-slate-500">読み込み中…</p>
        ) : viewMode === 'source' ? (
          <textarea
            className="markdown-source block h-full w-full resize-none border-0 bg-transparent p-0 font-mono text-[13px] leading-relaxed text-slate-800 outline-none focus:ring-0"
            value={body}
            onChange={(e) => handleChange(e.target.value)}
            spellCheck={false}
          />
        ) : (
          <MarkdownEditor
            ref={editorRef}
            resetKey={fileKey}
            initialValue={body}
            onChange={handleChange}
            onHistoryChange={setHistory}
          />
        )}
      </div>
      {state !== 'idle' && (
        <span className="pointer-events-none fixed bottom-3 right-4 rounded bg-slate-900/80 px-2 py-1 text-[11px] text-white">
          {saveLabel[state]}
        </span>
      )}
    </div>
  );
}

function ToolbarBtn({
  disabled,
  onClick,
  title,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded transition ${
        disabled
          ? 'cursor-not-allowed text-slate-300'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}
