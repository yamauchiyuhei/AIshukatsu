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
      setError(e instanceof Error ? e.message : '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { workspace, loading, error, refresh };
}
