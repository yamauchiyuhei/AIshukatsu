/**
 * Webテスト解答集（雑多な xlsx）→ パイプライン形式への共通変換エンジン。
 * buildCgabData.ts（新テスト構築）と mergeSupplements.ts（既存へマージ）が共用する。
 */
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

export type Rank = 'A' | 'B' | 'C' | 'D' | 'N';

/** 採用済みアイテム（アプリが読む形） */
export interface Item {
  q: string;
  a: string;
  rank: Rank;
  verify: boolean;
}

/** 抽出された生の解答候補（名寄せ前） */
export interface Cand {
  rawQ: string; // 名寄せキー用の素の設問テキスト
  q: string; // 表示用（【テーマ】設問）
  a: string;
  weight: number;
  confirmed: boolean;
  ambiguous: boolean;
  src: string;
}

// ── helpers ──────────────────────────────────────────────────────────
export const s = (v: unknown): string =>
  v === null || v === undefined ? '' : String(v).trim();

export function stripNumPrefix(t: string): string {
  return t
    .replace(/^[\s　]*[0-9０-９]+\s*[、，．.）)]\s*/, '')
    .replace(/^[\s　]*[①-⑳]\s*/, '')
    .trim();
}

/** 名寄せキー: 空白・記号を除去して比較しやすくする */
export function normKey(t: string): string {
  return t
    .toLowerCase()
    .replace(/[\s　]/g, '')
    .replace(/[、。，．,.「」『』（）()【】［］\[\]・〜~ー!！?？:：;；…“”"']/g, '');
}
export const normA = (a: string): string => a.toLowerCase().replace(/[\s　（）()]/g, '');

const isSeq = (t: string) => /^[A-EＡ-Ｅ]{2,}$/.test(t.replace(/\s/g, ''));
const isLegend = (t: string) =>
  /新問題|ピンク|旧問題|黄色|答えの順番に被り|頻出問題/.test(t);
const isHeaderish = (t: string) =>
  ['問題', '問題文', '設問', '解答', '答え', '回答', 'no.', 'no', '番号', '問題番号'].includes(
    t.toLowerCase(),
  );
const isVoteMark = (v: string): boolean => {
  const t = v.replace(/[\s　]/g, '');
  return /^[〇○◯◎✓✔oO]+$/.test(t) || /^[1-9]\d*$/.test(t);
};
const countVotes = (row: unknown[], cols: number[]): number =>
  cols.reduce((n, c) => n + (isVoteMark(s(row[c])) ? 1 : 0), 0);

export function readWorkbook(p: string): XLSX.WorkBook {
  return XLSX.read(readFileSync(p), { type: 'buffer' });
}
export function sheetRows(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
}

// ── parser configs ───────────────────────────────────────────────────
export interface FlatCfg { q: number; a: number; a2?: number; voters?: number[]; hasHeader?: boolean }
export interface PassageCfg {
  theme: number; q: number; a: number; a2?: number; seqCol?: number;
  confirmCol?: number; voters?: number[]; hasHeader?: boolean;
}
export interface SeqCfg { q: number; a: number; voters?: number[]; hasHeader?: boolean }

export function parseFlat(rows: unknown[][], cfg: FlatCfg, src: string): Cand[] {
  const out: Cand[] = [];
  for (let i = cfg.hasHeader ? 1 : 0; i < rows.length; i++) {
    const q = s(rows[i][cfg.q]);
    if (!q || isHeaderish(q) || isLegend(q)) continue;
    const a = s(rows[i][cfg.a]) || (cfg.a2 != null ? s(rows[i][cfg.a2]) : '');
    const weight = 1 + (cfg.voters ? countVotes(rows[i], cfg.voters) : 0);
    out.push({ rawQ: q, q, a, weight, confirmed: false, ambiguous: /[?？]/.test(a), src });
  }
  return out;
}

export function parsePassage(rows: unknown[][], cfg: PassageCfg, src: string): Cand[] {
  interface G { theme: string; subs: Omit<Cand, 'q' | 'src'>[]; seq?: string }
  const groups: G[] = [];
  let cur: G | null = null;
  for (let i = cfg.hasHeader ? 1 : 0; i < rows.length; i++) {
    const t = s(rows[i][cfg.theme]);
    const qt = s(rows[i][cfg.q]);
    const av = s(rows[i][cfg.a]) || (cfg.a2 != null ? s(rows[i][cfg.a2]) : '');
    if (t && isLegend(t)) continue;
    if (t && !isHeaderish(t)) { cur = { theme: t, subs: [] }; groups.push(cur); }
    if (!cur) { cur = { theme: '', subs: [] }; groups.push(cur); }
    if (qt && !isHeaderish(qt)) {
      const confirmed = cfg.confirmCol != null && /[〇○◯]|ok/i.test(s(rows[i][cfg.confirmCol]));
      const weight = 1 + (cfg.voters ? countVotes(rows[i], cfg.voters) : 0);
      cur.subs.push({ rawQ: stripNumPrefix(qt), a: av, weight, confirmed, ambiguous: /[?？]|\bor\b/i.test(av) });
    }
    if (cfg.seqCol != null && !cur.seq) {
      const sv = s(rows[i][cfg.seqCol]);
      if (isSeq(sv)) cur.seq = sv.replace(/\s/g, '');
    }
  }
  const out: Cand[] = [];
  for (const g of groups) {
    const seq = g.seq && g.seq.length === g.subs.length ? g.seq : null;
    g.subs.forEach((sub, idx) => {
      const a = sub.a || (seq ? seq[idx] : '');
      const q = g.theme ? `【${g.theme}】${sub.rawQ}` : sub.rawQ;
      out.push({ ...sub, a, q, src });
    });
  }
  return out;
}

/** テーマと設問が同じ列にあり、解答列の有無で区別する（解答が空＝テーマ行 or 未解答設問） */
export interface InlineCfg { q: number; a: number; hasHeader?: boolean }
export function parsePassageInline(rows: unknown[][], cfg: InlineCfg, src: string): Cand[] {
  const out: Cand[] = [];
  let theme = '';
  for (let i = cfg.hasHeader ? 1 : 0; i < rows.length; i++) {
    const qt = s(rows[i][cfg.q]);
    const av = s(rows[i][cfg.a]);
    if (!qt || isHeaderish(qt) || isLegend(qt)) continue;
    const numbered = /^[\s　]*[0-9０-９①-⑳]/.test(qt);
    if (!av && !numbered) { theme = qt; continue; } // テーマ行
    const rawQ = stripNumPrefix(qt);
    const q = theme ? `【${theme}】${rawQ}` : rawQ;
    out.push({ rawQ, q, a: av, weight: 1, confirmed: false, ambiguous: /[?？]/.test(av), src });
  }
  return out;
}

/** 1行に テーマ + 設問1..N + 解答1..N が横並び（新型シート等） */
export interface WideCfg { theme: number; qCols: number[]; aCols: number[]; hasHeader?: boolean }
export function parseWideParallel(rows: unknown[][], cfg: WideCfg, src: string): Cand[] {
  const out: Cand[] = [];
  for (let i = cfg.hasHeader ? 1 : 0; i < rows.length; i++) {
    const theme = s(rows[i][cfg.theme]);
    for (let j = 0; j < cfg.qCols.length; j++) {
      const qt = s(rows[i][cfg.qCols[j]]);
      if (!qt || isHeaderish(qt)) continue;
      const av = s(rows[i][cfg.aCols[j]]);
      const rawQ = stripNumPrefix(qt);
      const q = theme && !isHeaderish(theme) ? `【${theme}】${rawQ}` : rawQ;
      out.push({ rawQ, q, a: av, weight: 1, confirmed: false, ambiguous: /[?？]/.test(av), src });
    }
  }
  return out;
}

export function parsePassageSeq(rows: unknown[][], cfg: SeqCfg, src: string): Cand[] {
  const out: Cand[] = [];
  for (let i = cfg.hasHeader ? 1 : 0; i < rows.length; i++) {
    const q = s(rows[i][cfg.q]);
    if (!q || isHeaderish(q) || isLegend(q)) continue;
    const a = s(rows[i][cfg.a]);
    const weight = 1 + (cfg.voters ? countVotes(rows[i], cfg.voters) : 0);
    out.push({ rawQ: q, q, a, weight, confirmed: false, ambiguous: /[?？]/.test(a), src });
  }
  return out;
}

export type SheetSpec =
  | { sheet: string; type: 'flat'; cfg: FlatCfg }
  | { sheet: string; type: 'passage'; cfg: PassageCfg }
  | { sheet: string; type: 'seq'; cfg: SeqCfg }
  | { sheet: string; type: 'inline'; cfg: InlineCfg }
  | { sheet: string; type: 'wide'; cfg: WideCfg };

export function parseSheetSpec(rows: unknown[][], spec: SheetSpec, src: string): Cand[] {
  switch (spec.type) {
    case 'flat': return parseFlat(rows, spec.cfg, src);
    case 'seq': return parsePassageSeq(rows, spec.cfg, src);
    case 'inline': return parsePassageInline(rows, spec.cfg, src);
    case 'wide': return parseWideParallel(rows, spec.cfg, src);
    default: return parsePassage(rows, spec.cfg, src);
  }
}

// ── merge (名寄せ＋重み投票) ──────────────────────────────────────────
export interface Merged { key: string; q: string; a: string; rank: Rank; verify: boolean; sources: number }

/** 候補群を質問文で名寄せし、重み投票で採用解答を決める */
export function mergeCands(cands: Cand[]): Merged[] {
  interface Acc {
    q: string; byAns: Map<string, { a: string; w: number }>;
    confirmed: boolean; ambiguous: boolean; sources: Set<string>;
  }
  const map = new Map<string, Acc>();
  for (const c of cands) {
    const k = normKey(c.rawQ);
    if (!k) continue;
    let acc = map.get(k);
    if (!acc) { acc = { q: c.q, byAns: new Map(), confirmed: false, ambiguous: false, sources: new Set() }; map.set(k, acc); }
    acc.sources.add(c.src);
    if (c.confirmed) acc.confirmed = true;
    if (c.ambiguous) acc.ambiguous = true;
    if (c.a) {
      const ak = normA(c.a);
      const prev = acc.byAns.get(ak);
      if (prev) prev.w += c.weight;
      else acc.byAns.set(ak, { a: c.a, w: c.weight });
    }
    if (c.q.length > acc.q.length) acc.q = c.q; // 情報量の多い表示を採用
  }
  const out: Merged[] = [];
  for (const [key, acc] of map) {
    const ranked = [...acc.byAns.values()].sort((a, b) => b.w - a.w);
    const top = ranked[0];
    const disagree = ranked.length > 1;
    const totalW = ranked.reduce((n, x) => n + x.w, 0);
    let rank: Rank;
    if (!top) rank = 'N';
    else if (acc.ambiguous || disagree) rank = 'C';
    else if (acc.confirmed || totalW >= 3) rank = 'A';
    else rank = 'B';
    out.push({ key, q: acc.q, a: top ? top.a : '', rank, verify: acc.ambiguous || disagree, sources: acc.sources.size });
  }
  return out;
}

export interface MergeStats { baseline: number; filled: number; agreed: number; conflict: number; appended: number; total: number }

/**
 * 既存ベースラインに補助データ（名寄せ済み）をマージ。
 *  - 既存が空欄 & 補助に解答 → 穴埋め
 *  - 一致 → そのまま（要検証は付けない）
 *  - 不一致 → 既存の解答を保持し要検証フラグ
 *  - 既存に無い → 追記
 */
export function mergeIntoBaseline(baseline: Item[], supp: Merged[]): { items: Item[]; stats: MergeStats } {
  const items = baseline.map((b) => ({ ...b }));
  const byKey = new Map<string, Item>();
  // 表示用 q 全体で名寄せ → 追記アイテムは再実行時に自分自身と一致し二重追記しない
  for (const it of items) {
    const k = normKey(it.q);
    if (!byKey.has(k)) byKey.set(k, it);
  }
  const stats: MergeStats = { baseline: baseline.length, filled: 0, agreed: 0, conflict: 0, appended: 0, total: 0 };
  for (const m of supp) {
    const mk = normKey(m.q);
    const ex = byKey.get(mk);
    if (!ex) {
      const it: Item = { q: m.q, a: m.a, rank: m.rank, verify: m.verify };
      items.push(it);
      byKey.set(mk, it);
      stats.appended++;
      continue;
    }
    if (!ex.a && m.a) { ex.a = m.a; ex.rank = m.rank === 'N' ? ex.rank : m.rank; stats.filled++; continue; }
    if (ex.a && m.a) {
      if (normA(ex.a) === normA(m.a)) stats.agreed++;
      else { ex.verify = true; stats.conflict++; }
    }
  }
  stats.total = items.length;
  return { items, stats };
}

// ── crypto (Web Crypto API, Node 18+) ────────────────────────────────
const PBKDF2_ITER = 200_000;
const b64 = (buf: ArrayBuffer | Uint8Array): string =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString('base64');
const b64d = (str: string): Uint8Array => Uint8Array.from(Buffer.from(str, 'base64'));

async function deriveKey(password: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, usage,
  );
}

export interface EncBlob { v: 1; salt: string; iv: string; ct: string }

export async function encryptJson(data: unknown, password: string): Promise<EncBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
  return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

export async function decryptJson<T = unknown>(blob: EncBlob, password: string): Promise<T> {
  const key = await deriveKey(password, b64d(blob.salt), ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, key, b64d(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}
