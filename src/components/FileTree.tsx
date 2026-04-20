import { useState } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
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
import { getSortedChildren } from '../lib/sortOrder';

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

const DND_MIME = 'application/x-aishukatsu-path';

/** Detect whether the cursor is in the top or bottom half of an element. */
function dropPosition(e: React.DragEvent): 'before' | 'after' {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
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
  onContextMenu?: (req: ContextMenuRequest) => void;
  /** Fired when a node is drag-dropped onto a different folder. */
  onMoveNode?: (sourcePath: string[], destFolderPath: string[]) => void;
  /** Fired when nodes are reordered within the same folder. */
  onReorderChildren?: (folderPath: string[], orderedNames: string[]) => void;
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
  onMoveNode,
  onReorderChildren,
}: Props) {
  // Apply custom sort order to root-level nodes.
  const sortedTree = getSortedChildren('', workspace.tree);
  // Auto-animate list mutations (add / remove / reorder) on the root tree
  // container. Purely visual — no logic change.
  const [treeListRef] = useAutoAnimate<HTMLDivElement>({ duration: 160 });

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

      <div
        className="flex-1 overflow-auto px-2 pb-4 text-sm"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DND_MIME)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={(e) => {
          // Drops that bubble up to the root area → move to workspace root.
          e.preventDefault();
          const raw = e.dataTransfer.getData(DND_MIME);
          if (!raw || !onMoveNode) return;
          let sourcePath: string[];
          try { sourcePath = JSON.parse(raw); } catch { return; }
          // Already at root level → ignore.
          if (sourcePath.length <= 1) return;
          onMoveNode(sourcePath, []);
        }}
      >
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

        <div ref={treeListRef}>
          {sortedTree.map((node) => (
            <TreeNodeView
              key={node.path.join('/')}
              node={node}
              siblings={sortedTree}
              activeFileKey={activeFileKey}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
              onMoveNode={onMoveNode}
              onReorderChildren={onReorderChildren}
              defaultOpen={false}
            />
          ))}
        </div>

        {/* _テンプレート */}
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

function TreeNodeView({
  node,
  siblings,
  activeFileKey,
  onOpenFile,
  onContextMenu,
  onMoveNode,
  onReorderChildren,
  defaultOpen = false,
}: {
  node: WorkspaceNode;
  siblings: WorkspaceNode[];
  activeFileKey: string | null;
  onOpenFile: (entry: OpenFilePayload) => void;
  onContextMenu?: (req: ContextMenuRequest) => void;
  onMoveNode?: (sourcePath: string[], destFolderPath: string[]) => void;
  onReorderChildren?: (folderPath: string[], orderedNames: string[]) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [dragOver, setDragOver] = useState(false);
  const [dropEdge, setDropEdge] = useState<'before' | 'after' | null>(null);
  // Animate children add / remove / reorder inside this folder.
  const [childrenRef] = useAutoAnimate<HTMLDivElement>({ duration: 150 });

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(DND_MIME, JSON.stringify(node.path));
    e.dataTransfer.effectAllowed = 'move';
  };

  const parentPath = node.path.slice(0, -1);
  const parentKey = parentPath.join('/');

  /** Handle reorder drop (same parent) or delegate to folder-move drop. */
  const handleReorderDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DND_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropEdge(dropPosition(e));
  };

  const handleReorderDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDropEdge(null);
  };

  const handleReorderDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const edge = dropEdge;
    setDropEdge(null);
    const raw = e.dataTransfer.getData(DND_MIME);
    if (!raw) return;
    let sourcePath: string[];
    try { sourcePath = JSON.parse(raw); } catch { return; }

    // Don't drop onto self.
    if (sourcePath.join('/') === node.path.join('/')) return;

    const sourceParent = sourcePath.slice(0, -1).join('/');

    // Same parent → reorder.
    if (sourceParent === parentKey && onReorderChildren) {
      e.stopPropagation();
      const sourceName = sourcePath[sourcePath.length - 1];
      const names = siblings.map((s) => s.name).filter((n) => n !== sourceName);
      const targetIdx = names.indexOf(node.name);
      const insertIdx = edge === 'before' ? targetIdx : targetIdx + 1;
      names.splice(insertIdx, 0, sourceName);
      onReorderChildren(parentPath, names);
      return;
    }

    // Different parent + dropping on a folder → move into it.
    if (node.kind === 'folder' && onMoveNode) {
      e.stopPropagation();
      const sourcePrefix = sourcePath.join('/') + '/';
      if (node.path.join('/').startsWith(sourcePrefix)) return;
      onMoveNode(sourcePath, node.path);
      return;
    }

    // Different parent, target is not a folder → let the event bubble up
    // to the nearest ancestor folder so it can handle the move.
  };

  // ── File row ──────────────────────────────────────────────────
  if (node.kind === 'file') {
    const key = `co:${node.path.join('/')}`;
    const active = activeFileKey === key;
    const Icon = fileIconFor(node.name);
    return (
      <div className="relative">
        {dropEdge === 'before' && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
        )}
        <button
          draggable
          onDragStart={handleDragStart}
          onDragOver={handleReorderDragOver}
          onDragLeave={handleReorderDragLeave}
          onDrop={handleReorderDrop}
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
        {dropEdge === 'after' && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
        )}
      </div>
    );
  }

  // ── Folder row (also a drop target for moving items into) ─────
  const handleFolderDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DND_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Detect: are we near the edge (reorder) or center (move into)?
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const edgeZone = rect.height * 0.25;
    if (y < edgeZone) {
      setDragOver(false);
      setDropEdge('before');
    } else if (y > rect.height - edgeZone) {
      setDragOver(false);
      setDropEdge('after');
    } else {
      setDragOver(true);
      setDropEdge(null);
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
    setDropEdge(null);
  };

  const handleFolderDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const wasDragOver = dragOver;
    const edge = dropEdge;
    setDragOver(false);
    setDropEdge(null);

    const raw = e.dataTransfer.getData(DND_MIME);
    if (!raw) return;
    let sourcePath: string[];
    try { sourcePath = JSON.parse(raw); } catch { return; }

    if (sourcePath.join('/') === node.path.join('/')) return;

    const sourceParent = sourcePath.slice(0, -1).join('/');

    // Edge drop (reorder within same parent).
    if (edge && sourceParent === parentKey && onReorderChildren) {
      e.stopPropagation();
      const sourceName = sourcePath[sourcePath.length - 1];
      const names = siblings.map((s) => s.name).filter((n) => n !== sourceName);
      const targetIdx = names.indexOf(node.name);
      const insertIdx = edge === 'before' ? targetIdx : targetIdx + 1;
      names.splice(insertIdx, 0, sourceName);
      onReorderChildren(parentPath, names);
      return;
    }

    // Drop on folder (center or edge from a different parent) → move into it.
    if (onMoveNode) {
      const sourcePrefix = sourcePath.join('/') + '/';
      if (node.path.join('/').startsWith(sourcePrefix)) return;
      if (sourceParent === node.path.join('/')) return;
      e.stopPropagation();
      onMoveNode(sourcePath, node.path);
      return;
    }

    // Unhandled → let event bubble to ancestor folder.
  };

  // Apply custom sort to children.
  const folderKey = node.path.join('/');
  const sortedChildren = getSortedChildren(folderKey, node.children);

  return (
    <div className="relative">
      {dropEdge === 'before' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full z-10" />
      )}
      <button
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleFolderDragOver}
        onDragLeave={handleFolderDragLeave}
        onDrop={handleFolderDrop}
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
        className={`group flex w-full items-center gap-1 rounded px-1 py-1 text-left transition-colors ${
          dragOver
            ? 'bg-indigo-50 ring-2 ring-indigo-300'
            : 'hover:bg-slate-100'
        }`}
      >
        {open ? (
          <ChevronDown size={12} className="text-slate-400" />
        ) : (
          <ChevronRight size={12} className="text-slate-400" />
        )}
        <Folder size={14} className={dragOver ? 'text-indigo-500' : 'text-slate-500'} />
        <span className={`flex-1 truncate ${dragOver ? 'text-indigo-700' : 'text-slate-800'}`}>
          {node.name}
        </span>
      </button>
      {dropEdge === 'after' && !open && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full z-10" />
      )}
      {open && (
        <div
          ref={childrenRef}
          className="ml-3 border-l border-slate-100 pl-1"
          onDragOver={(e) => {
            // Allow drops to bubble through to ancestor folders.
            if (e.dataTransfer.types.includes(DND_MIME)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }
          }}
          onDrop={(e) => {
            // Unhandled drops on the children area → move into this folder.
            e.preventDefault();
            const raw = e.dataTransfer.getData(DND_MIME);
            if (!raw || !onMoveNode) return;
            let sourcePath: string[];
            try { sourcePath = JSON.parse(raw); } catch { return; }
            if (sourcePath.join('/') === node.path.join('/')) return;
            const sourceParent = sourcePath.slice(0, -1).join('/');
            if (sourceParent === node.path.join('/')) return;
            const sourcePrefix = sourcePath.join('/') + '/';
            if (node.path.join('/').startsWith(sourcePrefix)) return;
            onMoveNode(sourcePath, node.path);
          }}
        >
          {sortedChildren.map((child) => (
            <TreeNodeView
              key={child.path.join('/')}
              node={child}
              siblings={sortedChildren}
              activeFileKey={activeFileKey}
              onOpenFile={onOpenFile}
              onContextMenu={onContextMenu}
              onMoveNode={onMoveNode}
              onReorderChildren={onReorderChildren}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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
