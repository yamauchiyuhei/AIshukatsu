import { useEffect, useState } from 'react';
import { useSheet } from '../spreadsheet/lib/store';
import {
  pullCompanyMaster,
  seedCompanyMaster,
} from '../lib/companyMasterSync';
import bundledMaster from '../data/companyMaster.json';

const CACHE_KEY = 'companyMasterCache.v1';

interface CacheShape {
  names: string[];
  cachedAt: string;
}

function readCache(): string[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheShape;
    return Array.isArray(parsed.names) ? parsed.names : null;
  } catch {
    return null;
  }
}

function writeCache(names: string[]) {
  try {
    const value: CacheShape = {
      names,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    /* quota / privacy mode — ignore */
  }
}

/**
 * Provides the global company-name master list for autocompletion.
 *
 * Resolution order (fast to slow):
 *   1. localStorage cache (instant, optimistic)
 *   2. Bundled JSON (when not signed in / Firestore unavailable)
 *   3. Firestore `/companyMaster/all` (when signed in)
 *      - if doc missing → seed with bundled JSON, then re-pull
 *
 * The hook returns the best available list at any moment and re-renders when
 * a fresher source completes loading.
 */
export function useCompanyMaster(): { names: string[]; loading: boolean } {
  const [names, setNames] = useState<string[]>(
    () => readCache() ?? (bundledMaster as string[]),
  );
  const [loading, setLoading] = useState(true);
  const user = useSheet((s) => s.user);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      // Always update the cache with whatever bundled / cached data we have
      // so that the very first paint is non-empty.
      const cached = readCache();
      if (cached && cached.length > 0 && !cancelled) {
        setNames(cached);
      }

      // Without a signed-in user, the bundled list is the freshest source we
      // can offer. Cache it for next time and bail out.
      if (!user) {
        const fallback = bundledMaster as string[];
        if (!cancelled) {
          setNames(fallback);
          writeCache(fallback);
          setLoading(false);
        }
        return;
      }

      // Signed in: try Firestore.
      try {
        let remote = await pullCompanyMaster();

        // First-time setup — seed with the bundled list.
        if (remote === null) {
          await seedCompanyMaster(bundledMaster as string[]);
          remote = await pullCompanyMaster();
        }

        if (remote && remote.length > 0 && !cancelled) {
          setNames(remote);
          writeCache(remote);
        }
      } catch (e) {
        console.warn('[useCompanyMaster] Firestore pull failed; using cache/bundle', e);
        if (!cancelled) {
          // Keep whatever we already showed (cache or bundled).
          const fallback = readCache() ?? (bundledMaster as string[]);
          setNames(fallback);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { names, loading };
}
