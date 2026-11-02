import { usePreferences } from '../../lib/preferences';
import { AnimatePresence, motion } from 'framer-motion';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  ariaLabel,
}: ModalProps) {
  const preferences=usePreferences();
  const callbacks = useRef({ onClose, onEscape });
  callbacks.current = { onClose, onEscape };
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const opener = useRef<HTMLElement|null>(null);
  if (open && !wasOpen.current) opener.current=document.activeElement as HTMLElement|null;
  wasOpen.current=open;
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const previous = opener.current;
    const background = [...document.body.children].filter(el => !el.contains(panel)) as HTMLElement[];
    const wasInert = background.map(el => el.inert);
    background.forEach(el => { el.inert = true; });
    const focusables = () => [...panel.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(el => !el.hidden && el.getAttribute('aria-hidden') !== 'true');
    (panel.querySelector<HTMLElement>('[autofocus]') ?? focusables()[0] ?? panel).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || panel.closest('[inert]')) return;
      if (e.key === 'Escape' && (e.target as HTMLElement)?.closest('[role=combobox][aria-expanded=true]')) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); (callbacks.current.onEscape ?? callbacks.current.onClose)(); }
      if (e.key === 'Tab') {
        const elements = focusables(); const first = elements[0] ?? panel; const last = elements.at(-1) ?? panel;
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
    };
    const containFocus = (event: FocusEvent) => { if (!panel.closest('[inert]') && !panel.contains(event.target as Node)) (focusables()[0] ?? panel).focus(); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', containFocus);
    return () => {
      background.forEach((el, i) => { el.inert = wasInert[i]; });
      document.removeEventListener('keydown', onKey, true); document.removeEventListener('focusin', containFocus);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className={`workspace-app ${preferences.textSize==='large'?'workspace-large-text':''} fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4`}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          <motion.div
            key="panel"
            ref={panelRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'max-h-[90dvh] overflow-auto w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-2xl',
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>, document.body
  );
}
