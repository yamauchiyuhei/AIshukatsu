import { useEffect, useMemo, useState } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { FileTree } from './components/FileTree';
import { TabBar } from './components/TabBar';
import { DashboardView } from './components/DashboardView';
import { MarkdownPage } from './components/MarkdownPage';
import { AddCompanyModal } from './components/AddCompanyModal';
import { useRootDirectory } from './hooks/useRootDirectory';
import { useWorkspace } from './hooks/useWorkspace';
import { useOpenTabs } from './hooks/useOpenTabs';
import { createSubdirectory, subdirectoryExists, writeTextFile } from './lib/fs';
import {
  loadCompanyTemplates,
  materializeTemplate,
} from './lib/templateLoader';

export default function App() {
  const { handle, status, pick, requestPermission, reset } = useRootDirectory();
  const root = status === 'ready' ? handle : null;
  const { workspace, loading, error, refresh } = useWorkspace(root);

  const tabs = useOpenTabs();
  const [showAdd, setShowAdd] = useState(false);

  // After workspace refreshes, drop tabs whose files no longer exist
  const validKeys = useMemo(() => {
    if (!workspace) return new Set<string>();
    const set = new Set<string>();
    for (const cat of workspace.categories) {
      for (const co of cat.companies) {
        for (const f of co.files) {
          set.add(`co:${cat.name}/${co.name}/${f.name}`);
        }
      }
      if (cat.industryResearchFile) {
        set.add(`cat-file:${cat.name}/${cat.industryResearchFile}`);
      }
    }
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
  if (status === 'no-handle' || status === 'needs-permission') {
    return (
      <WelcomeScreen
        needsPermission={status === 'needs-permission'}
        onPick={pick}
        onRequestPermission={requestPermission}
      />
    );
  }
  if (!handle || !workspace) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        {loading ? '読み込み中…' : error ?? '初期化中…'}
      </div>
    );
  }

  const handleAddCompany = async (categoryName: string, companyName: string) => {
    const category = workspace.categories.find((c) => c.name === categoryName);
    if (!category) throw new Error('カテゴリが見つかりません');
    if (await subdirectoryExists(category.handle, companyName)) {
      throw new Error('同じ名前の企業フォルダが既に存在します');
    }
    const dir = await createSubdirectory(category.handle, companyName);
    const templates = await loadCompanyTemplates(handle);
    for (const t of templates) {
      const content = materializeTemplate(t, companyName);
      await writeTextFile(dir, t.name, content);
    }
    await refresh();
    setShowAdd(false);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <FileTree
        workspace={workspace}
        activeFileKey={tabs.activeKey}
        rootName={handle.name}
        onOpenFile={tabs.openFile}
        onAddCompany={() => setShowAdd(true)}
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
          {tabs.activeTab ? (
            <MarkdownPage
              fileHandle={tabs.activeTab.handle}
              fileKey={tabs.activeTab.key}
            />
          ) : (
            <DashboardView
              workspace={workspace}
              onOpenFile={tabs.openFile}
              onAddCompany={() => setShowAdd(true)}
              onRefresh={refresh}
            />
          )}
        </div>
      </div>

      {showAdd && (
        <AddCompanyModal
          categories={workspace.categories}
          onClose={() => setShowAdd(false)}
          onSubmit={handleAddCompany}
        />
      )}
    </div>
  );
}
