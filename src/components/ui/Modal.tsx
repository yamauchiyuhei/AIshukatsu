import { usePreferences } from '../../lib/preferences';
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
 * Shared dialog with immediate visibility, focus containment, and focus restoration.
 * Do not gate visibility or removal on animation frames: background WKWebViews
 * may suspend them while native update and download work continues.
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
    (panel.querySelector<HTMLElement>('[autofocus],[data-autofocus]') ?? focusables()[0] ?? panel).focus();
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
    open ? (
      <div
        data-theme={preferences.theme}
        className={`workspace-app app-theme ${preferences.textSize === 'large' ? 'workspace-large-text' : ''} fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4`}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className={cn(
            'max-h-[90dvh] overflow-auto w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-2xl',
            className,
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    ) : null,
    document.body,
  );
}
