import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code2,
  Table as TableIcon,
  Type,
} from 'lucide-react';
import { BLOCK_OPTIONS, type BlockKind } from '../lib/editor/blockInsert';

interface Props {
  /** Viewport-relative anchor point (usually the "+" button's rect). */
  anchor: { left: number; top: number; bottom: number } | null;
  open: boolean;
  onClose: () => void;
  onSelect: (kind: BlockKind) => void;
}

const ICONS: Record<BlockKind, React.ComponentType<{ className?: string }>> = {
  paragraph: Type,
  heading1: Heading1,
  heading2: Heading2,
  heading3: Heading3,
  heading4: Heading4,
  bullet_list: List,
  ordered_list: ListOrdered,
  task_list: CheckSquare,
  blockquote: Quote,
  code_block: Code2,
  table: TableIcon,
};

export function BlockInsertMenu({ anchor, open, onClose, onSelect }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Reset highlight whenever menu opens.
  useEffect(() => {
    if (open) setActiveIdx(0);
  }, [open]);

  // Flip above the anchor if there's not enough space below.
  useLayoutEffect(() => {
    if (!open || !anchor || !menuRef.current) {
      setPos(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const gap = 6;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    // Prefer below the button, flip above if overflowing.
    let top = anchor.bottom + gap;
    if (top + rect.height > viewportH - 8) {
      top = Math.max(8, anchor.top - rect.height - gap);
    }
    let left = anchor.left;
    if (left + rect.width > viewportW - 8) {
      left = Math.max(8, viewportW - rect.width - 8);
    }
    setPos({ left, top });
  }, [open, anchor]);

  // Click outside / Escape to close.
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
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % BLOCK_OPTIONS.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + BLOCK_OPTIONS.length) % BLOCK_OPTIONS.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const opt = BLOCK_OPTIONS[activeIdx];
        if (opt) onSelect(opt.kind);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, activeIdx, onClose, onSelect]);

  if (!open || !anchor) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="ブロックを挿入"
      className="block-insert-menu"
      style={{
        position: 'fixed',
        left: pos?.left ?? anchor.left,
        top: pos?.top ?? anchor.bottom + 6,
        visibility: pos ? 'visible' : 'hidden',
      }}
      onMouseDown={(e) => {
        // Keep focus/selection from being stolen before our onClick fires.
        e.preventDefault();
      }}
    >
      <div className="block-insert-menu__section-label">基本</div>
      {BLOCK_OPTIONS.map((opt, idx) => {
        const Icon = ICONS[opt.kind];
        return (
          <button
            key={opt.kind}
            type="button"
            role="menuitem"
            className={
              'block-insert-menu__item' +
              (idx === activeIdx ? ' is-active' : '')
            }
            onMouseEnter={() => setActiveIdx(idx)}
            onClick={() => onSelect(opt.kind)}
          >
            <Icon className="block-insert-menu__icon" />
            <span className="block-insert-menu__label">{opt.label}</span>
            {opt.hint && (
              <span className="block-insert-menu__hint">{opt.hint}</span>
            )}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
