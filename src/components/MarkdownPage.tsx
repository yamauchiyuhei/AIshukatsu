import { useEffect, useState } from 'react';
import { MarkdownEditor } from './MarkdownEditor';
import { useAutoSave } from '../hooks/useAutoSave';

interface Props {
  fileHandle: FileSystemFileHandle;
  /** Stable identifier so the editor remounts when the file changes. */
  fileKey: string;
}

/**
 * Full-bleed WYSIWYG markdown editor for an arbitrary file handle.
 * No card chrome — fills its parent container.
 */
export function MarkdownPage({ fileHandle, fileKey }: Props) {
  const [body, setBody] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const { state, schedule, flush, reset } = useAutoSave({
    onSave: async (value) => {
      const writable = await fileHandle.createWritable();
      await writable.write(value);
      await writable.close();
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await flush();
      reset();
      setLoading(true);
      try {
        const file = await fileHandle.getFile();
        const text = await file.text();
        if (!cancelled) setBody(text);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileHandle]);

  const saveLabel: Record<typeof state, string> = {
    idle: '',
    dirty: '未保存',
    saving: '保存中…',
    saved: '保存済み',
    error: '保存エラー',
  };

  return (
    <div className="relative h-full overflow-auto bg-white px-12 py-8">
      {loading ? (
        <p className="text-sm text-slate-500">読み込み中…</p>
      ) : (
        <MarkdownEditor
          resetKey={fileKey}
          initialValue={body}
          onChange={schedule}
        />
      )}
      {state !== 'idle' && (
        <span className="pointer-events-none fixed bottom-3 right-4 rounded bg-slate-900/80 px-2 py-1 text-[11px] text-white">
          {saveLabel[state]}
        </span>
      )}
    </div>
  );
}
