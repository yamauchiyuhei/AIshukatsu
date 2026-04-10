import { useEffect, useRef, useState, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * Lightweight portal-based popover.
 * Renders children into document.body with `position: fixed`, so it escapes
 * any ancestor with `overflow: auto/hidden/scroll` (which would otherwise clip it).
 * Also handles outside-click and Escape to close.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  align?: 'left' | 'right';
  /** vertical gap between trigger and popover, px */
  offset?: number;
  children: ReactNode;
  className?: string;
}

export function Popover({
  open,
  onClose,
  triggerRef,
  align = 'left',
  offset = 6,
  children,
  className,
}: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number } | null>(null);

  // Position computation
  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const compute = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (align === 'right') {
        setPos({
          top: rect.bottom + offset,
          right: Math.max(8, window.innerWidth - rect.right),
        });
      } else {
        setPos({
          top: rect.bottom + offset,
          left: Math.max(8, rect.left),
        });
      }
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open, align, offset, triggerRef]);

  // Outside-click and Escape handling
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // delay one tick so the very click that opened us isn't caught
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onMouseDown);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, triggerRef]);

  if (!open || !pos) return null;
  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        right: pos.right,
        zIndex: 9000,
      }}
      className={className}
    >
      {children}
    </div>,
    document.body,
  );
}
