import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Workspace } from '../../types';
import {
  buildIndex,
  collectSearchableFiles,
  searchIndex,
  type IndexedFile,
  type SearchResult,
} from '../../lib/documentSearch';
import { fileIconFor } from '../fileIcons';

interface OpenFilePayload {
  key: string;
  label: string;
  breadcrumb: string[];
  handle: FileSystemFileHandle;
}

interface Props {
  workspace: Workspace;
  onOpenFile: (entry: OpenFilePayload) => void;
  /** The normal file tree, shown whenever the search box is empty. */
  children: React.ReactNode;
}

type IndexState =
  | { status: 'idle' }
  | { status: 'building' }
  | { status: 'ready'; index: IndexedFile[] };

/**
 * Workspace document search (語彙検索). Lazily reads every searchable file once
 * per workspace, then matches names + Markdown/text content in-memory. While
 * the box is empty it just renders the file tree (`children`); as soon as the
 * user types, it swaps in ranked results.
 */
export function DocumentSearch({ workspace, onOpenFile, children }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const indexRef = useRef<IndexState>({ status: 'idle' });
  const [, force] = useState(0);

  // Invalidate the index whenever the workspace changes (refresh / edits /
  // folder switch). It rebuilds lazily on the next keystroke. On desktop the
  // FSA shim fakes lastModified, so a fresh read is the only reliable way to
  // stay current.
  useEffect(() => {
    indexRef.current = { status: 'idle' };
    force((n) => n + 1);
  }, [workspace]);

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  // Debounced search. Builds the index on first use, then matches.
  useEffect(() => {
    if (!searching) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      if (indexRef.current.status !== 'ready') {
        indexRef.current = { status: 'building' };
        force((n) => n + 1);
        const files = collectSearchableFiles(workspace);
        const index = await buildIndex(files);
        if (cancelled) return;
        indexRef.current = { status: 'ready', index };
        force((n) => n + 1);
      }
      if (cancelled) return;
      const state = indexRef.current;
      if (state.status === 'ready') {
        setResults(searchIndex(query, state.index));
      }
    };
    const t = setTimeout(run, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, searching, workspace]);

  const building = indexRef.current.status === 'building';
  const countLabel = useMemo(() => {
    if (!searching) return '';
    if (building) return '検索中…';
    return `${results.length}${results.length >= 50 ? '+' : ''} 件`;
  }, [searching, building, results.length]);

  return (
    <div>
      <div className="relative mb-1">
        <Search
          size={13}
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ファイル・本文を検索"
          aria-label="ファイル・本文を検索"
          className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-200"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            title="クリア"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {!searching ? (
        children
      ) : (
        <div>
          <div className="px-1 pb-1 text-[11px] text-slate-400">{countLabel}</div>
          {!building && results.length === 0 ? (
            <div className="px-1 py-4 text-center text-xs text-slate-400">
              「{trimmed}」に一致するファイルはありません
            </div>
          ) : (
            <div className="flex flex-col">
              {results.map((r) => {
                const Icon = fileIconFor(r.label);
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() =>
                      onOpenFile({
                        key: r.key,
                        label: r.label,
                        breadcrumb: r.breadcrumb,
                        handle: r.handle,
                      })
                    }
                    className="flex w-full flex-col gap-0.5 rounded px-1.5 py-1.5 text-left hover:bg-slate-100"
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon size={13} className="shrink-0 text-slate-400" />
                      <span className="flex-1 truncate text-slate-700">
                        {r.label}
                      </span>
                      {r.contentMatch && (
                        <span className="shrink-0 rounded bg-slate-100 px-1 text-[10px] text-slate-400">
                          本文
                        </span>
                      )}
                    </span>
                    {r.breadcrumb.length > 0 && (
                      <span className="truncate pl-[1.125rem] text-[10px] text-slate-400">
                        {r.breadcrumb.join(' / ')}
                      </span>
                    )}
                    {r.snippet && (
                      <span className="line-clamp-2 pl-[1.125rem] text-[11px] text-slate-500">
                        {r.snippet}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
