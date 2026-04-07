/**
 * Normalize variant 締切項目 names to a small set of canonical names so the
 * matrix view can stay on a single sane axis. Only used at display time —
 * the underlying markdown files keep their original item names.
 */

const NORMALIZATION_RULES: { match: RegExp; canonical: string }[] = [
  // エントリー系
  { match: /^(プレ)?エントリー(\(.+\))?$/, canonical: 'エントリー' },
  { match: /(本選考|インターン)エントリー/, canonical: 'エントリー' },
  { match: /^エントリー[(\(]/, canonical: 'エントリー' },

  // ES系
  { match: /^ES.*提出/, canonical: 'ES提出' },
  { match: /^ES(\s|$)/, canonical: 'ES提出' },
  { match: /エントリーシート/, canonical: 'ES提出' },

  // Webテスト系 (SPI / 玉手箱 / TG-WEB / TAL / Solve Game など全部)
  { match: /Webテスト/i, canonical: 'Webテスト' },
  { match: /^(SPI|玉手箱|TG-WEB|C-GAB|Solve\s*Game|TAL)/i, canonical: 'Webテスト' },
  { match: /(クレペリン|適性検査)/, canonical: 'Webテスト' },

  // GD系
  { match: /^GD/, canonical: 'GD' },
  { match: /グループディスカッション/, canonical: 'GD' },
  { match: /1day\s*job/i, canonical: 'GD' },

  // 面接系 (順番に注意: 「最終」を先に判定)
  { match: /^最終面接/, canonical: '最終面接' },
  { match: /^3次面接/, canonical: '3次面接' },
  { match: /^2次面接/, canonical: '2次面接' },
  { match: /^1次面接/, canonical: '1次面接' },
];

export const CANONICAL_ORDER: string[] = [
  'エントリー',
  'ES提出',
  'Webテスト',
  'GD',
  '1次面接',
  '2次面接',
  '3次面接',
  '最終面接',
];

const CANONICAL_SET = new Set(CANONICAL_ORDER);

export function normalizeItem(raw: string): string {
  const trimmed = raw.trim();
  if (CANONICAL_SET.has(trimmed)) return trimmed;
  for (const rule of NORMALIZATION_RULES) {
    if (rule.match.test(trimmed)) return rule.canonical;
  }
  return trimmed;
}

export function isCanonicalItem(name: string): boolean {
  return CANONICAL_SET.has(name);
}

/**
 * Sort a list of item names so canonical items appear first in the standard
 * flow order, with any unknown items appended alphabetically afterwards.
 */
export function sortCanonicalFirst(items: string[]): string[] {
  const known: string[] = [];
  const unknown: string[] = [];
  for (const i of items) {
    if (CANONICAL_SET.has(i)) known.push(i);
    else unknown.push(i);
  }
  known.sort((a, b) => CANONICAL_ORDER.indexOf(a) - CANONICAL_ORDER.indexOf(b));
  unknown.sort((a, b) => a.localeCompare(b, 'ja'));
  return [...known, ...unknown];
}
