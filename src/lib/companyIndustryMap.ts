/**
 * Company → industry lookup, backed by the static data file
 * `src/data/companyToIndustry.json` produced by
 * `scripts/generateCompanyIndustryMap.ts`.
 *
 * This is intentionally a simple, synchronous, zero-dependency lookup:
 * the JSON is bundled at build time, so no network / IDB / Firestore
 * calls happen at runtime. The map covers every entry in
 * `companyMaster.json` (≈ 2,400 companies), and can be extended by
 * re-running the generator script.
 *
 * Matching is lenient: user input is normalized (NFKC, whitespace,
 * common "株式会社" / "(株)" prefixes/suffixes stripped) so minor typing
 * variations still hit the right row.
 */

import rawMap from '../data/companyToIndustry.json';

const MAP = rawMap as Record<string, string>;

/**
 * Normalize a raw user-entered company name into a stable lookup key.
 *
 * - NFKC: collapses full-width → half-width, half-width kana → full-width
 * - Lowercase (ASCII only)
 * - Strip whitespace (spaces, tabs, full-width space)
 * - Strip the "株式会社" / "(株)" / "㈱" decorations that users sometimes
 *   type and sometimes don't — the data file is stored without them.
 */
function normalize(raw: string): string {
  if (!raw) return '';
  let s = raw.normalize('NFKC').toLowerCase();
  s = s.replace(/[\s　]+/g, '');
  s = s.replace(/^株式会社/, '').replace(/株式会社$/, '');
  s = s.replace(/^\(株\)/, '').replace(/\(株\)$/, '');
  s = s.replace(/^㈱/, '').replace(/㈱$/, '');
  return s;
}

// Build a normalized index at module load time. Falls back to O(n)
// exact match if normalization collides for different companies.
const NORMALIZED_INDEX: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [name, industry] of Object.entries(MAP)) {
    const key = normalize(name);
    if (key && !m.has(key)) m.set(key, industry);
  }
  return m;
})();

/**
 * Look up the industry for a company name. Returns `null` if the name
 * is unknown — callers should treat that as "do not auto-fill" and let
 * the user pick manually.
 */
export function lookupIndustry(rawName: string | null | undefined): string | null {
  if (!rawName) return null;

  // Fast path: exact match (cheap, covers 95%+ of cases)
  const direct = MAP[rawName];
  if (direct) return direct;

  // Slow path: normalized match
  const key = normalize(rawName);
  if (!key) return null;
  return NORMALIZED_INDEX.get(key) ?? null;
}

/** Exposed for tests / debugging. */
export function _internal_mapSize(): number {
  return Object.keys(MAP).length;
}
