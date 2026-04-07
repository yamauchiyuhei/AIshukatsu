import { useEffect, useRef, useState } from 'react';
import { Editor, editorViewCtx, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { nord } from '@milkdown/theme-nord';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import type { EditorView } from '@milkdown/prose/view';
import { BubbleMenu } from './BubbleMenu';

interface Props {
  /** Re-mounts the editor when this key changes (e.g. file path). */
  resetKey: string;
  initialValue: string;
  onChange: (markdown: string) => void;
}

export function MarkdownEditor({ resetKey, initialValue, onChange }: Props) {
  return (
    <MarkdownEditorInner
      key={resetKey}
      initialValue={initialValue}
      onChange={onChange}
    />
  );
}

interface MenuAnchor {
  left: number;
  top: number;
  bottom: number;
}

function MarkdownEditorInner({
  initialValue,
  onChange,
}: {
  initialValue: string;
  onChange: (markdown: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  const [view, setView] = useState<EditorView | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
        const lm = ctx.get(listenerCtx);
        lm.markdownUpdated((_, markdown) => {
          onChangeRef.current(markdown);
        });
        lm.selectionUpdated((innerCtx, selection) => {
          const v = innerCtx.get(editorViewCtx);
          if (selection.empty) {
            setMenuVisible(false);
            return;
          }
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
      .use(listener)
      .create()
      .then((editor) => {
        if (destroyed) {
          editor.destroy();
        } else {
          editorInstance = editor;
          editor.action((ctx) => {
            setView(ctx.get(editorViewCtx));
          });
        }
      })
      .catch((err) => {
        console.error('Milkdown init error:', err);
      });

    return () => {
      destroyed = true;
      setView(null);
      setMenuVisible(false);
      if (editorInstance) {
        editorInstance.destroy();
        editorInstance = null;
      }
      while (root.firstChild) root.removeChild(root.firstChild);
    };
    // initialValue intentionally excluded — parent re-mounts via key change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div ref={containerRef} className="prose max-w-none" />
      <BubbleMenu view={view} anchor={menuAnchor} visible={menuVisible} />
    </>
  );
}
