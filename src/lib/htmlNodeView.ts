import { $prose } from '@milkdown/utils';
import { Plugin } from '@milkdown/prose/state';

import { sanitizeHtml } from './safeHtml';

/**
 * Override the rendering of Milkdown's built-in `html` atom node so that raw
 * inline HTML (coming from e.g. `<span style="color:#ef4444">text</span>`) is
 * rendered with `innerHTML` instead of `textContent`. The underlying mdast /
 * markdown source is unchanged, only the editor preview differs.
 */
export const htmlInnerNodeView = $prose(() => {
  return new Plugin({
    props: {
      nodeViews: {
        html: (node) => {
          const dom = document.createElement('span');
          dom.setAttribute('data-type', 'html');
          dom.setAttribute('data-value', node.attrs.value ?? '');
          const value = typeof node.attrs.value === 'string' ? node.attrs.value : '';
          dom.innerHTML = sanitizeHtml(value);
          return {
            dom,
            update(updatedNode) {
              if (updatedNode.type.name !== 'html') return false;
              const v =
                typeof updatedNode.attrs.value === 'string'
                  ? updatedNode.attrs.value
                  : '';
              dom.setAttribute('data-value', v);
              dom.innerHTML = sanitizeHtml(v);
              return true;
            },
            // atom node — no content inside, so no contentDOM
          };
        },
      },
    },
  });
});
