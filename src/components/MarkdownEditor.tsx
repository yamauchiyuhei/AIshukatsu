import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Editor,
  editorViewCtx,
  rootCtx,
  defaultValueCtx,
  remarkPluginsCtx,
} from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { nord } from '@milkdown/theme-nord';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { history } from '@milkdown/plugin-history';
import { block, BlockProvider } from '@milkdown/plugin-block';
import { undo, redo, undoDepth, redoDepth } from '@milkdown/prose/history';
import type { EditorView } from '@milkdown/prose/view';
import { BubbleMenu } from './BubbleMenu';
import { BlockInsertMenu } from './BlockInsertMenu';
import { insertBlockAfter, type BlockKind } from '../lib/editor/blockInsert';
import { remarkMergeInlineHtml } from '../lib/remarkMergeInlineHtml';
import { htmlInnerNodeView } from '../lib/htmlNodeView';
import { linkClickHandler } from '../lib/linkClickHandler';

export interface MarkdownEditorHandle {
  undo: () => void;
  redo: () => void;
}

interface Props {
  /** Re-mounts the editor when this key changes (e.g. file path). */
  resetKey: string;
  initialValue: string;
  onChange: (markdown: string) => void;
  /** Called whenever the undo/redo availability changes. */
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(
  function MarkdownEditor({ resetKey, ...rest }, ref) {
    return <MarkdownEditorInner key={resetKey} ref={ref} {...rest} />;
  },
);

interface MenuAnchor {
  left: number;
  top: number;
  bottom: number;
}

interface InnerProps {
  initialValue: string;
  onChange: (markdown: string) => void;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
}

const MarkdownEditorInner = forwardRef<MarkdownEditorHandle, InnerProps>(
  function MarkdownEditorInner({ initialValue, onChange, onHistoryChange }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const onChangeRef = useRef(onChange);
    const onHistoryChangeRef = useRef(onHistoryChange);
    const viewRef = useRef<EditorView | null>(null);
    const lastHistoryStateRef = useRef<{ canUndo: boolean; canRedo: boolean }>({
      canUndo: false,
      canRedo: false,
    });
    const [view, setView] = useState<EditorView | null>(null);
    const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);

    // BlockInsertMenu ("+" button) state. The hovered block's pos/size is
    // snapshotted into `insertTarget` at click-time so that subsequent mouse
    // movement inside the menu doesn't shift the insertion target.
    const blockHandleRef = useRef<HTMLDivElement | null>(null);
    const blockProviderRef = useRef<BlockProvider | null>(null);
    const [insertMenuAnchor, setInsertMenuAnchor] = useState<MenuAnchor | null>(
      null,
    );
    const [insertMenuOpen, setInsertMenuOpen] = useState(false);
    const [insertTarget, setInsertTarget] = useState<
      { pos: number; size: number } | null
    >(null);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      onHistoryChangeRef.current = onHistoryChange;
    }, [onHistoryChange]);

    const reportHistory = (v: EditorView) => {
      const next = {
        canUndo: undoDepth(v.state) > 0,
        canRedo: redoDepth(v.state) > 0,
      };
      const prev = lastHistoryStateRef.current;
      if (prev.canUndo !== next.canUndo || prev.canRedo !== next.canRedo) {
        lastHistoryStateRef.current = next;
        onHistoryChangeRef.current?.(next);
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        undo: () => {
          const v = viewRef.current;
          if (!v) return;
          undo(v.state, v.dispatch);
          v.focus();
        },
        redo: () => {
          const v = viewRef.current;
          if (!v) return;
          redo(v.state, v.dispatch);
          v.focus();
        },
      }),
      [],
    );

    useEffect(() => {
      if (!containerRef.current) return;
      const root = containerRef.current;
      let destroyed = false;
      let editorInstance: Editor | null = null;

      Editor.make()
        .config(nord)
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, initialValue);
          // Register our remark pre-processor so inline <span>...</span> sequences
          // collapse back into single html atoms when a file is loaded.
          ctx.update(remarkPluginsCtx, (plugins) => [
            ...plugins,
            // Custom plugin signature differs slightly from unified's strict type
            // but the runtime shape is identical. Cast is safe.
            remarkMergeInlineHtml as unknown as (typeof plugins)[number],
          ]);
          const lm = ctx.get(listenerCtx);
          lm.markdownUpdated((innerCtx, markdown) => {
            onChangeRef.current(markdown);
            try {
              const v = innerCtx.get(editorViewCtx);
              reportHistory(v);
            } catch {
              /* view not yet available */
            }
          });
          lm.selectionUpdated((innerCtx, selection) => {
            const v = innerCtx.get(editorViewCtx);
            if (selection.empty) {
              setMenuVisible(false);
              // Re-allow the block handle once the BubbleMenu is gone.
              blockHandleRef.current?.removeAttribute('data-selection-active');
              return;
            }
            // While a text selection exists, hide the "+" block handle so it
            // doesn't visually compete with the BubbleMenu.
            blockHandleRef.current?.setAttribute('data-selection-active', 'true');
            try {
              const start = v.coordsAtPos(selection.from);
              const end = v.coordsAtPos(selection.to);
              const left = Math.min(start.left, end.left);
              const top = Math.min(start.top, end.top);
              const bottom = Math.max(start.bottom, end.bottom);
              setMenuAnchor({ left, top, bottom });
              setMenuVisible(true);
            } catch (e) {
              // coordsAtPos can throw during rapid updates
              console.warn(e);
            }
          });
          lm.blur(() => {
            // Hide menu when editor loses focus (but allow clicks on menu via mousedown preventDefault)
            // Delay to permit toolbar interaction
            setTimeout(() => setMenuVisible(false), 150);
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(history)
        .use(listener)
        .use(block)
        .use(htmlInnerNodeView)
        .use(linkClickHandler)
        .create()
        .then((editor) => {
          if (destroyed) {
            editor.destroy();
          } else {
            editorInstance = editor;
            editor.action((ctx) => {
              const v = ctx.get(editorViewCtx);
              viewRef.current = v;
              setView(v);
              // Initialise history state for this fresh editor
              lastHistoryStateRef.current = { canUndo: false, canRedo: false };
              onHistoryChangeRef.current?.({ canUndo: false, canRedo: false });

              // Build the "+" block handle. The plugin-block service tracks
              // the hovered top-level block via pointermove and positions the
              // `content` element (floating-ui) to its left. We own the DOM,
              // so we can wire a click handler that opens the React menu.
              const content = document.createElement('div');
              content.className = 'block-handle';
              content.setAttribute('data-show', 'false');
              const button = document.createElement('button');
              button.type = 'button';
              button.className = 'block-handle__btn';
              button.setAttribute('aria-label', 'ブロックを挿入');
              // Inline SVG plus icon — avoids pulling React into this raw DOM.
              button.innerHTML =
                '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
              // Prevent the mousedown from stealing focus/selection from
              // ProseMirror before our click handler fires.
              button.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
              });
              button.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const active = blockProviderRef.current?.active;
                if (!active) return;
                setInsertTarget({
                  pos: active.$pos.pos,
                  size: active.node.nodeSize,
                });
                const rect = button.getBoundingClientRect();
                setInsertMenuAnchor({
                  left: rect.left,
                  top: rect.top,
                  bottom: rect.bottom,
                });
                setInsertMenuOpen(true);
              });
              content.appendChild(button);
              blockHandleRef.current = content;

              const provider = new BlockProvider({
                ctx,
                content,
                // Floating-UI offset: push the handle 10px further away from
                // the block's left edge so it doesn't overlap with the
                // contenteditable focus frame or the text itself.
                getOffset: () => ({ mainAxis: 10 }),
              });
              blockProviderRef.current = provider;
              provider.update();
            });
          }
        })
        .catch((err) => {
          console.error('Milkdown init error:', err);
        });

      return () => {
        destroyed = true;
        viewRef.current = null;
        setView(null);
        setMenuVisible(false);
        setInsertMenuOpen(false);
        if (blockProviderRef.current) {
          try {
            blockProviderRef.current.destroy();
          } catch {
            /* provider teardown is best-effort */
          }
          blockProviderRef.current = null;
        }
        blockHandleRef.current = null;
        if (editorInstance) {
          editorInstance.destroy();
          editorInstance = null;
        }
        while (root.firstChild) root.removeChild(root.firstChild);
      };
      // initialValue intentionally excluded — parent re-mounts via key change
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleInsertBlock = (kind: BlockKind) => {
      const v = viewRef.current;
      const target = insertTarget;
      if (!v || !target) {
        setInsertMenuOpen(false);
        return;
      }
      insertBlockAfter(v, kind, target.pos, target.size);
      setInsertMenuOpen(false);
      setInsertTarget(null);
    };

    return (
      <>
        <div ref={containerRef} className="prose max-w-none" />
        <BubbleMenu view={view} anchor={menuAnchor} visible={menuVisible} />
        <BlockInsertMenu
          anchor={insertMenuAnchor}
          open={insertMenuOpen}
          onClose={() => setInsertMenuOpen(false)}
          onSelect={handleInsertBlock}
        />
      </>
    );
  },
);
