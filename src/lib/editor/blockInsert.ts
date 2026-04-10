/**
 * ProseMirror helpers for inserting a new top-level block AFTER a given
 * resolved position. Used by the "+" BlockHandle menu in MarkdownEditor.
 *
 * All block kinds here must round-trip cleanly through the CommonMark / GFM
 * serializer Milkdown uses (so the resulting .md file stays clean).
 */
import type { EditorView } from '@milkdown/prose/view';
import type { Node as PmNode, NodeType, Schema } from '@milkdown/prose/model';
import { TextSelection } from '@milkdown/prose/state';

export type BlockKind =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'bullet_list'
  | 'ordered_list'
  | 'task_list'
  | 'blockquote'
  | 'code_block'
  | 'table';

export interface BlockOption {
  kind: BlockKind;
  /** Menu label shown to users. */
  label: string;
  /** Short keyboard-style hint shown on the right (e.g. "#"). */
  hint?: string;
}

/** Ordered list of blocks available from the "+" menu (Markdown-safe only). */
export const BLOCK_OPTIONS: BlockOption[] = [
  { kind: 'paragraph', label: 'テキスト' },
  { kind: 'heading1', label: '見出し1', hint: '#' },
  { kind: 'heading2', label: '見出し2', hint: '##' },
  { kind: 'heading3', label: '見出し3', hint: '###' },
  { kind: 'heading4', label: '見出し4', hint: '####' },
  { kind: 'bullet_list', label: '箇条書きリスト', hint: '·' },
  { kind: 'ordered_list', label: '番号付きリスト', hint: '1.' },
  { kind: 'task_list', label: 'ToDoリスト', hint: '[ ]' },
  { kind: 'blockquote', label: '引用', hint: '"' },
  { kind: 'code_block', label: 'コードブロック', hint: '```' },
  { kind: 'table', label: 'テーブル' },
];

/**
 * Build the ProseMirror node for a given block kind using the current schema.
 * Returns null if the schema does not expose the node type (shouldn't happen
 * under the commonmark + gfm presets, but we fail soft).
 */
function buildNode(schema: Schema, kind: BlockKind): PmNode | null {
  const n = schema.nodes;

  const paragraph = (): PmNode | null =>
    n.paragraph ? n.paragraph.createAndFill() : null;

  const listItem = (attrs?: Record<string, unknown>): PmNode | null => {
    const itemType: NodeType | undefined = n.list_item;
    const pType: NodeType | undefined = n.paragraph;
    if (!itemType || !pType) return null;
    const p = pType.createAndFill();
    if (!p) return null;
    return itemType.create(attrs ?? null, p);
  };

  switch (kind) {
    case 'paragraph':
      return paragraph();

    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4': {
      const level = Number(kind.replace('heading', ''));
      return n.heading ? n.heading.createAndFill({ level }) : null;
    }

    case 'bullet_list': {
      if (!n.bullet_list) return null;
      const item = listItem();
      return item ? n.bullet_list.create(null, item) : null;
    }

    case 'ordered_list': {
      if (!n.ordered_list) return null;
      const item = listItem();
      return item ? n.ordered_list.create(null, item) : null;
    }

    case 'task_list': {
      // GFM extends list_item with a `checked` attribute; wrapping in
      // bullet_list produces a valid GFM task list on serialization.
      if (!n.bullet_list) return null;
      const item = listItem({ checked: false });
      return item ? n.bullet_list.create(null, item) : null;
    }

    case 'blockquote': {
      if (!n.blockquote) return null;
      const p = paragraph();
      return p ? n.blockquote.create(null, p) : null;
    }

    case 'code_block':
      return n.code_block ? n.code_block.createAndFill() : null;

    case 'table': {
      // Build a 2x3 table: 1 header row + 1 body row.
      const {
        table,
        table_row,
        table_header_row,
        table_header,
        table_cell,
        paragraph: pType,
      } = n;
      if (!table || !table_row || !table_cell || !pType) return null;
      const headerCellType = table_header ?? table_cell;
      const emptyPara = () => pType.createAndFill();
      const headerCells = [0, 1, 2]
        .map(() => {
          const p = emptyPara();
          return p ? headerCellType.create(null, p) : null;
        })
        .filter((x): x is PmNode => !!x);
      const bodyCells = [0, 1, 2]
        .map(() => {
          const p = emptyPara();
          return p ? table_cell.create(null, p) : null;
        })
        .filter((x): x is PmNode => !!x);
      if (headerCells.length !== 3 || bodyCells.length !== 3) return null;
      const headerRowType = table_header_row ?? table_row;
      const headerRow = headerRowType.create(null, headerCells);
      const bodyRow = table_row.create(null, bodyCells);
      return table.create(null, [headerRow, bodyRow]);
    }
  }
}

/**
 * Insert a new block of `kind` into the document, immediately AFTER the
 * top-level block that ends at `afterPos`, then move the selection into the
 * first text position of the new block so the user can keep typing.
 *
 * `afterPos` must be the absolute position BEFORE the hovered block (i.e.
 * `active.$pos.pos` from BlockProvider.active). We add `active.node.nodeSize`
 * internally to land right after it.
 */
export function insertBlockAfter(
  view: EditorView,
  kind: BlockKind,
  beforePos: number,
  blockNodeSize: number,
): boolean {
  const { state } = view;
  const node = buildNode(state.schema, kind);
  if (!node) return false;

  const insertAt = beforePos + blockNodeSize;
  let tr = state.tr.insert(insertAt, node);

  // Move caret to the first valid text position inside the newly inserted
  // block. For tables we land in the first header cell; for lists, in the
  // first list item's paragraph.
  const $inside = tr.doc.resolve(insertAt + 1);
  const selection = TextSelection.near($inside, 1);
  tr = tr.setSelection(selection).scrollIntoView();

  view.dispatch(tr);
  view.focus();
  return true;
}
