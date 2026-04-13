import { get, set } from 'idb-keyval';
import { SavedView } from '../types/sheet';

const KEY_SHARED = 'shukatsu-saved-views-v1';
function keyForUser(uid: string) { return `shukatsu-saved-views-v1:${uid}`; }

/** Built-in views always available regardless of persisted state. */
export const BUILTIN_VIEWS: SavedView[] = [
  {
    id: 'builtin:all',
    name: 'すべて',
    sheetId: '*',
    search: '',
    industry: null,
    status: null,
    sortColumnId: null,
    sortDir: 'asc',
    builtin: true,
  },
  {
    id: 'builtin:deadline',
    name: '期限が近い順',
    sheetId: '*',
    search: '',
    industry: null,
    status: null,
    sortColumnId: 'es_deadline',
    sortDir: 'asc',
    builtin: true,
  },
  {
    id: 'builtin:offers',
    name: '内定獲得',
    sheetId: '*',
    search: '',
    industry: null,
    status: '内定',
    sortColumnId: null,
    sortDir: 'asc',
    builtin: true,
  },
];

export async function loadSavedViews(uid: string): Promise<SavedView[]> {
  try {
    // Try per-user key first
    const data = await get<SavedView[]>(keyForUser(uid));
    if (data) return data;
    // Migrate from shared key (one-time)
    const shared = await get<SavedView[]>(KEY_SHARED);
    if (shared && shared.length) {
      await set(keyForUser(uid), shared);
      // Don't delete shared key — safety backup
    }
    return shared ?? [];
  } catch (e) {
    console.error('loadSavedViews failed', e);
    return [];
  }
}

export async function persistSavedViews(uid: string, views: SavedView[]): Promise<void> {
  try {
    // Never persist built-ins
    const filtered = views.filter((v) => !v.builtin);
    await set(keyForUser(uid), filtered);
  } catch (e) {
    console.error('persistSavedViews failed', e);
  }
}

export function createSavedView(input: Omit<SavedView, 'id' | 'builtin'>): SavedView {
  return {
    ...input,
    id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    builtin: false,
  };
}

/** Merge built-ins with user views, deduped by id. Built-ins always come first. */
export function mergeWithBuiltins(userViews: SavedView[]): SavedView[] {
  const seen = new Set(BUILTIN_VIEWS.map((v) => v.id));
  return [...BUILTIN_VIEWS, ...userViews.filter((v) => !seen.has(v.id))];
}
