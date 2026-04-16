import { create } from 'zustand';
import {
  CellCoord,
  CellValue,
  Column,
  ColumnType,
  Row,
  SavedView,
  SelectionRange,
  Sheet,
  ViewMode,
  Workbook,
} from '../types/sheet';
import { createEmptyRow, createPresetColumns } from './presetColumns';
import {
  createInitialWorkbook,
  loadCloudSyncedAt,
  loadLocalUpdatedAt,
  loadWorkbook,
  maybeAutoBackup,
  resetMigrationFlag,
  saveCloudSyncedAt,
  saveLocalUpdatedAt,
  saveWorkbook,
} from './persistence';
import { historyStack } from './history';
import {
  BUILTIN_VIEWS,
  loadSavedViews,
  mergeWithBuiltins,
  persistSavedViews,
} from './savedViews';
import { firebaseEnabled, signInWithGoogle, signOut as fbSignOut, User } from './firebase';
import { pullWorkbook, pushWorkbook } from './cloudSync';
import { clearCryptoCache } from './crypto';

interface SheetState {
  workbook: Workbook;
  view: ViewMode;
  hydrated: boolean;

  // selection
  selection: CellCoord | null;
  selectionRange: SelectionRange | null;
  selectedRowIds: string[];

  // filter / sort (per active sheet, simplest model)
  searchQuery: string;
  filterIndustry: string | null;
  filterStatus: string | null;
  sortColumnId: string | null;
  sortDir: 'asc' | 'desc';

  // saved views
  savedViews: SavedView[];
  activeViewId: string | null;

  // history version (bumped after undo/redo so subscribers re-render)
  historyVersion: number;

  /* ----------- cloud / auth ----------- */
  cloudEnabled: boolean;
  user: User | null;
  cloudSalt: string | null;
  passphrase: string | null;
  cloudStatus: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  cloudLastSyncedAt: Date | null;
  /**
   * Timestamp of the last local user mutation that has not yet been
   * successfully pushed to the cloud. `null` means the local workbook
   * is clean (matches the last cloud sync or has never been edited).
   * Persisted in IndexedDB via `saveLocalUpdatedAt`.
   */
  workbookUpdatedAt: string | null;
  cloudError: string | null;
  setUser: (u: User | null) => void;
  setPassphrase: (p: string | null) => void;
  signInGoogle: () => Promise<void>;
  signOutCloud: () => Promise<void>;
  pullFromCloud: () => Promise<void>;
  pushToCloud: () => Promise<void>;

  /* ----------- lifecycle ----------- */
  hydrate: (uid: string) => Promise<void>;

  /* ----------- view / filter ----------- */
  setView: (v: ViewMode) => void;
  setSearch: (q: string) => void;
  setFilterIndustry: (v: string | null) => void;
  setFilterStatus: (v: string | null) => void;
  toggleSort: (colId: string) => void;

  /* ----------- selection ----------- */
  setSelection: (c: CellCoord | null) => void;
  setSelectionRange: (r: SelectionRange | null) => void;
  moveSelection: (dx: number, dy: number) => void;
  clearSelection: () => void;
  setSelectedRowIds: (ids: string[]) => void;
  toggleRowSelected: (rowId: string, mode: 'single' | 'add' | 'range') => void;

  /* ----------- row mutations ----------- */
  addRow: () => string;
  duplicateRow: (rowId: string) => void;
  deleteRow: (rowId: string) => void;
  deleteRows: (rowIds: string[]) => void;
  updateCell: (rowId: string, colId: string, value: CellValue) => void;
  applyCellUpdates: (
    updates: { rowId: string; colId: string; value: CellValue }[],
  ) => void;
  setStatus: (rowId: string, status: string) => void;
  togglePinRow: (rowId: string) => void;

  /* ----------- column mutations ----------- */
  addColumn: (col: Omit<Column, 'id'>) => void;
  deleteColumn: (colId: string) => void;
  renameColumn: (colId: string, name: string) => void;
  setColumnWidth: (colId: string, width: number) => void;

  /* ----------- sheet management ----------- */
  addSheet: (name?: string) => void;
  deleteSheet: (sheetId: string) => void;
  renameSheet: (sheetId: string, name: string) => void;
  duplicateSheet: (sheetId: string) => void;
  switchSheet: (sheetId: string) => void;

  /* ----------- bulk / reset ----------- */
  replaceActiveSheet: (data: { columns: Column[]; rows: Row[] }) => void;
  resetActiveSheetToPreset: () => void;
  replaceWorkbook: (wb: Workbook) => void;

  /* ----------- history ----------- */
  undo: () => boolean;
  redo: () => boolean;

  /* ----------- saved views ----------- */
  saveCurrentAsView: (name: string) => void;
  deleteSavedView: (id: string) => void;
  applySavedView: (id: string) => void;
}

/* ====================================================================== */
/* helpers                                                                  */
/* ====================================================================== */

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let cloudTimer: ReturnType<typeof setTimeout> | null = null;
/** Tracks which UID was last hydrated to avoid redundant re-loads. */
let lastHydratedUid: string | null = null;
/**
 * Persist `wb` to IndexedDB (debounced) and, if signed in, push to the
 * cloud (longer debounce).
 *
 * `opts.markDirty`:
 *   - true  (default): a user mutation. Stamps `workbookUpdatedAt` so the
 *     next `pullFromCloud` knows local has unsynced changes.
 *   - false: the workbook is being replaced by a trusted cloud pull
 *     (or similar system-initiated reset). Do NOT mark dirty — otherwise
 *     every pull would immediately look like a local edit and cause a
 *     false "conflict" on the next sign-in.
 */
function getUid(): string | null {
  return useSheet.getState().user?.uid ?? null;
}

function scheduleSave(wb: Workbook, opts: { markDirty?: boolean } = {}) {
  const markDirty = opts.markDirty !== false;
  if (markDirty) {
    const iso = new Date().toISOString();
    useSheet.setState({ workbookUpdatedAt: iso });
    const u = getUid();
    if (u) void saveLocalUpdatedAt(u, iso);
  }
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const u = getUid();
    if (u) saveWorkbook(u, wb);
  }, 400);
  // Cloud push: longer debounce so we batch many edits
  if (cloudTimer) clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => {
    const s = useSheet.getState();
    if (s.user && firebaseEnabled) {
      void s.pushToCloud();
    }
  }, 1500);
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultForType(t: ColumnType): CellValue {
  if (t === 'rating') return 0;
  if (t === 'checkbox') return false;
  return '';
}

/** Returns the active sheet, or throws if absent. */
export function getActiveSheet(state: { workbook: Workbook }): Sheet {
  const { workbook } = state;
  const found = workbook.sheets.find((s) => s.id === workbook.activeSheetId);
  if (!found) return workbook.sheets[0];
  return found;
}

/** Pure helper: produce a new workbook by replacing a sheet via updater. */
function withSheet(wb: Workbook, sheetId: string, updater: (s: Sheet) => Sheet): Workbook {
  return {
    ...wb,
    sheets: wb.sheets.map((s) => (s.id === sheetId ? updater(s) : s)),
  };
}

function snapshotSheet(s: Sheet) {
  return {
    sheetId: s.id,
    columns: s.columns.map((c) => ({ ...c })),
    rows: s.rows.map((r) => ({ ...r, cells: { ...r.cells } })),
  };
}

/* ====================================================================== */
/* store                                                                    */
/* ====================================================================== */

export const useSheet = create<SheetState>((set, get) => {
  /** Wrap a sheet mutation: snapshots history, applies updater, persists. */
  function mutateActiveSheet(updater: (s: Sheet) => Sheet) {
    const state = get();
    const active = getActiveSheet(state);
    historyStack.push(snapshotSheet(active));
    const wb = withSheet(state.workbook, active.id, updater);
    set({ workbook: wb });
    scheduleSave(wb);
  }

  return {
    workbook: createInitialWorkbook(),
    view: 'sheet',
    hydrated: false,

    selection: null,
    selectionRange: null,
    selectedRowIds: [],

    searchQuery: '',
    filterIndustry: null,
    filterStatus: null,
    sortColumnId: null,
    sortDir: 'asc',

    savedViews: BUILTIN_VIEWS.slice(),
    activeViewId: null,
    historyVersion: 0,

    cloudEnabled: firebaseEnabled,
    user: null,
    cloudSalt: null,
    passphrase: null,
    cloudStatus: firebaseEnabled ? 'idle' : 'offline',
    cloudLastSyncedAt: null,
    workbookUpdatedAt: null,
    cloudError: null,

    /* ----------- lifecycle ----------- */
    hydrate: async (userUid: string) => {
      // Skip if already hydrated for this exact UID (setUser + SpreadsheetRoot
      // may both call hydrate — only the first one needs to run).
      if (lastHydratedUid === userUid && get().hydrated) return;
      lastHydratedUid = userUid;

      const loaded = await loadWorkbook(userUid);
      let wb: Workbook;
      if (loaded) {
        wb = loaded;
      } else {
        // first run: seed with one sample row
        const cols = createPresetColumns();
        const seed: Row = createEmptyRow(cols);
        seed.cells['company'] = '株式会社サンプル';
        seed.cells['industry'] = 'IT・ソフトウェア';
        seed.cells['kubun'] = '本選考';
        seed.cells['rating'] = 5;
        seed.cells['status'] = 'ES提出済';
        seed.cells['es_deadline'] = new Date().toISOString().slice(0, 10);
        seed.cells['memo'] = 'まずはここを編集してみてください';
        const sheet: Sheet = { id: uid('s'), name: '本選考', columns: cols, rows: [seed] };
        wb = { version: 2, sheets: [sheet], activeSheetId: sheet.id };
        await saveWorkbook(userUid, wb);
      }
      const userViews = await loadSavedViews(userUid);
      const localUpdatedAt = await loadLocalUpdatedAt(userUid);
      set({
        workbook: wb,
        hydrated: true,
        savedViews: mergeWithBuiltins(userViews),
        workbookUpdatedAt: localUpdatedAt,
      });
      maybeAutoBackup(userUid, wb);
    },

    /* ----------- view / filter ----------- */
    setView: (v) => set({ view: v }),
    setSearch: (q) => set({ searchQuery: q, activeViewId: null }),
    setFilterIndustry: (v) => set({ filterIndustry: v, activeViewId: null }),
    setFilterStatus: (v) => set({ filterStatus: v, activeViewId: null }),
    toggleSort: (colId) =>
      set((s) => {
        if (s.sortColumnId === colId) {
          if (s.sortDir === 'asc') return { sortDir: 'desc', activeViewId: null };
          return { sortColumnId: null, sortDir: 'asc', activeViewId: null };
        }
        return { sortColumnId: colId, sortDir: 'asc', activeViewId: null };
      }),

    /* ----------- selection ----------- */
    setSelection: (c) => set({ selection: c, selectionRange: null }),
    setSelectionRange: (r) => set({ selectionRange: r }),
    moveSelection: (dx, dy) => {
      const state = get();
      const sel = state.selection;
      const sheet = getActiveSheet(state);
      if (!sel) {
        if (sheet.rows.length && sheet.columns.length) {
          set({
            selection: { rowId: sheet.rows[0].id, colId: sheet.columns[0].id },
            selectionRange: null,
          });
        }
        return;
      }
      const ri = sheet.rows.findIndex((r) => r.id === sel.rowId);
      const ci = sheet.columns.findIndex((c) => c.id === sel.colId);
      if (ri < 0 || ci < 0) return;
      let nr = ri + dy;
      let nc = ci + dx;
      // wrap on horizontal overflow
      if (nc >= sheet.columns.length) {
        nc = 0;
        nr += 1;
      } else if (nc < 0) {
        nc = sheet.columns.length - 1;
        nr -= 1;
      }
      if (nr < 0 || nr >= sheet.rows.length) return;
      set({
        selection: { rowId: sheet.rows[nr].id, colId: sheet.columns[nc].id },
        selectionRange: null,
      });
    },
    clearSelection: () => set({ selection: null, selectionRange: null, selectedRowIds: [] }),
    setSelectedRowIds: (ids) => set({ selectedRowIds: ids }),
    toggleRowSelected: (rowId, mode) => {
      const state = get();
      const cur = state.selectedRowIds;
      if (mode === 'single') {
        set({ selectedRowIds: [rowId] });
        return;
      }
      if (mode === 'add') {
        set({
          selectedRowIds: cur.includes(rowId)
            ? cur.filter((x) => x !== rowId)
            : [...cur, rowId],
        });
        return;
      }
      if (mode === 'range') {
        const sheet = getActiveSheet(state);
        const last = cur[cur.length - 1];
        const lastIdx = last ? sheet.rows.findIndex((r) => r.id === last) : -1;
        const targetIdx = sheet.rows.findIndex((r) => r.id === rowId);
        if (lastIdx < 0 || targetIdx < 0) {
          set({ selectedRowIds: [rowId] });
          return;
        }
        const [a, b] = lastIdx < targetIdx ? [lastIdx, targetIdx] : [targetIdx, lastIdx];
        set({ selectedRowIds: sheet.rows.slice(a, b + 1).map((r) => r.id) });
      }
    },

    /* ----------- row mutations ----------- */
    addRow: () => {
      const state = get();
      const active = getActiveSheet(state);
      const newRow = createEmptyRow(active.columns);
      mutateActiveSheet((s) => ({ ...s, rows: [...s.rows, newRow] }));
      return newRow.id;
    },

    duplicateRow: (rowId) => {
      mutateActiveSheet((s) => {
        const idx = s.rows.findIndex((r) => r.id === rowId);
        if (idx < 0) return s;
        const src = s.rows[idx];
        const copy: Row = { id: uid('r'), cells: { ...src.cells } };
        const rows = [...s.rows];
        rows.splice(idx + 1, 0, copy);
        return { ...s, rows };
      });
    },

    deleteRow: (rowId) => {
      mutateActiveSheet((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== rowId) }));
    },

    deleteRows: (rowIds) => {
      const ids = new Set(rowIds);
      mutateActiveSheet((s) => ({ ...s, rows: s.rows.filter((r) => !ids.has(r.id)) }));
      set({ selectedRowIds: [] });
    },

    updateCell: (rowId, colId, value) => {
      mutateActiveSheet((s) => ({
        ...s,
        rows: s.rows.map((r) =>
          r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r,
        ),
      }));
    },

    applyCellUpdates: (updates) => {
      if (!updates.length) return;
      mutateActiveSheet((s) => {
        const byRow = new Map<string, Record<string, CellValue>>();
        for (const u of updates) {
          if (!byRow.has(u.rowId)) byRow.set(u.rowId, {});
          byRow.get(u.rowId)![u.colId] = u.value;
        }
        return {
          ...s,
          rows: s.rows.map((r) => {
            const patch = byRow.get(r.id);
            if (!patch) return r;
            return { ...r, cells: { ...r.cells, ...patch } };
          }),
        };
      });
    },

    setStatus: (rowId, status) => {
      get().updateCell(rowId, 'status', status);
    },

    togglePinRow: (rowId) => {
      mutateActiveSheet((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.id === rowId ? { ...r, pinned: !r.pinned } : r)),
      }));
    },

    /* ----------- column mutations ----------- */
    addColumn: (col) => {
      mutateActiveSheet((s) => {
        const newCol: Column = { id: uid('c'), ...col };
        const rows = s.rows.map((r) => ({
          ...r,
          cells: { ...r.cells, [newCol.id]: defaultForType(newCol.type) },
        }));
        return { ...s, columns: [...s.columns, newCol], rows };
      });
    },

    deleteColumn: (colId) => {
      mutateActiveSheet((s) => {
        const columns = s.columns.filter((c) => c.id !== colId);
        const rows = s.rows.map((r) => {
          const { [colId]: _drop, ...rest } = r.cells;
          return { ...r, cells: rest };
        });
        return { ...s, columns, rows };
      });
    },

    renameColumn: (colId, name) => {
      mutateActiveSheet((s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === colId ? { ...c, name } : c)),
      }));
    },

    setColumnWidth: (colId, width) => {
      // Width changes are not pushed to history (UX nicety)
      const state = get();
      const active = getActiveSheet(state);
      const wb = withSheet(state.workbook, active.id, (s) => ({
        ...s,
        columns: s.columns.map((c) => (c.id === colId ? { ...c, width } : c)),
      }));
      set({ workbook: wb });
      scheduleSave(wb);
    },

    /* ----------- sheet management ----------- */
    addSheet: (name) => {
      const state = get();
      const sheet: Sheet = {
        id: uid('s'),
        name: name ?? `シート${state.workbook.sheets.length + 1}`,
        columns: createPresetColumns(),
        rows: [],
      };
      const wb: Workbook = {
        ...state.workbook,
        sheets: [...state.workbook.sheets, sheet],
        activeSheetId: sheet.id,
      };
      historyStack.clear();
      set({ workbook: wb, selection: null, selectionRange: null, selectedRowIds: [] });
      scheduleSave(wb);
    },

    deleteSheet: (sheetId) => {
      const state = get();
      if (state.workbook.sheets.length <= 1) return;
      const sheets = state.workbook.sheets.filter((s) => s.id !== sheetId);
      const activeSheetId =
        state.workbook.activeSheetId === sheetId
          ? sheets[0].id
          : state.workbook.activeSheetId;
      const wb: Workbook = { ...state.workbook, sheets, activeSheetId };
      historyStack.clear();
      set({ workbook: wb, selection: null, selectionRange: null, selectedRowIds: [] });
      scheduleSave(wb);
    },

    renameSheet: (sheetId, name) => {
      const state = get();
      const wb = withSheet(state.workbook, sheetId, (s) => ({ ...s, name }));
      set({ workbook: wb });
      scheduleSave(wb);
    },

    duplicateSheet: (sheetId) => {
      const state = get();
      const src = state.workbook.sheets.find((s) => s.id === sheetId);
      if (!src) return;
      const copy: Sheet = {
        id: uid('s'),
        name: `${src.name} のコピー`,
        columns: src.columns.map((c) => ({ ...c })),
        rows: src.rows.map((r) => ({ ...r, cells: { ...r.cells } })),
      };
      const wb: Workbook = {
        ...state.workbook,
        sheets: [...state.workbook.sheets, copy],
        activeSheetId: copy.id,
      };
      historyStack.clear();
      set({ workbook: wb, selection: null, selectionRange: null, selectedRowIds: [] });
      scheduleSave(wb);
    },

    switchSheet: (sheetId) => {
      const state = get();
      if (!state.workbook.sheets.some((s) => s.id === sheetId)) return;
      const wb: Workbook = { ...state.workbook, activeSheetId: sheetId };
      historyStack.clear();
      set({
        workbook: wb,
        selection: null,
        selectionRange: null,
        selectedRowIds: [],
      });
      scheduleSave(wb);
    },

    /* ----------- bulk / reset ----------- */
    replaceActiveSheet: (data) => {
      mutateActiveSheet((s) => ({ ...s, columns: data.columns, rows: data.rows }));
    },

    resetActiveSheetToPreset: () => {
      mutateActiveSheet((s) => ({ ...s, columns: createPresetColumns(), rows: [] }));
    },

    replaceWorkbook: (wb) => {
      historyStack.clear();
      set({
        workbook: wb,
        selection: null,
        selectionRange: null,
        selectedRowIds: [],
      });
      scheduleSave(wb);
    },

    /* ----------- history ----------- */
    undo: () => {
      const state = get();
      const active = getActiveSheet(state);
      const restored = historyStack.undo(snapshotSheet(active));
      if (!restored) return false;
      const wb = withSheet(state.workbook, active.id, (s) => ({
        ...s,
        columns: restored.columns,
        rows: restored.rows,
      }));
      set({ workbook: wb, historyVersion: state.historyVersion + 1 });
      scheduleSave(wb);
      return true;
    },

    redo: () => {
      const state = get();
      const active = getActiveSheet(state);
      const restored = historyStack.redo(snapshotSheet(active));
      if (!restored) return false;
      const wb = withSheet(state.workbook, active.id, (s) => ({
        ...s,
        columns: restored.columns,
        rows: restored.rows,
      }));
      set({ workbook: wb, historyVersion: state.historyVersion + 1 });
      scheduleSave(wb);
      return true;
    },

    /* ----------- saved views ----------- */
    saveCurrentAsView: (name) => {
      const state = get();
      const view: SavedView = {
        id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        sheetId: state.workbook.activeSheetId,
        search: state.searchQuery,
        industry: state.filterIndustry,
        status: state.filterStatus,
        sortColumnId: state.sortColumnId,
        sortDir: state.sortDir,
        builtin: false,
      };
      const next = [...state.savedViews, view];
      set({ savedViews: next, activeViewId: view.id });
      const u = getUid();
      if (u) persistSavedViews(u, next);
    },

    deleteSavedView: (id) => {
      const state = get();
      const next = state.savedViews.filter((v) => v.id !== id);
      set({
        savedViews: next,
        activeViewId: state.activeViewId === id ? null : state.activeViewId,
      });
      const u = getUid();
      if (u) persistSavedViews(u, next);
    },

    applySavedView: (id) => {
      const state = get();
      const v = state.savedViews.find((x) => x.id === id);
      if (!v) return;
      set({
        searchQuery: v.search,
        filterIndustry: v.industry,
        filterStatus: v.status,
        sortColumnId: v.sortColumnId,
        sortDir: v.sortDir,
        activeViewId: v.id,
      });
    },

    /* ----------- cloud / auth ----------- */
    setUser: (u) => {
      set({ user: u });
      if (u) {
        // Try to restore passphrase from sessionStorage (per-tab cache)
        try {
          const stash = sessionStorage.getItem(`shukatsu-passphrase-${u.uid}`);
          if (stash) set({ passphrase: stash });
        } catch {}
        // Hydrate the per-user workbook FIRST, then restore cloud sync
        // state and pull. This ensures the UID-scoped data (including
        // migration from the shared key) is loaded before any cloud
        // operations compare local vs remote.
        void (async () => {
          await get().hydrate(u.uid);
          const iso = await loadCloudSyncedAt(u.uid);
          set({ cloudLastSyncedAt: iso ? new Date(iso) : null });
          await get().pullFromCloud();
          // Recovery: if after hydrate + cloud pull the workbook is still
          // the empty seed (1 row with "株式会社サンプル"), this user may
          // be the real owner whose data was lost by the v0.2.5 cleanup
          // bug. Reset the migration flag and retry from the shared key.
          const wb = get().workbook;
          const isSeed =
            wb.sheets.length === 1 &&
            wb.sheets[0].rows.length <= 1 &&
            wb.sheets[0].rows[0]?.cells?.['company'] === '株式会社サンプル';
          if (isSeed) {
            await resetMigrationFlag();
            lastHydratedUid = null; // allow re-hydrate
            await get().hydrate(u.uid);
          }
        })();
      } else {
        set({
          passphrase: null,
          cloudSalt: null,
          cloudLastSyncedAt: null,
          cloudStatus: firebaseEnabled ? 'idle' : 'offline',
        });
        clearCryptoCache();
      }
    },

    setPassphrase: (p) => {
      const state = get();
      set({ passphrase: p });
      if (p && state.user) {
        try {
          sessionStorage.setItem(`shukatsu-passphrase-${state.user.uid}`, p);
        } catch {}
      }
    },

    signInGoogle: async () => {
      try {
        set({ cloudStatus: 'syncing', cloudError: null });
        await signInWithGoogle();
        // onAuthStateChanged → setUser will fire pullFromCloud
      } catch (e) {
        set({
          cloudStatus: 'error',
          cloudError: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    },

    signOutCloud: async () => {
      await fbSignOut();
      set({
        user: null,
        passphrase: null,
        cloudSalt: null,
        cloudStatus: firebaseEnabled ? 'idle' : 'offline',
      });
      clearCryptoCache();
    },

    pullFromCloud: async () => {
      const state = get();
      if (!state.user) return;
      if (state.cloudStatus === 'syncing') return; // Guard: prevent concurrent sync
      try {
        set({ cloudStatus: 'syncing', cloudError: null });
        const result = await pullWorkbook(state.user.uid, state.passphrase);

        // No cloud doc yet → push current local as initial.
        if (!result) {
          await get().pushToCloud();
          return;
        }

        // Does the local workbook have edits that have not yet been pushed?
        const localDirty =
          state.workbookUpdatedAt != null &&
          (!state.cloudLastSyncedAt ||
            new Date(state.workbookUpdatedAt) > state.cloudLastSyncedAt);

        // Has the cloud document changed since the last time we synced
        // with it on this device?
        const cloudChanged =
          !state.cloudLastSyncedAt ||
          (result.updatedAt != null &&
            result.updatedAt > state.cloudLastSyncedAt);

        if (localDirty && cloudChanged) {
          // Real conflict: both sides have diverged. Preserve local data
          // (the bug this fix addresses was blindly overwriting local) and
          // surface an error so the user can resolve it manually.
          set({
            cloudSalt: result.salt,
            cloudStatus: 'error',
            cloudError:
              'ローカルとクラウドの両方に変更があります。手動で解決するまでクラウド同期を一時停止します。',
          });
          return;
        }

        if (localDirty) {
          // Local is ahead of cloud → push it.
          set({ cloudSalt: result.salt });
          await get().pushToCloud();
          return;
        }

        if (cloudChanged) {
          // Cloud is ahead and local is clean → safe to take cloud.
          historyStack.clear();
          const syncedAt = result.updatedAt ?? new Date();
          set({
            workbook: result.workbook,
            cloudSalt: result.salt,
            cloudStatus: 'synced',
            cloudLastSyncedAt: syncedAt,
            workbookUpdatedAt: null,
            selection: null,
            selectionRange: null,
            selectedRowIds: [],
          });
          // Persist the new workbook WITHOUT marking it dirty — otherwise
          // the pulled data would immediately look like an unsynced edit.
          scheduleSave(result.workbook, { markDirty: false });
          await saveCloudSyncedAt(state.user.uid, syncedAt.toISOString());
          await saveLocalUpdatedAt(state.user.uid, null);
          return;
        }

        // Everything is already in sync.
        set({ cloudSalt: result.salt, cloudStatus: 'synced' });
      } catch (e) {
        set({
          cloudStatus: 'error',
          cloudError: e instanceof Error ? e.message : String(e),
        });
      }
    },

    pushToCloud: async () => {
      const state = get();
      if (!state.user) return;
      if (state.cloudStatus === 'syncing') return; // Guard: prevent concurrent sync
      try {
        set({ cloudStatus: 'syncing', cloudError: null });
        const { salt } = await pushWorkbook(state.user.uid, state.workbook, {
          passphrase: state.passphrase,
          salt: state.cloudSalt,
        });
        const now = new Date();
        set({
          cloudSalt: salt,
          cloudStatus: 'synced',
          cloudLastSyncedAt: now,
          workbookUpdatedAt: null,
        });
        // Persist the successful-sync markers so that the next page load
        // (or sign-in on this device) knows local is already clean and
        // matches the cloud at `now`.
        await saveCloudSyncedAt(state.user.uid, now.toISOString());
        await saveLocalUpdatedAt(state.user.uid, null);
      } catch (e) {
        set({
          cloudStatus: 'error',
          cloudError: e instanceof Error ? e.message : String(e),
        });
      }
    },
  };
});

/** Convenience selector hook for the active sheet. */
export function useActiveSheet(): Sheet {
  return useSheet((s) => getActiveSheet(s));
}
