import { SaveStatus } from './components/SaveStatus';
import { WorkspaceSettings } from './components/WorkspaceSettings';
import { AppShell, type AppSection } from './components/AppShell';
import { ArticleMemoImport } from './components/ArticleMemoImport';
import { WorkspaceStart } from './components/WorkspaceStart';
import { DocumentLibrary } from './components/DocumentLibrary';
import type { FileTab } from './hooks/useOpenTabs';
import type { CareerTab } from './career/CareerWorkspace';
import { collectFolders } from './lib/workspace';
import { importLibraryFiles } from './lib/libraryImport';
import { WorkspaceHome } from './components/WorkspaceHome';
import { setGoogleConnectionOwner } from './career/googleAuth';
import { WorkspaceErrorBoundary } from './components/WorkspaceErrorBoundary';
import { flushAllSaves } from './lib/saveQueue';
import { isLocalMode, usePreferences, updatePreferences, setPreferenceOwner } from './lib/preferences';
import { moveToWorkspaceTrash } from './lib/workspaceTrash';
import { ToastHost, ConfirmHost, toast } from './spreadsheet/components/Toast';
import { useEffect, useMemo, useState } from 'react';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { LoginScreen } from './components/onboarding/LoginScreen';
import { isTauri } from './lib/tauriFsaShim';
import { UpdateBanner } from './components/UpdateBanner';
import { type ContextMenuRequest } from './components/FileTree';
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

export default function App(){return <div className="flex h-dvh flex-col overflow-hidden"><div className="min-h-0 flex-1 overflow-auto"><WorkspaceApp/></div><UpdateBanner/></div>;}

function WorkspaceApp() {
  // Reactive auth state from the spreadsheet store. Drives the top-level
  // auth gate below so that signing out (which flips store.user to null)
  // immediately routes the user back to the LoginScreen.
  const preferences = usePreferences();
  const [showSettings, setShowSettings] = useState(false);
  const [section, setSection] = useState<AppSection>('documents');
  const [careerTab, setCareerTab] = useState<CareerTab>('today');
  const [showSetup, setShowSetup] = useState(false);
  const [, refreshOnboarding] = useState(0);
  const [creationLocation, setCreationLocation] = useState<TargetLocation>({ path: [] });
  const authUser = useSheet((s) => s.user);
  // `authChecked` becomes true once Firebase's onAuthStateChanged has fired
  // at least once. Without this we'd flash the LoginScreen for a moment on
  // every reload while Firebase is still determining the current user.
  // In Firebase-less environments (local dev) we start as `true` so the
  // gate is skipped entirely.
  const [authChecked, setAuthChecked] = useState(!firebaseEnabled);

  const workspaceOwner = authUser?.uid ?? (isLocalMode() || !firebaseEnabled ? 'local-guest' : null);
  useEffect(() => { setGoogleConnectionOwner(workspaceOwner ?? 'signed-out'); }, [workspaceOwner]);
  const { handle, status, pick, adopt, requestPermission, reset, error: rootError } = useRootDirectory(workspaceOwner);
  useEffect(() => { setPreferenceOwner(workspaceOwner ?? 'local-guest'); }, [workspaceOwner]);
  const root = status === 'ready' ? handle : null;
  const { workspace, loading, error, refresh } = useWorkspace(root);

  // Tell the spreadsheet store about the workspace root as early as possible —
  // before the auth-driven cloud pull runs — so the エントリー一覧 is persisted
  // to データ/エントリー一覧.csv (the source of truth) rather than the cloud.
  useEffect(() => {
    useSheet.getState().setRootHandle(root);
  }, [root]);

  const tabs = useOpenTabs(workspace, workspaceOwner ?? 'signed-out');
  useEffect(()=>{const failed=()=>toast.error('ダウンロードできませんでした。保存先と空き容量を確認してください。');window.addEventListener('aishukatsu-download-error',failed);return()=>window.removeEventListener('aishukatsu-download-error',failed);},[]);
  useEffect(() => { const open = () => setShowSettings(true); window.addEventListener('aishukatsu-open-settings', open); return () => window.removeEventListener('aishukatsu-open-settings', open); }, []);
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
  if (firebaseEnabled && !authUser && !isLocalMode()) {
    return <LoginScreen variant="gate" user={null} onNext={() => {}} showWebsiteLinks={!isTauri()} />;
  }
  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        読み込み中…
      </div>
    );
  }
  if (showSetup && workspaceOwner) {
    // First-time visitor → show the guided onboarding flow. Once finished,
    // we adopt the created "AI就活" subfolder as the root and fall through
    // to the normal MainLayout.
    return (
      <OnboardingFlow
        uid={workspaceOwner}
        initialRoot={status === 'ready' ? handle : null}
        onComplete={(created) => {
          void adopt(created); setShowSetup(false); refreshOnboarding(n => n + 1); void refresh();
        }}
      />
    );
  }
  if (status === 'no-handle' || status === 'needs-permission') {
    return <WorkspaceStart needsPermission={status === 'needs-permission'} onReconnect={requestPermission} onSetup={() => setShowSetup(true)} onChooseFolder={async () => {await flushAllSaves();await pick();}}/>;
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
              '以前選択した就活フォルダが見つかりません。移動されている場合は、同じフォルダを選び直してください。'}
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
    await flushAllSaves();
    const parent = resolveNodeByPath(workspace, parentPath);
    await writeCompanyFolder(handle, parent, companyName);
    await refresh();
    setShowAdd(false);

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
    setCreationLocation({ path: target.path });
    setShowAddFile(true);
  };

  const handleCtxCreateFolder = (target: ContextMenuTarget) => {
    setCreationLocation({ path: target.path });
    setShowAddFolder(true);
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    try {
      await flushAllSaves();
      await moveToWorkspaceTrash(handle, deleteTarget.path, deleteTarget.kind);
      toast.success('ゴミ箱へ移動しました。設定から復元できます。');
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
    await flushAllSaves();
    const parentPath = renameTarget.path.slice(0, -1);
    const parent = resolveNodeByPath(workspace, parentPath);
    if (renameTarget.kind === 'file') {
      await renameFileEntry(parent, renameTarget.name, newName);
    } else {
      await renameFolderEntry(parent, renameTarget.name, newName);
    }
    await tabs.remapPrefix(renameTarget.path, [...parentPath, newName], async path => {
      let dir = handle; for (const part of path.slice(0,-1)) dir = await dir.getDirectoryHandle(part);
      return dir.getFileHandle(path.at(-1)!);
    });
    await refresh();
    setRenameTarget(null);
  };

  const handleMoveNode = async (sourcePath: string[], destFolderPath: string[]) => {
    try {
      await flushAllSaves();
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
      await tabs.remapPrefix(sourcePath,[...destFolderPath,sourceName],async path=>{let dir=handle;for(const part of path.slice(0,-1))dir=await dir.getDirectoryHandle(part);return dir.getFileHandle(path.at(-1)!);});
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

  const navigate = (next: AppSection) => {
    void flushAllSaves().then(() => { if(next==='calendar')setCareerTab('planner');else if(next==='tasks')setCareerTab('today');else if(next==='connections')setCareerTab(next);setSection(next); }).catch(() => window.dispatchEvent(new Event('aishukatsu-save-error')));
  };
  const openFile = (file: Omit<FileTab, 'kind'>) => {
    void flushAllSaves().then(async () => { await tabs.openFile(file); setSection('documents'); }).catch(() => window.dispatchEvent(new Event('aishukatsu-save-error')));
  };
  const openEntry = (sheetId: string, rowId: string) => {
    void flushAllSaves().then(() => {
      const state = useSheet.getState(); state.switchSheet(sheetId); state.setSearch(''); state.setFilterIndustry(null); state.setFilterStatus(null); state.setView('sheet'); state.setSelection({rowId, colId:'company'}); setSection('spreadsheet');
    }).catch(() => window.dispatchEvent(new Event('aishukatsu-save-error')));
  };
  const addEntry = () => {
    void flushAllSaves().then(() => {
      const state = useSheet.getState();
      const entry = state.workbook.sheets.find(sheet => sheet.id !== 'career-planner-v1');
      if (entry) state.switchSheet(entry.id);
      state.setSearch(''); state.setFilterIndustry(null); state.setFilterStatus(null); state.setView('sheet');
      const id = state.addRow(); state.setSelection({rowId:id, colId:'company'}); setSection('spreadsheet');
    }).catch(() => window.dispatchEvent(new Event('aishukatsu-save-error')));
  };
  const openCompanyDocument = (company: string, kind: 'research' | 'es') => {
    const normalize = (value: string) => value.replace(/株式会社|有限会社|合同会社|[\s　]/g, '');
    const folders = collectFolders(workspace.tree).filter(folder => normalize(folder.name) === normalize(company));
    if (folders.length !== 1) { setSection('documents'); toast.info('資料から企業フォルダを選んでください。'); return; }
    const files: Extract<WorkspaceNode,{kind:'file'}>[] = [];
    const walk = (nodes: WorkspaceNode[]) => nodes.forEach(node => {if(node.kind === 'folder')walk(node.children);else if(kind === 'research' ? /企業分析|企業研究/.test(node.name) : /ES|面接/.test(node.name))files.push(node);});
    walk(folders[0].children);
    if (files.length === 1) openFile({key:`co:${files[0].path.join('/')}`,label:files[0].name,handle:files[0].handle,breadcrumb:files[0].path.slice(0,-1)});
    else { navigate('documents'); toast.info('資料の企業フォルダから、開く文書を選んでください。'); }
  };
  const careerNavigate = (tab: CareerTab) => navigate(tab === 'planner' ? 'calendar' : tab === 'today' ? 'tasks' : tab === 'companies' ? 'documents' : tab);

  return (
    <AppShell section={section} onNavigate={navigate} workspace={workspace} onOpenFile={openFile} onSettings={() => setShowSettings(true)} status={<>{(error||rootError)&&<div role="alert"><span>{rootError||'フォルダを更新できません。権限や保存先を確認してください。'}</span><button onClick={()=>void refresh()}>再試行</button></div>}<ArticleMemoImport root={handle} onOpen={async(file,name)=>{await refresh();openFile({key:'co:記事メモ/'+name,label:name,breadcrumb:['記事メモ'],handle:file});}}/><SaveStatus onSettings={() => setShowSettings(true)}/></>}>
      <div className="app-feature-view" hidden={section !== 'documents'}>
        <DocumentLibrary workspace={workspace} activeFile={tabs.activeTab} onOpenFile={openFile} onBrowse={() => tabs.activate(null)} onChooseFolder={async () => { await flushAllSaves(); await pick(); }} onRefresh={refresh}
          onAddCompany={() => setShowAdd(true)} onAddFolder={path => {setCreationLocation({path});setShowAddFolder(true);}} onAddFile={path => {setCreationLocation({path});setShowAddFile(true);}}
          onContextMenu={handleContextMenu} onMoveNode={handleMoveNode}
          onImportFiles={async (path, files) => {
            await flushAllSaves();
            try {
              const {added,skipped}=await importLibraryFiles(resolveNodeByPath(workspace,path),files);
              toast.success(`${added}件のファイルを追加しました${skipped ? `。同名の${skipped}件は保持しました` : ''}。`);
            } finally { await refresh(); }
          }}
          documentView={<><TabBar tabs={tabs.tabs} activeKey={tabs.activeKey} onActivate={tabs.activate} onClose={tabs.close}/><div className="document-tab-content" role="tabpanel" aria-label={tabs.activeTab?.label}><WorkspaceErrorBoundary key={tabs.activeKey ?? 'documents'}>{tabs.activeTab && <TabViewer tab={tabs.activeTab} rootName={handle.name} onNavigate={index => {if(index === -1)void tabs.activate(null);}}/>}</WorkspaceErrorBoundary></div></>}
        />
      </div>
      <div className="app-feature-view" hidden={section !== 'spreadsheet'}><WorkspaceErrorBoundary><SpreadsheetRoot active={section === 'spreadsheet'} shellNavigation rootHandle={handle} onRestoreComplete={refresh}/></WorkspaceErrorBoundary></div>
      <div className="app-feature-view" hidden={section === 'documents' || section === 'spreadsheet'}><WorkspaceErrorBoundary><WorkspaceHome embedded activeTab={careerTab} onTabChange={careerNavigate} onSettings={() => setShowSettings(true)} onAdd={addEntry} onOpen={openEntry} onOpenDocument={openCompanyDocument}/></WorkspaceErrorBoundary></div>

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
          initialLocation={creationLocation}
          workspace={workspace}
          onClose={() => setShowAddFolder(false)}
          onSubmit={handleAddFolder}
        />
      )}
      {showAddFile && (
        <AddFileModal
          initialLocation={creationLocation}
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
              }ゴミ箱へ移動します。\n設定から元の場所へ復元できます。クラウドのバックアップは保持されます。`
            : ''
        }
        confirmLabel="ゴミ箱へ移動"
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
      {showSettings && <WorkspaceSettings root={handle} onClose={() => setShowSettings(false)} onRefresh={() => void refresh()} />}
      <ToastHost/><ConfirmHost/>
    </AppShell>
  );
}
