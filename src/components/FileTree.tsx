import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { SelfAnalysisFile, TemplateFileEntry, Workspace, WorkspaceNode } from '../types';
import { fileIconFor } from './fileIcons';
import { AddMenu } from './AddMenu';

interface OpenFilePayload {
  key: string;
  label: string;
  breadcrumb: string[];
  handle: FileSystemFileHandle;
}

export interface ContextMenuRequest {
  x: number;
  y: number;
  target: {
    kind: 'file' | 'folder';
    name: string;
    path: string[];
  };
}

interface Props {
  workspace: Workspace;
  activeFileKey: string | null;
  rootName: string;
  spreadsheetActive?: boolean;
  onOpenFile: (entry: OpenFilePayload) => void;
  onOpenSpreadsheet?: () => void;
  onAddCompany: () => void;
  onAddFolder: () => void;
  onAddFile: () => void;
  onRefresh: () => void;
  onChangeFolder: () => void;
  /** Fired when any tree row is right-clicked. Parent owns the menu state. */
  onContextMenu?: (req: ContextMenuRequest) => void;
}

export function FileTree({
  workspace,
  activeFileKey,
  rootName,
  spreadsheetActive = false,
  onOpenFile,
  onOpenSpreadsheet,
  onAddCompany,
  onAddFolder,
  onAddFile,
  onRefresh,
  onChangeFolder,
  onContextMenu,
}: Props) {
  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="h-10 w-10">
          <img
            src="/logo.png"
            alt="AI就活くん"
            className="h-full w-full rounded-lg object-contain"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            title="更新"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <RefreshCw size={14} />
          </button>
          <AddMenu
            onAddCompany={onAddCompany}
            onAddFolder={onAddFolder}
            onAddFile={onAddFile}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2 pb-4 text-sm">
        {/* 就活スプレッドシート */}
        <button
          type="button"
          onClick={onOpenSpreadsheet}
          className={`group flex w-full items-center gap-1 rounded px-1 py-1 text-left ${
            spreadsheetActive
              ? 'bg-slate-900 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
          title="就活スプレッドシート"
        >
          <span className="w-3" />
          <Folder
            size={14}
            className={spreadsheetActive ? 'text-white' : 'text-slate-500'}
          />
          <span className="flex-1 truncate">就活スプレッドシート</span>
        </button>

        {/* Arbitrary-depth workspace tree (everything except the special
            top-level folders). Empty top folders still render so users can
            see them and know where to add files. */}
        {workspace.tree.map((node) => (
          <TreeNodeView
            key={node.path.join('/')}
            node={node}
            activeFileKey={activeFileKey}
            onOpenFile={onOpenFile}
            onContextMenu={onContextMenu}
            defaultOpen={false}
          />
        ))}

        {/* 自己分析 (special, edited from the dedicated screen) */}
        {workspace.selfAnalysis.files.length > 0 && (
          <SpecialFolderNode
            label="自己分析"
            keyPrefix="self"
            files={workspace.selfAnalysis.files}
            activeFileKey={activeFileKey}
            onOpenFile={onOpenFile}
          />
        )}

        {/* _テンプレート (special, edited from the dedicated screen) */}
        {workspace.templates.files.length > 0 && (
          <SpecialFolderNode
            label="_テンプレート"
            keyPrefix="tpl"
            files={workspace.templates.files}
            activeFileKey={activeFileKey}
            onOpenFile={onOpenFile}
          />
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

/**
 * Single recursive renderer for any workspace node. Folders track their own
 * collapse state; files render as leaves. File keys are derived from the
 * full path from the workspace root (`co:<path>/<file>`) so cloud sync and
 * tab de-duplication are stable as nodes move around the tree.
 */
function TreeNodeView({
  node,
  activeFileKey,
  onOpenFile,
  onContextMenu,
  defaultOpen = false,
}: {
  node: WorkspaceNode;
  activeFileKey: string | null;
  onOpenFile: (entry: OpenFilePayload) => void;
  onContextMenu?: (req: ContextMenuRequest) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (node.kind === 'file') {
    const key = `co:${node.path.join('/')}`;
    const active = activeFileKey === key;
    const Icon = fileIconFor(node.name);
    return (
      <button
        onClick={() =>
          onOpenFile({
            key,
            label: node.name,
            breadcrumb: node.path.slice(0, -1),
            handle: node.handle,
          })
        }
        onContextMenu={(e) => {
          if (!onContextMenu) return;
          e.preventDefault();
          onContextMenu({
            x: e.clientX,
            y: e.clientY,
            target: { kind: 'file', name: node.name, path: node.path },
          });
        }}
        className={`flex w-full items-center gap-1 rounded px-1 py-1 text-left ${
          active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <span className="w-3" />
        <Icon size={13} className={active ? 'text-white' : 'text-slate-400'} />
        <span className="flex-1 truncate">{node.name}</span>
      </button>
    );
  }

  // Folder row: click ONLY toggles expand/collapse. We do not open a
  // folder-view tab in the main area — the user navigates exclusively via
  // the tree here, per product request.
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        onContextMenu={(e) => {
          if (!onContextMenu) return;
          e.preventDefault();
          onContextMenu({
            x: e.clientX,
            y: e.clientY,
            target: { kind: 'folder', name: node.name, path: node.path },
          });
        }}
        className="group flex w-full items-center gap-1 rounded px-1 py-1 text-left hover:bg-slate-100"
      >
        {open ? (
          <ChevronDown size={12} className="text-slate-400" />
        ) : (
          <ChevronRight size={12} className="text-slate-400" />
        )}
        <Folder size={14} className="text-slate-500" />
        <span className="flex-1 truncate text-slate-800">{node.name}</span>
      </button>
      {open && (
        <div className="ml-3 border-l border-slate-100 pl-1">
          {node.children.map((child) => (
            <TreeNodeView
              key={child.path.join('/')}
              node={child}
              activeFileKey={activeFileKey}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Flat file list for the protected `_テンプレート` / `自己分析` sections.
 * Key format is preserved (`self/<name>`, `tpl/<name>`) so cloud sync and
 * tab state stay compatible with the legacy layout.
 */
function SpecialFolderNode({
  label,
  keyPrefix,
  files,
  activeFileKey,
  onOpenFile,
}: {
  label: string;
  keyPrefix: 'self' | 'tpl';
  files: (SelfAnalysisFile | TemplateFileEntry)[];
  activeFileKey: string | null;
  onOpenFile: (entry: OpenFilePayload) => void;
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
        <span className="flex-1 truncate text-slate-800">{label}</span>
        <span className="text-xs text-slate-400">{files.length}</span>
      </button>
      {open && (
        <div className="ml-3 border-l border-slate-100 pl-1">
          {files.map((f) => {
            const key = `${keyPrefix}/${f.name}`;
            const active = activeFileKey === key;
            const Icon = fileIconFor(f.name);
            return (
              <button
                key={key}
                onClick={() =>
                  onOpenFile({
                    key,
                    label: f.name,
                    breadcrumb: [label],
                    handle: f.handle,
                  })
                }
                className={`flex w-full items-center gap-1 rounded px-1 py-1 text-left ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="w-3" />
                <Icon
                  size={13}
                  className={active ? 'text-white' : 'text-slate-400'}
                />
                <span className="flex-1 truncate">{f.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
