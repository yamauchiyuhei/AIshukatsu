import { useCallback, useEffect, useState } from 'react';
import { Company } from '../types';
import { loadCompanies } from '../lib/companies';

export function useCompanies(root: FileSystemDirectoryHandle | null) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!root) return;
    setLoading(true);
    setError(null);
    try {
      const list = await loadCompanies(root);
      setCompanies(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { companies, loading, error, refresh };
}
