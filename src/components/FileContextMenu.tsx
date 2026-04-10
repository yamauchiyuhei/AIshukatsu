import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FilePlus2,
  FolderPlus,
  Pencil,
  Trash2,
} from 'lucide-react';

export interface ContextMenuTarget {
  /** What the right-click hit. */
  kind: 'file' | 'folder';
  /** Display name (for the rename dialog default). */
  name: string;
  /** Workspace-root-relative segments. */
  path: string[];
}

interface Props {
  /** Anchor coordinates in viewport space (mouseX/mouseY of the contextmenu event). */
  anchor: { x: number; y: number } | null;
  target: ContextMenuTarget | null;
  onClose: () => void;
  onCreateFile: (target: ContextMenuTarget) => void;
  onCreateFolder: (target: ContextMenuTarget) => void;
  onRename: (target: ContextMenuTarget) => void;
  onDelete: (target: ContextMenuTarget) => void;
}

/**
 * Right-click context menu for FileTree entries. Opens at the exact cursor
 * position, flips if it would overflow the viewport, and closes on
 * click-outside / Escape / scroll.
 *
 * "New file" / "New folder" are only offered on folder targets (because
 * they need a parent directory to create inside).
 */
export function FileContextMenu({
  anchor,
  target,
  onClose,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
}: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const open = anchor != null && target != null;

  // Flip the menu if it would fall off the right/bottom of the viewport.
  useLayoutEffect(() => {
    if (!open || !anchor || !menuRef.current) {
      setPos(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = anchor.x;
    let y = anchor.y;
    if (x + rect.width > vw - 8) x = Math.max(8, vw - rect.width - 8);
    if (y + rect.height > vh - 8) y = Math.max(8, vh - rect.height - 8);
    setPos({ x, y });
  }, [open, anchor]);

  // Close on outside click / Esc / scroll.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (e.target instanceof Node && menuRef.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    const onScroll = () => onClose();
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, onClose]);

  if (!open || !target || !anchor) return null;

  const isFolder = target.kind === 'folder';

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="file-context-menu"
      style={{
        position: 'fixed',
        left: pos?.x ?? anchor.x,
        top: pos?.y ?? anchor.y,
        visibility: pos ? 'visible' : 'hidden',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {isFolder && (
        <>
          <button
            type="button"
            role="menuitem"
            className="file-context-menu__item"
            onClick={() => {
              onCreateFile(target);
              onClose();
            }}
          >
            <FilePlus2 size={14} className="file-context-menu__icon" />
            <span>新規ファイル</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="file-context-menu__item"
            onClick={() => {
              onCreateFolder(target);
              onClose();
            }}
          >
            <FolderPlus size={14} className="file-context-menu__icon" />
            <span>新規フォルダ</span>
          </button>
          <div className="file-context-menu__sep" />
        </>
      )}
      <button
        type="button"
        role="menuitem"
        className="file-context-menu__item"
        onClick={() => {
          onRename(target);
          onClose();
        }}
      >
        <Pencil size={14} className="file-context-menu__icon" />
        <span>名前を変更</span>
      </button>
      <button
        type="button"
        role="menuitem"
        className="file-context-menu__item file-context-menu__item--danger"
        onClick={() => {
          onDelete(target);
          onClose();
        }}
      >
        <Trash2 size={14} className="file-context-menu__icon" />
        <span>削除</span>
      </button>
    </div>,
    document.body,
  );
}
