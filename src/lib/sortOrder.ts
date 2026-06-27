// Persists custom display order for files/folders in the sidebar tree.
// Each folder's child order is stored as an array of names keyed by the
// folder's path (joined with '/').  Empty string = workspace root.
import type { WorkspaceNode } from '../types';

const KEY = 'aisyuukatsu:sortOrder';
const MODE_KEY = 'aisyuukatsu:sortMode';
const CREATED_KEY = 'aisyuukatsu:createdAt';

function load(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}

function save(data: Record<string, string[]>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage disabled */
  }
}

/**
 * Persist the display order of children inside a folder.
 * @param folderKey  Folder path joined with '/', or '' for workspace root.
 * @param childNames Ordered array of child node names.
 */
export function saveFolderOrder(folderKey: string, childNames: string[]): void {
  const data = load();
  data[folderKey] = childNames;
  save(data);
}

/**
 * Sort children according to the persisted order for the given folder.
 * Nodes not present in the saved order are appended at the end in
 * their original (alphabetical) order.
 */
export function getSortedChildren<T extends { name: string }>(
  folderKey: string,
  children: T[],
): T[] {
  const data = load();
  const order = data[folderKey];
  if (!order || order.length === 0) return children;

  const indexMap = new Map<string, number>();
  for (let i = 0; i < order.length; i++) {
    indexMap.set(order[i], i);
  }

  const known: T[] = [];
  const unknown: T[] = [];
  for (const child of children) {
    if (indexMap.has(child.name)) {
      known.push(child);
    } else {
      unknown.push(child);
    }
  }

  known.sort((a, b) => (indexMap.get(a.name) ?? 0) - (indexMap.get(b.name) ?? 0));
  // Unknown nodes keep their original (alphabetical) order.
  return [...known, ...unknown];
}

// ── Sort mode ────────────────────────────────────────────────────────────
// The tree can be ordered three ways. `manual` is the historical behaviour
// (drag-to-reorder, falling back to the ja-locale name order baked in by the
// workspace scanner). The two `created*` modes order by an app-managed
// "first seen / created" timestamp — true filesystem birthtime is unavailable
// in the browser and unreliable on desktop, so we stamp our own.

export type SortMode = 'manual' | 'createdAsc' | 'createdDesc';

const SORT_MODES: ReadonlySet<string> = new Set([
  'manual',
  'createdAsc',
  'createdDesc',
]);

export function getSortMode(): SortMode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw && SORT_MODES.has(raw)) return raw as SortMode;
  } catch {
    /* storage disabled */
  }
  return 'manual';
}

export function setSortMode(mode: SortMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* storage disabled */
  }
}

// ── Created-at map ───────────────────────────────────────────────────────
// Keyed by a node's path (joined with '/') — the same key the tree uses.

function loadCreated(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CREATED_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function saveCreated(data: Record<string, number>): void {
  try {
    localStorage.setItem(CREATED_KEY, JSON.stringify(data));
  } catch {
    /* storage disabled */
  }
}

export function getCreatedAtMap(): Record<string, number> {
  return loadCreated();
}

/**
 * Stamp every key not yet recorded with `now`, so each file/folder gets a
 * stable "first seen by the app" time. Pre-existing files all collapse to the
 * same timestamp on first run (no per-file history exists) and tie-break on
 * name; files added later get strictly later stamps and sort after them —
 * which is exactly the desired creation order going forward. Returns the
 * (possibly updated) map. Persists only when something changed.
 */
export function ensureCreatedAt(
  keys: string[],
  now: number,
): Record<string, number> {
  const map = loadCreated();
  let changed = false;
  for (const k of keys) {
    if (map[k] == null) {
      map[k] = now;
      changed = true;
    }
  }
  if (changed) saveCreated(map);
  return map;
}

/**
 * Order tree nodes for display under the given mode. `manual` defers to
 * {@link getSortedChildren}; the created modes sort purely by timestamp
 * (oldest- or newest-first), tie-breaking on ja-locale name order. `createdMap`
 * is passed in so callers can read it once per render instead of per folder.
 */
export function sortNodes(
  folderKey: string,
  children: WorkspaceNode[],
  mode: SortMode,
  createdMap: Record<string, number>,
): WorkspaceNode[] {
  if (mode === 'manual') return getSortedChildren(folderKey, children);

  const dir = mode === 'createdDesc' ? -1 : 1;
  const stampOf = (n: WorkspaceNode) => createdMap[n.path.join('/')] ?? 0;
  return [...children].sort((a, b) => {
    const ta = stampOf(a);
    const tb = stampOf(b);
    if (ta !== tb) return (ta - tb) * dir;
    return a.name.localeCompare(b.name, 'ja');
  });
}

