import { useCallback, useEffect, useState } from 'react';
import { pickRootDirectory } from '../lib/fs';
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

  const pick = useCallback(async () => {
    const picked = await pickRootDirectory();
    await saveRootHandle(picked);
    setHandle(picked);
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

  return { handle, status, pick, requestPermission, reset };
}
