import { useCallback, useEffect, useState } from 'react';
import { Workspace } from '../types';
import { loadWorkspace } from '../lib/workspace';

export function useWorkspace(root: FileSystemDirectoryHandle | null) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!root) return;
    setLoading(true);
    setError(null);
    try {
      const ws = await loadWorkspace(root);
      setWorkspace(ws);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[useWorkspace] loadWorkspace failed:', e);
      let msg: string;
      if (e instanceof Error && e.message) msg = e.message;
      else if (typeof e === 'string') msg = e;
      else {
        try {
          msg = JSON.stringify(e);
        } catch {
          msg = String(e);
        }
      }
      setError(msg || '読み込みに失敗しました (詳細不明)');
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { workspace, loading, error, refresh };
}
