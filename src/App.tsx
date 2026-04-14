import { useEffect, useMemo, useState } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { LoginScreen } from './components/onboarding/LoginScreen';
import { LandingPage } from './components/LandingPage';
import { isOnboarded } from './lib/onboardingState';
import { isTauri } from './lib/tauriFsaShim';
import { UpdateBanner } from './components/UpdateBanner';
import { FileTree, type ContextMenuRequest } from './components/FileTree';
import { TabBar } from './components/TabBar';
import { TabViewer } from './components/TabViewer';
import { AddCompanyModal } from './components/AddCompanyModal';
import { AddFolderModal } from './components/AddFolderModal';
import { AddFileModal } from './components/AddFileModal';
import { FileContextMenu, type ContextMenuTarget } from './components/FileContextMenu';
import { ConfirmDialog } from './components/ConfirmDialog';
import { RenameDialog } from './components/RenameDialog';
import type { TargetLocation } from './components/LocationPicker';
import { useRootDirectory } from './hooks/useRootDirectory';
import { useWorkspace } from './hooks/useWorkspace';
import { useOpenTabs } from './hooks/useOpenTabs';
import { useCompanyMaster } from './hooks/useCompanyMaster';
import { addCompanyToMaster } from './lib/companyMasterSync';
import { SpreadsheetRoot } from './spreadsheet/SpreadsheetRoot';
import { firebaseEnabled, watchAuth } from './spreadsheet/lib/firebase';
import { useSheet } from './spreadsheet/lib/store';
import {
  createEmptyFile,
  createSubdirectory,
  deleteFileEntry,
  deleteFolderEntry,
  ensureMdExtension,
  fileExists,
  moveFileEntry,
  moveFolderEntry,
  renameFileEntry,
  renameFolderEntry,
  subdirectoryExists,
  writeTextFile,
} from './lib/fs';
import { writeCompanyFolder } from './lib/companyFolderCreator';
import { saveFolderOrder } from './lib/sortOrder';
import { lookupIndustry } from './lib/companyIndustryMap';
import { pullIndustryResearch } from './lib/industryResearchSync';
import { resolveFolderByPath } from './lib/workspace';
import type { Workspace, WorkspaceNode } from './types';

/**
 * Resolve `path` (from workspace root) to a directory handle. An empty path
 * means the workspace root itself.
 */
function resolveNodeByPath(
  workspace: Workspace,
  path: string[],
): FileSystemDirectoryHandle {
  if (path.length === 0) return workspace.root;
  const folder = resolveFolderByPath(workspace.tree, path);
  if (!folder) throw new Error('対象のフォルダが見つかりません');
  return folder.handle;
}

/** Find the kind of a node at the given path in the workspace tree. */
function findNodeKind(
  tree: WorkspaceNode[],
  path: string[],
): 'file' | 'folder' | null {
  if (path.length === 0) return null;
  const [head, ...rest] = path;
  for (const node of tree) {
    if (node.name !== head) continue;
    if (rest.length === 0) return node.kind;
    if (node.kind === 'folder') return findNodeKind(node.children, rest);
    return null;
  }
  return null;
}

export default function App() {
  // Reactive auth state from the spreadsheet store. Drives the top-level
  // auth gate below so that signing out (which flips store.user to null)
  // immediately routes the user back to the LoginScreen.
  const authUser = useSheet((s) => s.user);
  // `authChecked` becomes true once Firebase's onAuthStateChanged has fired
  // at least once. Without this we'd flash the LoginScreen for a moment on
  // every reload while Firebase is still determining the current user.
  // In Firebase-less environments (local dev) we start as `true` so the
  // gate is skipped entirely.
  const [authChecked, setAuthChecked] = useState(!firebaseEnabled);

  const { handle, status, pick, adopt, requestPermission, reset } =
    useRootDirectory(authUser?.uid ?? null);
  const root = status === 'ready' ? handle : null;
  const { workspace, loading, error, refresh } = useWorkspace(root);

  const tabs = useOpenTabs();
  const [showAdd, setShowAdd] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const { names: companySuggestions } = useCompanyMaster();

  // Right-click context menu state (anchor + target) lives here so we can
  // render the menu overlay and the rename/delete dialogs it triggers.
  const [ctxAnchor, setCtxAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [ctxTarget, setCtxTarget] = useState<ContextMenuTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContextMenuTarget | null>(
    null,
  );
  const [renameTarget, setRenameTarget] = useState<ContextMenuTarget | null>(
    null,
  );

  // Subscribe to Firebase auth changes at the app root so the spreadsheet
  // store (user / passphrase) stays populated even when the SpreadsheetRoot
  // view is not mounted (e.g. while the user edits a markdown file).
  useEffect(() => {
    const setUser = useSheet.getState().setUser;
    const unsub = watchAuth((u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // After workspace refreshes, drop tabs whose files no longer exist.
  const validKeys = useMemo(() => {
    if (!workspace) return new Set<string>();
    const set = new Set<string>();

    const walk = (nodes: WorkspaceNode[]) => {
      for (const n of nodes) {
        if (n.kind === 'file') {
          set.add(`co:${n.path.join('/')}`);
        } else {
          walk(n.children);
        }
      }
    };

    walk(workspace.tree);
    for (const f of workspace.selfAnalysis.files) {
      set.add(`self/${f.name}`);
    }
    for (const f of workspace.templates.files) {
      set.add(`tpl/${f.name}`);
    }
    return set;
  }, [workspace]);

  useEffect(() => {
    if (!workspace) return;
    tabs.purgeMissing(validKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validKeys]);

  // Auth gate: while Firebase's initial onAuthStateChanged is still pending,
  // show a loading state so we don't flash LoginScreen for signed-in users.
  if (firebaseEnabled && !authChecked) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        読み込み中…
      </div>
    );
  }
  // Auth gate: if the user is signed out (either initial visit or after
  // clicking "サインアウト"), require re-authentication before showing any
  // local workspace UI. Root handle and onboarding flag are preserved, so
  // signing back in restores the previous state instantly.
  if (firebaseEnabled && !authUser) {
    // Desktop app → show the compact login screen (no marketing LP).
    // Browser → show the full landing page with download links etc.
    if (isTauri()) {
      return <LoginScreen variant="gate" user={null} onNext={() => {}} />;
    }
    return <LandingPage onSignIn={() => {}} />;
  }
  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        読み込み中…
      </div>
    );
  }
  if (status === 'no-handle' && authUser && !isOnboarded(authUser.uid)) {
    // First-time visitor → show the guided onboarding flow. Once finished,
    // we adopt the created "AI就活" subfolder as the root and fall through
    // to the normal MainLayout.
    return (
      <OnboardingFlow
        uid={authUser.uid}
        onComplete={(created) => {
          void adopt(created);
        }}
      />
    );
  }
  if (status === 'no-handle' || status === 'needs-permission') {
    return (
      <WelcomeScreen
        needsPermission={status === 'needs-permission'}
        onPick={() => void pick()}
        onRequestPermission={requestPermission}
      />
    );
  }
  if (!handle || !workspace) {
    if (loading) {
      return (
        <div className="flex h-screen items-center justify-center text-slate-500">
          読み込み中…
        </div>
      );
    }
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-slate-700">
          <p className="mb-1 font-medium">フォルダの読み込みに失敗しました</p>
          <p className="text-sm text-slate-500">
            {error ??
              '以前選択した AI就活 フォルダが見つかりません。Finder で移動・削除されていないか確認してください。'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            再試行
          </button>
          <button
            type="button"
            onClick={() => void reset()}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            フォルダを選び直す
          </button>
        </div>
      </div>
    );
  }

  const handleAddCompany = async (parentPath: string[], companyName: string) => {
    const industry = lookupIndustry(companyName);
    let parent: FileSystemDirectoryHandle;
    if (industry) {
      // 業界フォルダを自動作成（既存なら再利用）
      parent = await createSubdirectory(handle, industry);
      // 業界研究.md を書き込み（未作成の場合のみ）
      try {
        if (!(await fileExists(parent, '業界研究.md'))) {
          const content = await pullIndustryResearch(industry);
          if (content) {
            await writeTextFile(parent, '業界研究.md', content);
          }
        }
      } catch (e) {
        console.warn('[addCompany] industry research failed', e);
      }
    } else {
      // 未登録企業 → 従来通りユーザー選択の親フォルダ
      parent = resolveNodeByPath(workspace, parentPath);
    }
    await writeCompanyFolder(handle, parent, companyName);
    await refresh();
    setShowAdd(false);
    // Fire-and-forget: append to the global Firestore master so future
    // sessions (any user) get this name as a suggestion. We do not await or
    // surface errors — folder creation already succeeded.
    void addCompanyToMaster(companyName).catch((e) => {
      console.warn('[addCompanyToMaster] failed', e);
    });
  };

  const handleAddFolder = async (
    location: TargetLocation,
    folderName: string,
  ) => {
    const parent = resolveNodeByPath(workspace, location.path);
    if (await subdirectoryExists(parent, folderName)) {
      throw new Error('同じ名前のフォルダが既に存在します');
    }
    await createSubdirectory(parent, folderName);
    await refresh();
    setShowAddFolder(false);
  };

  const handleAddFile = async (
    location: TargetLocation,
    rawName: string,
  ) => {
    const parent = resolveNodeByPath(workspace, location.path);
    const name = ensureMdExtension(rawName);
    if (await fileExists(parent, name)) {
      throw new Error('同じ名前のファイルが既に存在します');
    }
    await createEmptyFile(parent, name, '');
    await refresh();
    setShowAddFile(false);
  };

  const handleContextMenu = (req: ContextMenuRequest) => {
    setCtxAnchor({ x: req.x, y: req.y });
    setCtxTarget(req.target);
  };

  const closeContextMenu = () => {
    setCtxAnchor(null);
    setCtxTarget(null);
  };

  const handleCtxCreateFile = (target: ContextMenuTarget) => {
    // Reuse the existing AddFileModal by pre-pointing it at this folder.
    // The modal's LocationPicker still lets the user change target.
    setShowAddFile(true);
  };

  const handleCtxCreateFolder = (target: ContextMenuTarget) => {
    setShowAddFolder(true);
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    try {
      const parentPath = deleteTarget.path.slice(0, -1);
      const parent = resolveNodeByPath(workspace, parentPath);
      if (deleteTarget.kind === 'file') {
        await deleteFileEntry(parent, deleteTarget.name);
      } else {
        await deleteFolderEntry(parent, deleteTarget.name);
      }
      await refresh();
    } catch (e) {
      console.error('[delete] failed', e);
      alert(
        '削除に失敗しました: ' + (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setDeleteTarget(null);
    }
  };

  const performRename = async (newName: string) => {
    if (!renameTarget) return;
    const parentPath = renameTarget.path.slice(0, -1);
    const parent = resolveNodeByPath(workspace, parentPath);
    if (renameTarget.kind === 'file') {
      await renameFileEntry(parent, renameTarget.name, newName);
    } else {
      await renameFolderEntry(parent, renameTarget.name, newName);
    }
    await refresh();
    setRenameTarget(null);
  };

  const handleMoveNode = async (sourcePath: string[], destFolderPath: string[]) => {
    try {
      const sourceParentPath = sourcePath.slice(0, -1);
      const sourceName = sourcePath[sourcePath.length - 1];
      const sourceParent = resolveNodeByPath(workspace, sourceParentPath);
      const destParent = resolveNodeByPath(workspace, destFolderPath);

      const kind = findNodeKind(workspace.tree, sourcePath);
      if (kind === 'file') {
        await moveFileEntry(sourceParent, sourceName, destParent);
      } else if (kind === 'folder') {
        await moveFolderEntry(sourceParent, sourceName, destParent);
      }
      await refresh();
    } catch (e) {
      console.error('[move] failed', e);
      alert(
        '移動に失敗しました: ' + (e instanceof Error ? e.message : String(e)),
      );
    }
  };

  const handleReorderChildren = (_folderPath: string[], orderedNames: string[]) => {
    saveFolderOrder(_folderPath.join('/'), orderedNames);
    // Force re-render by refreshing workspace tree.
    void refresh();
  };

  // A tab is "active" whenever `activeTab` is non-null — the spreadsheet
  // view is shown when there's no active tab at all.
  const fileTabActive = tabs.activeTab != null;

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <UpdateBanner />
      <div className="flex flex-1 overflow-hidden">
      <FileTree
        workspace={workspace}
        activeFileKey={tabs.activeKey}
        rootName={handle.name}
        spreadsheetActive={!fileTabActive}
        onOpenFile={tabs.openFile}
        onOpenSpreadsheet={() => tabs.activate(null)}
        onAddCompany={() => setShowAdd(true)}
        onAddFolder={() => setShowAddFolder(true)}
        onAddFile={() => setShowAddFile(true)}
        onRefresh={refresh}
        onChangeFolder={async () => {
          await reset();
        }}
        onContextMenu={handleContextMenu}
        onMoveNode={handleMoveNode}
        onReorderChildren={handleReorderChildren}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TabBar
          tabs={tabs.tabs}
          activeKey={tabs.activeKey}
          onActivate={tabs.activate}
          onClose={tabs.close}
        />

        <div className="flex-1 overflow-hidden">
          {tabs.activeTab ? (
            <TabViewer
              tab={tabs.activeTab}
              rootName={handle.name}
              onNavigate={(index) => {
                // Home click (index === -1) returns to the spreadsheet.
                // Parent-segment clicks are a no-op because the sidebar
                // tree is the single source of navigation here.
                if (index === -1) tabs.activate(null);
              }}
            />
          ) : (
            <SpreadsheetRoot active={!fileTabActive} />
          )}
        </div>
      </div>

      {showAdd && (
        <AddCompanyModal
          workspace={workspace}
          companySuggestions={companySuggestions}
          onClose={() => setShowAdd(false)}
          onSubmit={handleAddCompany}
        />
      )}
      {showAddFolder && (
        <AddFolderModal
          workspace={workspace}
          onClose={() => setShowAddFolder(false)}
          onSubmit={handleAddFolder}
        />
      )}
      {showAddFile && (
        <AddFileModal
          workspace={workspace}
          onClose={() => setShowAddFile(false)}
          onSubmit={handleAddFile}
        />
      )}

      <FileContextMenu
        anchor={ctxAnchor}
        target={ctxTarget}
        onClose={closeContextMenu}
        onCreateFile={handleCtxCreateFile}
        onCreateFolder={handleCtxCreateFolder}
        onRename={(t) => setRenameTarget(t)}
        onDelete={(t) => setDeleteTarget(t)}
      />
      <ConfirmDialog
        open={deleteTarget != null}
        title={deleteTarget?.kind === 'folder' ? 'フォルダを削除' : 'ファイルを削除'}
        message={
          deleteTarget
            ? `「${deleteTarget.name}」を${
                deleteTarget.kind === 'folder' ? 'フォルダごと' : ''
              }完全に削除します。\nこの操作は取り消せません。`
            : ''
        }
        confirmLabel="削除"
        destructive
        onConfirm={() => void performDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
      <RenameDialog
        open={renameTarget != null}
        initialName={renameTarget?.name ?? ''}
        title={renameTarget?.kind === 'folder' ? 'フォルダの名前を変更' : 'ファイルの名前を変更'}
        onCancel={() => setRenameTarget(null)}
        onSubmit={performRename}
      />
      </div>
    </div>
  );
}
