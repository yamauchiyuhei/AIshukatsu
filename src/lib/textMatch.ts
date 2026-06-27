/**
 * Shared text-normalization + matching helpers.
 *
 * Historically `normalize()` / `matchRank()` were duplicated under
 * `src/tgweb/lib/normalize.ts` (and re-implemented in a couple of other
 * places). This module is the single canonical implementation; the older
 * locations now re-export from here. It powers the hidden Q&A search, the
 * company combobox, and the workspace document search (語彙検索).
 */

/**
 * Fold a string for loose, accent/width/case-insensitive comparison:
 * NFKC → lowercase → hiragana folded onto katakana → whitespace stripped.
 * The whitespace stripping makes matches position-independent, which is why a
 * separate, position-preserving path ({@link buildSnippet}) is used for
 * previews.
 */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) + 0x60),
    )
    .replace(/\s+/g, '');
}

/**
 * Rank how well `query` matches `text`:
 *   0 = exact, 1 = prefix, 2 = substring, -1 = no match (or empty query).
 * Lower is better, mirroring the existing tgweb/mckinsey search semantics.
 */
export function matchRank(query: string, text: string): number {
  const q = normalize(query);
  if (!q) return -1;
  const n = normalize(text);
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.includes(q)) return 2;
  return -1;
}

/**
 * Build a short, single-line preview of `body` centred on the first
 * occurrence of `query`. Uses a lightweight (whitespace-collapsed, lower-cased)
 * scan that preserves character positions, so the snippet lines up with the
 * original text for the common cases; when the match only survives full
 * normalization (e.g. kana folding), it falls back to the head of the body.
 */
export function buildSnippet(body: string, query: string, radius = 40): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  const q = query.trim().toLowerCase();
  const idx = q ? flat.toLowerCase().indexOf(q) : -1;
  if (idx < 0) {
    const head = flat.slice(0, radius * 2);
    return head + (flat.length > head.length ? '…' : '');
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(flat.length, idx + q.length + radius);
  return (
    (start > 0 ? '…' : '') +
    flat.slice(start, end) +
    (end < flat.length ? '…' : '')
  );
}
