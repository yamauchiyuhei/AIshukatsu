/**
 * 新規の解答集 xlsx を、既存テスト（gab / tamatebako / tgweb / spi）の
 * 暗号化データに「追記＋重複マージ」する。
 *
 * 方針（mergeIntoBaseline）:
 *   - 既存が空欄 & 補助に解答 → 穴埋め
 *   - 一致 → そのまま
 *   - 不一致 → 既存を保持し要検証フラグ
 *   - 既存に無い → 追記
 *
 * ベースラインは既存 enc.json を復号して読む（元の巨大 xlsx は触らない）。
 * 名寄せキーは theme を除去して一致させるため、再実行しても二重追記しない。
 *
 * Usage:
 *   npx tsx scripts/mergeSupplements.ts --dry          # 集計のみ
 *   npx tsx scripts/mergeSupplements.ts --only gab     # gab だけ実行
 *   npx tsx scripts/mergeSupplements.ts                # 全テスト実行（上書き）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type SheetSpec, type Cand, type Item, type EncBlob,
  readWorkbook, sheetRows, parseSheetSpec, mergeCands, mergeIntoBaseline,
  encryptJson, decryptJson,
} from './lib/webtestParse';
import { readdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');
const onlyIdx = process.argv.indexOf('--only');
const ONLY = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;

function loadEnv(p: string) {
  if (!existsSync(p)) return;
  for (const raw of readFileSync(p, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(path.join(ROOT, '.env.local'));

// ── supplement registry ──────────────────────────────────────────────
type CatSheet = SheetSpec & { cat: string }; // cat = enc.json basename
interface SuppSource { label: string; match: (f: string) => boolean; test: string; sheets: CatSheet[] }

const SOURCES: SuppSource[] = [
  {
    label: 'gab統合版',
    test: 'gab',
    match: (f) => f.includes('統合版'),
    sheets: [
      { cat: 'gengo', sheet: '言語', type: 'passage', cfg: { theme: 0, q: 1, a: 2, hasHeader: true } },
      { cat: 'higengo', sheet: '非言語', type: 'flat', cfg: { q: 1, a: 2, hasHeader: true } },
      { cat: 'eigo', sheet: '英語', type: 'passage', cfg: { theme: 1, q: 2, a: 4, hasHeader: true } },
    ],
  },
  {
    label: '【1月最新版】',
    test: 'tamatebako',
    match: (f) => f.includes('1月最新版'),
    sheets: [
      { cat: 'gengo', sheet: '玉手箱 言語', type: 'inline', cfg: { q: 0, a: 1, hasHeader: true } },
      { cat: 'gengo_fuitchi', sheet: '玉手箱(言語) 一致していない', type: 'flat', cfg: { q: 0, a: 1, hasHeader: false } },
      { cat: 'higengo_zuhyou', sheet: '玉手箱 非言語 読み取り', type: 'passage', cfg: { theme: 0, q: 1, a: 2, hasHeader: true } },
      { cat: 'higengo_kuuran', sheet: '玉手箱 非言語 推測', type: 'passage', cfg: { theme: 0, q: 1, a: 2, hasHeader: true } },
      { cat: 'higengo_kongou', sheet: '読み取り  推測 混合', type: 'flat', cfg: { q: 0, a: 1, hasHeader: false } },
      { cat: 'higengo_fuitchi', sheet: '玉手箱(非言語) 一致していない', type: 'passage', cfg: { theme: 0, q: 1, a: 2, hasHeader: true } },
      { cat: 'eigo', sheet: '玉手箱 英語', type: 'passage', cfg: { theme: 0, q: 1, a: 2, hasHeader: true } },
    ],
  },
  {
    label: '【言語9割】tama',
    test: 'tamatebako',
    match: (f) => f.includes('9割'),
    sheets: [
      { cat: 'gengo', sheet: '玉手箱　言語', type: 'wide', cfg: { theme: 0, qCols: [1, 2, 3, 4], aCols: [5, 6, 7, 8], hasHeader: true } },
      { cat: 'higengo_zuhyou', sheet: '玉手箱　非言語', type: 'passage', cfg: { theme: 0, q: 1, a: 2, hasHeader: true } },
      { cat: 'eigo', sheet: '玉手箱　英語', type: 'passage', cfg: { theme: 0, q: 1, a: 2, hasHeader: true } },
    ],
  },
  {
    label: 'WEBテスト完全版/tama',
    test: 'tamatebako',
    match: (f) => f.includes('完全版') && f.includes('玉手箱'),
    sheets: [
      { cat: 'shingata', sheet: '玉手箱 言語（新型）', type: 'wide', cfg: { theme: 0, qCols: [1, 2, 3, 4], aCols: [5, 6, 7, 8], hasHeader: true } },
      { cat: 'shingata', sheet: '玉手箱　非言語（新型）', type: 'wide', cfg: { theme: 0, qCols: [1, 2, 3, 4, 5], aCols: [6, 7, 8, 9, 10], hasHeader: true } },
      { cat: 'gengo', sheet: '玉手箱　言語　(旧型) ', type: 'flat', cfg: { q: 0, a: 1, hasHeader: true } },
      { cat: 'higengo_kongou', sheet: '玉手箱　非言語　(旧型） ', type: 'flat', cfg: { q: 0, a: 1, hasHeader: true } },
      { cat: 'eigo', sheet: '玉手箱　英語 ', type: 'flat', cfg: { q: 0, a: 1, hasHeader: true } },
    ],
  },
  {
    label: 'WEBテスト完全版/tgweb',
    test: 'tgweb',
    match: (f) => f.includes('完全版') && f.includes('玉手箱'),
    sheets: [
      { cat: 'gengo', sheet: 'TG-WEB　言語 ', type: 'flat', cfg: { q: 0, a: 1, hasHeader: true } },
      { cat: 'higengo', sheet: 'TG-WEB　非言語 ', type: 'flat', cfg: { q: 0, a: 1, hasHeader: true } },
      { cat: 'eigo', sheet: 'TG-WEB 英語', type: 'flat', cfg: { q: 0, a: 1, hasHeader: true } },
    ],
  },
  {
    label: 'WEBテスト完全版/spi',
    test: 'spi',
    match: (f) => f.includes('完全版') && f.includes('玉手箱'),
    sheets: [
      { cat: 'gengo', sheet: 'SPI 言語', type: 'flat', cfg: { q: 0, a: 1, hasHeader: true } },
      { cat: 'higengo', sheet: 'SPI  非言語 ', type: 'flat', cfg: { q: 0, a: 1, hasHeader: true } },
    ],
  },
  {
    label: '【言語9割】spi',
    test: 'spi',
    match: (f) => f.includes('9割'),
    sheets: [
      { cat: 'gengo', sheet: 'ＳＰＩ言語　2月更新', type: 'flat', cfg: { q: 0, a: 1, hasHeader: true } },
      { cat: 'higengo', sheet: 'ＳＰＩ　非言語', type: 'flat', cfg: { q: 0, a: 1, hasHeader: true } },
    ],
  },
  {
    // 横並びの複数ブロックレイアウト。同一シートを列違いで複数回パースして結合。
    label: '2028玉手箱',
    test: 'tamatebako',
    match: (f) => f.includes('2028玉手箱'),
    sheets: [
      { cat: 'gengo', sheet: '玉手箱（言語）🙆', type: 'passage', cfg: { theme: 1, q: 2, a: 3, hasHeader: false } },
      { cat: 'gengo', sheet: '玉手箱（言語）🙆', type: 'passage', cfg: { theme: 9, q: 10, a: 11, hasHeader: false } },
      { cat: 'higengo_zuhyou', sheet: '玉手箱（表の読み取り）🙆', type: 'wide', cfg: { theme: 1, qCols: [2, 4, 6, 8, 10], aCols: [3, 5, 7, 9, 11], hasHeader: false } },
      { cat: 'higengo_kuuran', sheet: '玉手箱（非言語）🙆', type: 'passage', cfg: { theme: 2, q: 3, a: 4, hasHeader: false } },
      { cat: 'higengo_kuuran', sheet: '玉手箱（非言語）🙆', type: 'passage', cfg: { theme: 7, q: 8, a: 9, hasHeader: false } },
      { cat: 'higengo_kongou', sheet: '玉手箱（非言語）🙆', type: 'seq', cfg: { q: 15, a: 16, hasHeader: false } },
      { cat: 'eigo', sheet: '玉手箱（英語）🙆', type: 'passage', cfg: { theme: 1, q: 2, a: 3, hasHeader: false } },
      { cat: 'eigo', sheet: '玉手箱（英語）🙆', type: 'passage', cfg: { theme: 7, q: 8, a: 9, hasHeader: false } },
      { cat: 'eigo', sheet: '玉手箱 英語（上坂）', type: 'passage', cfg: { theme: 0, q: 1, a: 2, hasHeader: false } },
      { cat: 'eigo', sheet: '玉手箱 英語（上坂）', type: 'seq', cfg: { q: 6, a: 7, hasHeader: false } },
    ],
  },
];

async function main() {
  const pw = process.env.TGWEB_PASSPHRASE;
  if (!pw) { console.error('❌ TGWEB_PASSPHRASE 未設定'); process.exit(1); }
  const files = readdirSync(ROOT).filter((f) => f.toLowerCase().endsWith('.xlsx'));

  // (test, cat) ごとに候補を集約
  const cands = new Map<string, Cand[]>(); // key: `${test}/${cat}`
  const sourcesSeen = new Set<string>();
  for (const src of SOURCES) {
    if (ONLY && src.test !== ONLY) continue;
    const file = files.find(src.match);
    if (!file) { console.error(`⚠ ソース未検出: ${src.label}`); continue; }
    sourcesSeen.add(src.label);
    const wb = readWorkbook(path.join(ROOT, file));
    for (const spec of src.sheets) {
      const ws = wb.Sheets[spec.sheet];
      if (!ws) { console.error(`⚠ シート未検出: ${spec.sheet} (${src.label})`); continue; }
      const k = `${src.test}/${spec.cat}`;
      const cs = parseSheetSpec(sheetRows(ws), spec, src.label);
      cands.set(k, [...(cands.get(k) ?? []), ...cs]);
    }
  }

  console.log(`対象ソース: ${[...sourcesSeen].join(', ') || '(なし)'}\n`);
  for (const [k, cs] of [...cands.entries()].sort()) {
    const [test, cat] = k.split('/');
    const encPath = path.join(ROOT, 'public', 'data', test, `${cat}.enc.json`);
    if (!existsSync(encPath)) { console.error(`⚠ 既存データ無し: ${encPath}`); continue; }
    const baseline = await decryptJson<Item[]>(JSON.parse(readFileSync(encPath, 'utf8')) as EncBlob, pw);
    const suppMerged = mergeCands(cs);
    const { items, stats } = mergeIntoBaseline(baseline, suppMerged);
    console.log(
      `■ ${test}/${cat}: 既存${stats.baseline} +補助${cs.length}(名寄せ${suppMerged.length}) ` +
      `→ 穴埋め${stats.filled} 一致${stats.agreed} 不一致${stats.conflict} 追記${stats.appended} = 計${stats.total}`,
    );
    if (DRY && process.argv.includes('--samples') && suppMerged.length) {
      const pick = [suppMerged[0], suppMerged[Math.floor(suppMerged.length / 2)], suppMerged[suppMerged.length - 1]];
      for (const m of pick) {
        const q = m.q.length > 50 ? m.q.slice(0, 50) + '…' : m.q;
        console.log(`     ・${q} → ${m.a || '(空)'}`);
      }
    }
    if (!DRY) {
      const blob = await encryptJson(items, pw);
      writeFileSync(encPath, JSON.stringify(blob));
    }
  }
  console.log(DRY ? '\n--dry: 書き込みなし' : '\n✅ マージ完了・再暗号化');
}

main().catch((e) => { console.error(e); process.exit(1); });
