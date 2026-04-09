import { useEffect, useMemo, useState } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { LoginScreen } from './components/onboarding/LoginScreen';
import { isOnboarded } from './lib/onboardingState';
import { FileTree } from './components/FileTree';
import { TabBar } from './components/TabBar';
import { MarkdownPage } from './components/MarkdownPage';
import { AddCompanyModal } from './components/AddCompanyModal';
import { AddFolderModal } from './components/AddFolderModal';
import { AddFileModal } from './components/AddFileModal';
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
  ensureMdExtension,
  fileExists,
  subdirectoryExists,
} from './lib/fs';
import { writeCompanyFolder } from './lib/companyFolderCreator';
import { resolveFolderByPath } from './lib/workspace';
import { Workspace, WorkspaceNode } from './types';

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

export default function App() {
  const { handle, status, pick, adopt, requestPermission, reset } =
    useRootDirectory();
  const root = status === 'ready' ? handle : null;
  const { workspace, loading, error, refresh } = useWorkspace(root);

  const tabs = useOpenTabs();
  const [showAdd, setShowAdd] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const { names: companySuggestions } = useCompanyMaster();

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

  // After workspace refreshes, drop tabs whose files no longer exist
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

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        読み込み中…
      </div>
    );
  }
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
    return <LoginScreen variant="gate" user={null} onNext={() => {}} />;
  }
  if (status === 'no-handle' && !isOnboarded()) {
    // First-time visitor → show the guided onboarding flow. Once finished,
    // we adopt the created "AI就活" subfolder as the root and fall through
    // to the normal MainLayout.
    return (
      <OnboardingFlow
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
    const parent = resolveNodeByPath(workspace, parentPath);
    // writeCompanyFolder guards against duplicate subdirectories internally,
    // then tries Firestore populated content first, falling back to empty
    // templates (identical to the legacy behaviour).
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

  const fileTabActive = tabs.activeTab?.kind === 'file';

  return (
    <div className="flex h-screen bg-slate-50">
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
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TabBar
          tabs={tabs.tabs}
          activeKey={tabs.activeKey}
          onActivate={tabs.activate}
          onClose={tabs.close}
        />

        <div className="flex-1 overflow-hidden">
          {tabs.activeTab?.kind === 'file' ? (
            <MarkdownPage
              fileHandle={tabs.activeTab.handle}
              fileKey={tabs.activeTab.key}
              label={tabs.activeTab.label}
              breadcrumb={tabs.activeTab.breadcrumb}
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
    </div>
  );
}
