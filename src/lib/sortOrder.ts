// Persists custom display order for files/folders in the sidebar tree.
// Each folder's child order is stored as an array of names keyed by the
// folder's path (joined with '/').  Empty string = workspace root.

const KEY = 'aisyuukatsu:sortOrder';

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
