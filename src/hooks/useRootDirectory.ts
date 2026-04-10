import { useCallback, useEffect, useState } from 'react';
import { pickRootDirectory, type PickRootDirectoryOptions } from '../lib/fs';
import {
  clearRootHandle,
  ensureReadWritePermission,
  loadRootHandle,
  saveRootHandle,
} from '../lib/handleStore';

export type RootStatus = 'loading' | 'no-handle' | 'needs-permission' | 'ready';

export function useRootDirectory() {
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [status, setStatus] = useState<RootStatus>('loading');

  useEffect(() => {
    (async () => {
      const stored = await loadRootHandle();
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
  }, []);

  const pick = useCallback(async (options?: PickRootDirectoryOptions) => {
    const picked = await pickRootDirectory(options);
    await saveRootHandle(picked);
    setHandle(picked);
    setStatus('ready');
    return picked;
  }, []);

  /** Adopt an already-picked handle (e.g. a subdirectory we created). */
  const adopt = useCallback(async (next: FileSystemDirectoryHandle) => {
    await saveRootHandle(next);
    setHandle(next);
    setStatus('ready');
  }, []);

  const requestPermission = useCallback(async () => {
    if (!handle) return;
    const ok = await ensureReadWritePermission(handle, true);
    if (ok) setStatus('ready');
  }, [handle]);

  const reset = useCallback(async () => {
    await clearRootHandle();
    setHandle(null);
    setStatus('no-handle');
  }, []);

  return { handle, status, pick, adopt, requestPermission, reset };
}
