import { useCallback, useEffect, useState } from 'react';
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
  const [status, setStatus] = useState<RootStatus>('loading');

  useEffect(() => {
    // While uid is unknown (auth pending), stay in loading state.
    if (!uid) {
      setHandle(null);
      setStatus('loading');
      return;
    }
    (async () => {
      const stored = await loadRootHandle(uid);
      if (!stored) {
        setStatus('no-handle');
        return;
      }
      const granted = await ensureReadWritePermission(stored, false);
      if (granted) {
        setHandle(stored);
        setStatus('ready');
      } else {
        setHandle(stored);
        setStatus('needs-permission');
      }
    })();
  }, [uid]);

  const pick = useCallback(
    async (options?: PickRootDirectoryOptions) => {
      if (!uid) throw new Error('uid is required');
      const picked = await pickRootDirectory(options);
      await saveRootHandle(uid, picked);
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
      await saveRootHandle(uid, next);
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

  return { handle, status, pick, adopt, requestPermission, reset };
}
