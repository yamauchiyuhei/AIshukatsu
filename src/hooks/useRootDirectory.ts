import { useCallback, useEffect, useState, useRef } from 'react';
import { pickRootDirectory, type PickRootDirectoryOptions } from '../lib/fs';
import {
  clearRootHandle,
  ensureReadWritePermission,
  loadRootHandle,
  saveRootHandle,
} from '../lib/handleStore';

export type RootStatus = 'loading' | 'no-handle' | 'needs-permission' | 'ready';

export function useRootDirectory(uid: string | null) {
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const owner = useRef(uid); owner.current = uid;
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RootStatus>('loading');

  useEffect(() => {
    // While uid is unknown (auth pending), stay in loading state.
    if (!uid) {
      setHandle(null);
      setStatus('loading');
      return;
    }
    let cancelled = false;
    setStatus('loading'); setHandle(null); setError(null);
    (async () => {
      try {
      const stored = await loadRootHandle(uid);
      if (cancelled || owner.current !== uid) return;
      setLoadedOwner(uid);
      if (!stored) {
        setStatus('no-handle');
        return;
      }
      const granted = await ensureReadWritePermission(stored, false);
      if (cancelled || owner.current !== uid) return;
      if (granted) {
        setHandle(stored);
        setStatus('ready');
      } else {
        setHandle(stored);
        setStatus('needs-permission');
      }
      } catch { if (!cancelled) { setLoadedOwner(uid); setError('前回の保存先を読み込めません。フォルダを選び直してください。'); setStatus('no-handle'); } }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  const pick = useCallback(
    async (options?: PickRootDirectoryOptions) => {
      if (!uid) throw new Error('uid is required');
      const picked = await pickRootDirectory(options);
      if (owner.current !== uid) throw new Error('アカウントが切り替わりました。もう一度選択してください。');
      try {await saveRootHandle(uid,picked);} catch {setError('保存先の記憶ができませんでした。今回は利用できますが、次回はフォルダを選び直してください。');}
      setLoadedOwner(uid);
      setHandle(picked);
      setStatus('ready');
      return picked;
    },
    [uid],
  );

  /** Adopt an already-picked handle (e.g. a subdirectory we created). */
  const adopt = useCallback(
    async (next: FileSystemDirectoryHandle) => {
      if (!uid) throw new Error('uid is required');
      if (owner.current !== uid) return;
      try {await saveRootHandle(uid,next);} catch {setError('保存先の記憶ができませんでした。今回は利用できますが、次回はフォルダを選び直してください。');}
      setLoadedOwner(uid);
      setHandle(next);
      setStatus('ready');
    },
    [uid],
  );

  const requestPermission = useCallback(async () => {
    if (!handle) return;
    const ok = await ensureReadWritePermission(handle, true);
    if (ok) setStatus('ready');
  }, [handle]);

  const reset = useCallback(async () => {
    if (!uid) return;
    await clearRootHandle(uid);
    setHandle(null);
    setStatus('no-handle');
  }, [uid]);

  return { handle: loadedOwner === uid ? handle : null, status: loadedOwner === uid ? status : 'loading' as RootStatus, error, pick, adopt, requestPermission, reset };
}
