import { $prose } from '@milkdown/utils';
import { Plugin } from '@milkdown/prose/state';

/**
 * Allow-list for link schemes we will actually open on click.
 * Only `http://` and `https://` are accepted; anything else
 * (`javascript:`, `data:`, `file:`, `vbscript:`, …) is ignored
 * so a malicious link in a markdown file cannot run arbitrary code.
 */
const SAFE_SCHEME = /^https?:\/\//i;

/**
 * Milkdown / ProseMirror plugin: make `<a>` elements inside the editor
 * actually open in a new tab on a single click.
 *
 * Milkdown is a WYSIWYG editor, so by default a click on a link is consumed
 * as "place the cursor here". We intercept the DOM click on the editor root,
 * walk up to the nearest `<a>`, and if it has an allowed scheme, open it
 * via `window.open(..., '_blank', 'noopener,noreferrer')`.
 *
 * Editing escape hatches:
 *  - A double click (event.detail >= 2) is passed through so users can
 *    drop a caret inside the link text to edit it.
 *  - Users can also arrow-key into the link from an adjacent position.
 *  - The BubbleMenu's "add link" flow works on the current selection and
 *    is unaffected by this plugin.
 */
export const linkClickHandler = $prose(() => {
  return new Plugin({
    props: {
      handleDOMEvents: {
        click: (_view, event) => {
          const target = event.target as HTMLElement | null;
          if (!target) return false;
          const anchor = target.closest('a') as HTMLAnchorElement | null;
          if (!anchor) return false;
          const href = anchor.getAttribute('href');
          if (!href || !SAFE_SCHEME.test(href)) return false;
          // Let double-clicks through so the user can enter edit mode
          // inside the link text if they want to modify it.
          if (event.detail >= 2) return false;
          event.preventDefault();
          event.stopPropagation();
          window.open(href, '_blank', 'noopener,noreferrer');
          return true;
        },
      },
    },
  });
});
