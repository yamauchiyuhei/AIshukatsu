import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Dialog body. Click propagation is stopped inside the content frame. */
  children: ReactNode;
  /** Optional className appended to the content frame (sizing/padding). */
  className?: string;
  /** Invoked when the Escape key is pressed. Defaults to onClose. */
  onEscape?: () => void;
  /** Invoked when Enter is pressed with no modal field focused. Optional. */
  onEnter?: () => void;
  /** Accessible label for the dialog surface. */
  ariaLabel?: string;
}

/**
 * Animated modal surface shared by the app's dialogs.
 *
 * - Dims the background, centers a rounded card, and animates in/out with
 *   Framer Motion.
 * - Escape cancels by default; callers can override via `onEscape`.
 * - Enter is only intercepted when `onEnter` is supplied (so inputs behave
 *   normally in child forms unless explicitly wired).
 *
 * Designed as a drop-in replacement for the previous hand-rolled modal
 * wrappers in ConfirmDialog / RenameDialog while preserving behaviour.
 */
export function Modal({
  open,
  onClose,
  children,
  className,
  onEscape,
  onEnter,
  ariaLabel,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        (onEscape ?? onClose)();
      } else if (e.key === 'Enter' && onEnter) {
        // Only intercept Enter when the caller opted in (e.g. confirm dialog).
        e.preventDefault();
        onEnter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onEscape, onClose, onEnter]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-2xl',
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
