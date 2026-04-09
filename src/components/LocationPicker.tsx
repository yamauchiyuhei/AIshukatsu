import { ChevronLeft, ChevronRight, Folder, Home } from 'lucide-react';
import { Workspace, WorkspaceNode } from '../types';
import { resolveFolderByPath } from '../lib/workspace';

/**
 * The user-selected target location for creating a new folder/file. `path` is
 * the ordered list of folder names from the workspace root down to the
 * target directory. An empty array means "root" (i.e. directly inside the
 * selected workspace folder).
 */
export interface TargetLocation {
  path: string[];
}

interface Props {
  workspace: Workspace;
  value: TargetLocation | null;
  onChange: (next: TargetLocation) => void;
}

function folderChildren(
  workspace: Workspace,
  path: string[],
): Extract<WorkspaceNode, { kind: 'folder' }>[] {
  const nodes =
    path.length === 0
      ? workspace.tree
      : resolveFolderByPath(workspace.tree, path)?.children ?? [];
  return nodes.filter(
    (n): n is Extract<WorkspaceNode, { kind: 'folder' }> => n.kind === 'folder',
  );
}

/**
 * Breadcrumb-style path picker. Users drill down into any folder by clicking
 * a child, and can jump back to any ancestor via the breadcrumb. The root
 * itself is always selectable (Q3: root-level file/folder creation is
 * allowed). Special top-level folders (`_テンプレート` / `自己分析`) are
 * excluded — they stay with their dedicated editing screens.
 */
export function LocationPicker({ workspace, value, onChange }: Props) {
  const path = value?.path ?? [];
  const childFolders = folderChildren(workspace, path);

  const handleJumpTo = (depth: number) => {
    onChange({ path: path.slice(0, depth) });
  };

  const handleDrillInto = (name: string) => {
    onChange({ path: [...path, name] });
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600">
        作成先
      </label>

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
        <button
          type="button"
          onClick={() => handleJumpTo(0)}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${
            path.length === 0
              ? 'bg-slate-900 text-white'
              : 'hover:bg-slate-200'
          }`}
          title="ルート"
        >
          <Home size={10} />
          <span>ルート</span>
        </button>
        {path.map((seg, i) => (
          <span key={`${seg}-${i}`} className="flex items-center gap-1">
            <ChevronRight size={10} className="text-slate-400" />
            <button
              type="button"
              onClick={() => handleJumpTo(i + 1)}
              className={`rounded px-1.5 py-0.5 ${
                i === path.length - 1
                  ? 'bg-slate-900 text-white'
                  : 'hover:bg-slate-200'
              }`}
            >
              {seg}
            </button>
          </span>
        ))}
      </div>

      {/* One-level-up shortcut (only when not at root) */}
      {path.length > 0 && (
        <button
          type="button"
          onClick={() => handleJumpTo(path.length - 1)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft size={12} />
          上の階層へ
        </button>
      )}

      {/* Children folder list to descend into */}
      {childFolders.length > 0 ? (
        <div className="max-h-40 overflow-auto rounded-lg border border-slate-200">
          {childFolders.map((f) => (
            <button
              type="button"
              key={f.name}
              onClick={() => handleDrillInto(f.name)}
              className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
            >
              <Folder size={12} className="text-slate-400" />
              <span className="flex-1 truncate">{f.name}</span>
              <ChevronRight size={12} className="text-slate-300" />
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          (このフォルダには下位フォルダがありません)
        </p>
      )}

      <p className="text-xs text-slate-500">
        上のパンくずで選択中のフォルダが作成先になります。
      </p>
    </div>
  );
}
