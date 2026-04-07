import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Company, CompanyFile, Status, Workspace } from '../types';

const STATUS_DOT: Record<Status, string> = {
  '未応募': 'bg-slate-300',
  'エントリー済': 'bg-sky-400',
  'ES提出済': 'bg-blue-500',
  'GD': 'bg-cyan-500',
  'Webテスト': 'bg-teal-500',
  '1次面接': 'bg-indigo-500',
  '2次面接': 'bg-violet-500',
  '最終面接': 'bg-amber-500',
  '内定': 'bg-emerald-500',
  'お祈り': 'bg-rose-400',
};

interface Props {
  workspace: Workspace;
  activeFileKey: string | null;
  rootName: string;
  onOpenFile: (entry: {
    key: string;
    label: string;
    breadcrumb: string[];
    handle: FileSystemFileHandle;
  }) => void;
  onAddCompany: () => void;
  onRefresh: () => void;
  onChangeFolder: () => void;
}

export function FileTree({
  workspace,
  activeFileKey,
  rootName,
  onOpenFile,
  onAddCompany,
  onRefresh,
  onChangeFolder,
}: Props) {
  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-base font-bold text-slate-900">AI就活くん</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            title="更新"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={onAddCompany}
            title="企業を追加"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2 pb-4 text-sm">
        {/* Categories */}
        {workspace.categories.map((cat) => (
          <CategoryNode
            key={`cat:${cat.name}`}
            categoryName={cat.name}
            companies={cat.companies}
            industryFile={
              cat.industryResearchFile
                ? {
                    name: cat.industryResearchFile,
                    parentHandle: cat.handle,
                  }
                : null
            }
            activeFileKey={activeFileKey}
            onOpenFile={onOpenFile}
          />
        ))}

        {/* 自己分析 */}
        {workspace.selfAnalysis.files.length > 0 && (
          <FolderNode
            label="自己分析"
            keyPrefix="self"
            childCount={workspace.selfAnalysis.files.length}
          >
            <FileList
              files={workspace.selfAnalysis.files.map((f) => ({
                name: f.name,
                handle: f.handle,
              }))}
              breadcrumb={['自己分析']}
              keyPrefix="self"
              activeFileKey={activeFileKey}
              onOpenFile={onOpenFile}
            />
          </FolderNode>
        )}

        {/* _テンプレート */}
        {workspace.templates.files.length > 0 && (
          <FolderNode
            label="_テンプレート"
            keyPrefix="tpl"
            childCount={workspace.templates.files.length}
          >
            <FileList
              files={workspace.templates.files.map((f) => ({
                name: f.name,
                handle: f.handle,
              }))}
              breadcrumb={['_テンプレート']}
              keyPrefix="tpl"
              activeFileKey={activeFileKey}
              onOpenFile={onOpenFile}
            />
          </FolderNode>
        )}
      </div>

      <div className="border-t border-slate-100 px-3 py-2">
        <button
          onClick={onChangeFolder}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          title="フォルダを変更"
        >
          <FolderOpen size={12} />
          <span className="truncate">{rootName}</span>
        </button>
      </div>
    </aside>
  );
}

function FolderNode({
  label,
  keyPrefix,
  childCount,
  children,
  defaultOpen = false,
  rightContent,
}: {
  label: string;
  keyPrefix: string;
  childCount?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  rightContent?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div data-key={keyPrefix}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-1 rounded px-1 py-1 text-left hover:bg-slate-100"
      >
        {open ? (
          <ChevronDown size={12} className="text-slate-400" />
        ) : (
          <ChevronRight size={12} className="text-slate-400" />
        )}
        <Folder size={14} className="text-slate-500" />
        <span className="flex-1 truncate text-slate-800">{label}</span>
        {childCount !== undefined && (
          <span className="text-xs text-slate-400">{childCount}</span>
        )}
        {rightContent}
      </button>
      {open && <div className="ml-3 border-l border-slate-100 pl-1">{children}</div>}
    </div>
  );
}

function CategoryNode({
  categoryName,
  companies,
  industryFile,
  activeFileKey,
  onOpenFile,
}: {
  categoryName: string;
  companies: Company[];
  industryFile: { name: string; parentHandle: FileSystemDirectoryHandle } | null;
  activeFileKey: string | null;
  onOpenFile: Props['onOpenFile'];
}) {
  return (
    <FolderNode
      label={categoryName}
      keyPrefix={`cat:${categoryName}`}
      childCount={companies.length}
    >
      {companies.map((c) => (
        <CompanyNode
          key={`co:${categoryName}/${c.name}`}
          company={c}
          activeFileKey={activeFileKey}
          onOpenFile={onOpenFile}
        />
      ))}
      {industryFile && (
        <IndustryFileLeaf
          categoryName={categoryName}
          fileName={industryFile.name}
          parentHandle={industryFile.parentHandle}
          activeFileKey={activeFileKey}
          onOpenFile={onOpenFile}
        />
      )}
    </FolderNode>
  );
}

function CompanyNode({
  company,
  activeFileKey,
  onOpenFile,
}: {
  company: Company;
  activeFileKey: string | null;
  onOpenFile: Props['onOpenFile'];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-1 rounded px-1 py-1 text-left hover:bg-slate-100"
      >
        {open ? (
          <ChevronDown size={12} className="text-slate-400" />
        ) : (
          <ChevronRight size={12} className="text-slate-400" />
        )}
        <Folder size={14} className="text-slate-500" />
        <span className="flex-1 truncate text-slate-800">{company.name}</span>
        {company.status && (
          <span
            title={company.status}
            className={`h-2 w-2 rounded-full ${STATUS_DOT[company.status]}`}
          />
        )}
      </button>
      {open && (
        <div className="ml-3 border-l border-slate-100 pl-1">
          <FileList
            files={company.files}
            breadcrumb={[company.category, company.name]}
            keyPrefix={`co:${company.category}/${company.name}`}
            activeFileKey={activeFileKey}
            onOpenFile={onOpenFile}
          />
        </div>
      )}
    </div>
  );
}

function FileList({
  files,
  breadcrumb,
  keyPrefix,
  activeFileKey,
  onOpenFile,
}: {
  files: CompanyFile[];
  breadcrumb: string[];
  keyPrefix: string;
  activeFileKey: string | null;
  onOpenFile: Props['onOpenFile'];
}) {
  return (
    <>
      {files.map((f) => {
        const key = `${keyPrefix}/${f.name}`;
        const active = activeFileKey === key;
        return (
          <button
            key={key}
            onClick={() =>
              onOpenFile({
                key,
                label: f.name,
                breadcrumb,
                handle: f.handle,
              })
            }
            className={`flex w-full items-center gap-1 rounded px-1 py-1 text-left ${
              active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="w-3" />
            <FileText size={13} className={active ? 'text-white' : 'text-slate-400'} />
            <span className="flex-1 truncate">{f.name}</span>
          </button>
        );
      })}
    </>
  );
}

function IndustryFileLeaf({
  categoryName,
  fileName,
  parentHandle,
  activeFileKey,
  onOpenFile,
}: {
  categoryName: string;
  fileName: string;
  parentHandle: FileSystemDirectoryHandle;
  activeFileKey: string | null;
  onOpenFile: Props['onOpenFile'];
}) {
  const key = `cat-file:${categoryName}/${fileName}`;
  const active = activeFileKey === key;
  return (
    <button
      onClick={async () => {
        try {
          const handle = await parentHandle.getFileHandle(fileName);
          onOpenFile({
            key,
            label: fileName,
            breadcrumb: [categoryName],
            handle,
          });
        } catch (e) {
          console.error('failed to open industry research file:', e);
        }
      }}
      className={`flex w-full items-center gap-1 rounded px-1 py-1 text-left ${
        active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      <span className="w-3" />
      <FileText size={13} className={active ? 'text-white' : 'text-slate-400'} />
      <span className="flex-1 truncate">{fileName}</span>
    </button>
  );
}
