/**
 * A small remark plugin that merges sequences of inline `html` mdast nodes
 * (which represent individual `<span ...>` opening and `</span>` closing tags)
 * along with the text content between them into a single `html` node whose
 * value holds the complete wrapped HTML.
 *
 * Why: Milkdown's built-in `html` node is an atom whose `toDOM` uses
 * `innerHTML = node.attrs.value`. If we feed it a complete `<span style="...">text</span>`,
 * it renders as live HTML in the editor (coloured text, highlighted text, etc).
 * By default remark parses `<span>`, `text` and `</span>` as three siblings, so
 * we need this pre-processing step to collapse them back into one unit.
 *
 * Scope: currently only merges `<span ...>...</span>` blocks (no nesting).
 * Anything else is left untouched.
 */

interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
  [key: string]: unknown;
}

const SPAN_OPEN_RE = /^<span\b[^>]*>$/i;
const SPAN_CLOSE_RE = /^<\/span>$/i;

function mergeInChildren(children: MdastNode[]): MdastNode[] {
  const out: MdastNode[] = [];
  let i = 0;
  while (i < children.length) {
    const c = children[i];
    // Recurse into children first so inner containers also get processed
    if (c.children && Array.isArray(c.children)) {
      c.children = mergeInChildren(c.children);
    }

    if (
      c.type === 'html' &&
      typeof c.value === 'string' &&
      SPAN_OPEN_RE.test(c.value.trim())
    ) {
      // Look ahead for the matching close tag, allowing text / inlineCode siblings in between
      let depth = 1;
      let j = i + 1;
      let accumulated = c.value;
      const accumulatedChildren: string[] = [];
      while (j < children.length) {
        const next = children[j];
        if (next.type === 'html' && typeof next.value === 'string') {
          const trimmed = next.value.trim();
          if (SPAN_OPEN_RE.test(trimmed)) {
            depth++;
            accumulated += next.value;
            accumulatedChildren.push(next.value);
          } else if (SPAN_CLOSE_RE.test(trimmed)) {
            depth--;
            accumulated += next.value;
            accumulatedChildren.push(next.value);
            if (depth === 0) break;
          } else {
            accumulated += next.value;
            accumulatedChildren.push(next.value);
          }
        } else if (next.type === 'text' && typeof next.value === 'string') {
          accumulated += next.value;
          accumulatedChildren.push(next.value);
        } else {
          // unsupported node inside span → abort the merge attempt
          break;
        }
        j++;
      }
      if (depth === 0 && j < children.length) {
        // successful merge
        out.push({ type: 'html', value: accumulated });
        i = j + 1;
        continue;
      }
    }

    out.push(c);
    i++;
  }
  return out;
}

export function remarkMergeInlineHtml() {
  return (tree: MdastNode) => {
    if (tree.children && Array.isArray(tree.children)) {
      tree.children = mergeInChildren(tree.children);
    }
    return tree;
  };
}
