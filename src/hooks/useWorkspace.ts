import { useCallback, useEffect, useState, useRef } from 'react';
import { Workspace } from '../types';
import { loadWorkspace } from '../lib/workspace';

export function useWorkspace(root: FileSystemDirectoryHandle | null) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!root) { setWorkspace(null); setLoading(false); setError(null); return; }
    setLoading(true);
    setError(null);
    try {
      const ws = await loadWorkspace(root);
      if (request === generation.current) setWorkspace(ws);
    } catch (e) {
      if (request !== generation.current) return;
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
      if (request === generation.current) setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { workspace: workspace?.root === root ? workspace : null, loading: loading || (!!root && workspace?.root !== root && !error), error, refresh };
}
