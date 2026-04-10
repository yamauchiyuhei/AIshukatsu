import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link as LinkIcon,
  Palette,
  Pilcrow,
  Quote,
  Strikethrough,
} from 'lucide-react';
import type { EditorView } from '@milkdown/prose/view';
import type { MarkType, NodeType } from '@milkdown/prose/model';
import { toggleMark, setBlockType } from '@milkdown/prose/commands';

interface Props {
  view: EditorView | null;
  /** Selection screen position (anchored at top-left of selection range). */
  anchor: { left: number; top: number; bottom: number } | null;
  visible: boolean;
}

export function BubbleMenu({ view, anchor, visible }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [activeMarks, setActiveMarks] = useState<Record<string, boolean>>({});
  const [activeBlock, setActiveBlock] = useState<string>('paragraph');

  // Recompute active marks/block whenever the view's selection changes (driven by parent re-render).
  useEffect(() => {
    if (!view || !visible) return;
    const { state } = view;
    const { from, to, $from } = state.selection;

    const marksOf = (markName: string) => {
      const type = state.schema.marks[markName];
      if (!type) return false;
      return state.doc.rangeHasMark(from, to, type);
    };
    setActiveMarks({
      strong: marksOf('strong'),
      emphasis: marksOf('emphasis'),
      strikeThrough: marksOf('strike_through') || marksOf('strikeThrough'),
      inlineCode: marksOf('inline_code') || marksOf('inlineCode'),
      link: marksOf('link'),
    });

    const node = $from.parent;
    if (node.type.name === 'heading') {
      setActiveBlock(`h${node.attrs.level ?? 1}`);
    } else if (node.type.name === 'blockquote') {
      setActiveBlock('blockquote');
    } else if (node.type.name === 'code_block' || node.type.name === 'codeBlock') {
      setActiveBlock('codeblock');
    } else {
      setActiveBlock('paragraph');
    }
  }, [view, visible, anchor]);

  if (!visible || !view || !anchor) return null;

  const dispatchMark = (markName: string, attrs?: Record<string, unknown>) => {
    const type = view.state.schema.marks[markName] as MarkType | undefined;
    if (!type) return;
    toggleMark(type, attrs)(view.state, view.dispatch);
    view.focus();
  };

  const setHeading = (level: 1 | 2 | 3) => {
    const heading = view.state.schema.nodes.heading as NodeType | undefined;
    if (!heading) return;
    setBlockType(heading, { level })(view.state, view.dispatch);
    view.focus();
  };

  const setParagraph = () => {
    const para = view.state.schema.nodes.paragraph as NodeType | undefined;
    if (!para) return;
    setBlockType(para)(view.state, view.dispatch);
    view.focus();
  };

  const setBlockquote = () => {
    const blockquote =
      (view.state.schema.nodes.blockquote as NodeType | undefined) ??
      (view.state.schema.nodes.block_quote as NodeType | undefined);
    if (!blockquote) return;
    // Note: blockquote wraps content, but for simplicity we use setBlockType which only works on block nodes
    setBlockType(blockquote)(view.state, view.dispatch);
    view.focus();
  };

  const addLink = () => {
    const linkType = view.state.schema.marks.link as MarkType | undefined;
    if (!linkType) return;
    const url = window.prompt('リンクURLを入力');
    if (!url) return;
    toggleMark(linkType, { href: url })(view.state, view.dispatch);
    view.focus();
  };

  /**
   * Extract the plain text content of the current selection, walking into
   * any `html` atom nodes (which contain a `<span>…</span>` HTML string) and
   * returning just the inner text. Without this helper, `textBetween` would
   * return empty string for atom nodes and the replacement would eat them.
   */
  const extractSelectionPlainText = (
    v: EditorView,
    from: number,
    to: number,
  ): string => {
    let text = '';
    v.state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isText) {
        const start = Math.max(from, pos);
        const end = Math.min(to, pos + node.nodeSize);
        text += (node.text ?? '').slice(start - pos, end - pos);
        return false;
      }
      if (node.type.name === 'html') {
        const value = (node.attrs.value as string) ?? '';
        // Strip all <span ...> and </span> tags, keep inner text content.
        // Anything else inside (unlikely here) is also stripped.
        const stripped = value
          .replace(/<span\b[^>]*>/gi, '')
          .replace(/<\/span>/gi, '')
          .replace(/<[^>]+>/g, ''); // belt-and-braces for any other tags
        text += stripped;
        return false;
      }
      return true;
    });
    return text;
  };

  /**
   * Wrap the current selection in a `<span style="...">…</span>` by replacing
   * it with an `html` atom node. Previously-colored spans in the selection
   * get unwrapped first (so their text is preserved and their old style is
   * overwritten by the new one).
   */
  const wrapWithStyle = (styleValue: string) => {
    const htmlType = view.state.schema.nodes.html as NodeType | undefined;
    if (!htmlType) return;
    const { from, to, empty } = view.state.selection;
    if (empty) return;
    const plainText = extractSelectionPlainText(view, from, to);
    if (!plainText) return;
    const safe = plainText.replace(/<\/span>/gi, '');
    const value = `<span style="${styleValue}">${safe}</span>`;
    const node = htmlType.create({ value });
    const tr = view.state.tr.replaceWith(from, to, node);
    view.dispatch(tr);
    view.focus();
  };

  /**
   * Remove any color/background wrapping from the current selection, leaving
   * plain text in its place.
   */
  const unwrapToPlainText = () => {
    const { from, to, empty } = view.state.selection;
    if (empty) return;
    const plainText = extractSelectionPlainText(view, from, to);
    if (!plainText) return;
    const textNode = view.state.schema.text(plainText);
    const tr = view.state.tr.replaceWith(from, to, textNode);
    view.dispatch(tr);
    view.focus();
  };

  const applyTextColor = (color: string) => {
    if (color === 'inherit') {
      unwrapToPlainText();
      return;
    }
    wrapWithStyle(`color:${color}`);
  };

  const applyBgColor = (color: string) => {
    if (color === 'transparent') {
      unwrapToPlainText();
      return;
    }
    wrapWithStyle(
      `background-color:${color}; padding:0 3px; border-radius:3px`,
    );
  };

  // Find the strikethrough mark name (varies between presets)
  const strikeMarkName = view.state.schema.marks.strike_through
    ? 'strike_through'
    : 'strikeThrough';
  const codeMarkName = view.state.schema.marks.inline_code
    ? 'inline_code'
    : 'inlineCode';

  // Position above the selection. Clamp to viewport edges.
  const menuHeight = 38;
  const top = Math.max(8, anchor.top - menuHeight - 8);
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - 360));

  return (
    <div
      ref={menuRef}
      className="bubble-menu fixed z-50 flex h-9 items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1 shadow-lg"
      style={{ top, left }}
      onMouseDown={(e) => e.preventDefault()} // keep editor focus
    >
      <BlockTypeDropdown
        active={activeBlock}
        onParagraph={setParagraph}
        onHeading={setHeading}
        onBlockquote={setBlockquote}
      />

      <div className="mx-1 h-5 w-px bg-slate-200" />

      <ToolbarButton
        active={activeMarks.strong}
        title="太字 (⌘B)"
        onClick={() => dispatchMark('strong')}
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        active={activeMarks.emphasis}
        title="斜体 (⌘I)"
        onClick={() => dispatchMark('emphasis')}
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        active={activeMarks.strikeThrough}
        title="取り消し線"
        onClick={() => dispatchMark(strikeMarkName)}
      >
        <Strikethrough size={14} />
      </ToolbarButton>
      <ToolbarButton
        active={activeMarks.inlineCode}
        title="インラインコード"
        onClick={() => dispatchMark(codeMarkName)}
      >
        <Code size={14} />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-slate-200" />

      <ColorPaletteButton
        icon={<Palette size={14} />}
        title="文字色"
        palette={TEXT_COLORS}
        onPick={applyTextColor}
      />
      <ColorPaletteButton
        icon={<Highlighter size={14} />}
        title="背景色 (ハイライト)"
        palette={BG_COLORS}
        onPick={applyBgColor}
      />

      <div className="mx-1 h-5 w-px bg-slate-200" />

      <ToolbarButton active={activeMarks.link} title="リンク (⌘K)" onClick={addLink}>
        <LinkIcon size={14} />
      </ToolbarButton>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Color palette dropdown
// ────────────────────────────────────────────────────────────────────────────

interface Swatch {
  label: string;
  value: string;
}

const TEXT_COLORS: Swatch[] = [
  { label: 'デフォルト', value: 'inherit' },
  { label: 'グレー', value: '#64748b' },
  { label: '赤', value: '#ef4444' },
  { label: 'オレンジ', value: '#f97316' },
  { label: '黄', value: '#eab308' },
  { label: '緑', value: '#22c55e' },
  { label: '青', value: '#3b82f6' },
  { label: '紫', value: '#a855f7' },
  { label: '桃', value: '#ec4899' },
];

const BG_COLORS: Swatch[] = [
  { label: 'なし', value: 'transparent' },
  { label: 'グレー', value: '#e2e8f0' },
  { label: '赤', value: '#fecaca' },
  { label: 'オレンジ', value: '#fed7aa' },
  { label: '黄', value: '#fef08a' },
  { label: '緑', value: '#bbf7d0' },
  { label: '青', value: '#bfdbfe' },
  { label: '紫', value: '#e9d5ff' },
  { label: '桃', value: '#fbcfe8' },
];

function ColorPaletteButton({
  icon,
  title,
  palette,
  onPick,
}: {
  icon: React.ReactNode;
  title: string;
  palette: Swatch[];
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={title}
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        {icon}
      </button>
      {open && (
        <div
          className="absolute left-0 top-9 z-[60] w-40 rounded-md border border-slate-200 bg-white p-1 shadow-xl"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="mb-1 px-2 pt-1 text-[10px] font-medium uppercase text-slate-400">
            {title}
          </div>
          <div className="grid grid-cols-1 gap-0.5">
            {palette.map((s) => (
              <button
                key={s.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  onPick(s.value);
                }}
                className="flex items-center gap-2 rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
              >
                <span
                  className="h-4 w-4 shrink-0 rounded border border-slate-200"
                  style={{
                    backgroundColor:
                      s.value === 'inherit' || s.value === 'transparent'
                        ? 'white'
                        : s.value,
                  }}
                />
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex h-7 w-7 items-center justify-center rounded transition ${
        active
          ? 'bg-slate-900 text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function BlockTypeDropdown({
  active,
  onParagraph,
  onHeading,
  onBlockquote,
}: {
  active: string;
  onParagraph: () => void;
  onHeading: (level: 1 | 2 | 3) => void;
  onBlockquote: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const labels: Record<string, { icon: React.ReactNode; label: string }> = {
    paragraph: { icon: <Pilcrow size={14} />, label: '本文' },
    h1: { icon: <Heading1 size={14} />, label: '見出し1' },
    h2: { icon: <Heading2 size={14} />, label: '見出し2' },
    h3: { icon: <Heading3 size={14} />, label: '見出し3' },
    blockquote: { icon: <Quote size={14} />, label: '引用' },
    codeblock: { icon: <Code size={14} />, label: 'コード' },
  };

  const current = labels[active] ?? labels.paragraph;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className="flex h-7 items-center gap-1 rounded px-2 text-xs text-slate-700 hover:bg-slate-100"
      >
        {current.icon}
        <span>{current.label}</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-10 w-32 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          <DropdownItem
            icon={<Pilcrow size={13} />}
            label="本文"
            onClick={() => {
              onParagraph();
              setOpen(false);
            }}
          />
          <DropdownItem
            icon={<Heading1 size={13} />}
            label="見出し1"
            onClick={() => {
              onHeading(1);
              setOpen(false);
            }}
          />
          <DropdownItem
            icon={<Heading2 size={13} />}
            label="見出し2"
            onClick={() => {
              onHeading(2);
              setOpen(false);
            }}
          />
          <DropdownItem
            icon={<Heading3 size={13} />}
            label="見出し3"
            onClick={() => {
              onHeading(3);
              setOpen(false);
            }}
          />
          <DropdownItem
            icon={<Quote size={13} />}
            label="引用"
            onClick={() => {
              onBlockquote();
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
