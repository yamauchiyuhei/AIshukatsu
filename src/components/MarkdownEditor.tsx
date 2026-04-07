import { useEffect, useRef } from 'react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { nord } from '@milkdown/theme-nord';
import { listener, listenerCtx } from '@milkdown/plugin-listener';

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

function MarkdownEditorInner({
  initialValue,
  onChange,
}: {
  initialValue: string;
  onChange: (markdown: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
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
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onChangeRef.current(markdown);
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
        }
      })
      .catch((err) => {
        console.error('Milkdown init error:', err);
      });

    return () => {
      destroyed = true;
      if (editorInstance) {
        editorInstance.destroy();
        editorInstance = null;
      }
      // Milkdown mounts content inside `root`; clear leftover DOM just in case
      while (root.firstChild) root.removeChild(root.firstChild);
    };
    // initialValue intentionally excluded — parent re-mounts via key change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="prose max-w-none" />;
}
