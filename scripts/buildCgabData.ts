/**
 * C-GAB の各種「解答集」xlsx を読み、アプリのパイプライン形式
 * （No. / 問題文 / 採用解答 / ランク / 要検証）に正規化・名寄せ統合し、
 * C-GAB（正解確定版）.xlsx を生成する（新テスト C-GAB の原本）。
 *
 * カテゴリ: 言語 / 計数 / 英語  （C-GAB の「非言語」= 計数 として扱う）
 * 解析エンジン・名寄せロジックは scripts/lib/webtestParse.ts を共用。
 *
 * Usage:
 *   npx tsx scripts/buildCgabData.ts --dry   # 抽出・統合結果を表示のみ
 *   npx tsx scripts/buildCgabData.ts          # C-GAB（正解確定版）.xlsx を生成
 */
import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import {
  type SheetSpec, type Cand, type Merged,
  readWorkbook, sheetRows, parseSheetSpec, mergeCands,
} from './lib/webtestParse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');

type Cat = 'gengo' | 'keisuu' | 'eigo';
const CAT_LABEL: Record<Cat, string> = { gengo: '言語', keisuu: '計数', eigo: '英語' };

type CatSheet = SheetSpec & { cat: Cat };
interface SrcFile { label: string; match: (f: string) => boolean; sheets: CatSheet[] }

const V_G = [6, 7, 8, 9, 10, 11, 12]; // cgab26 言語の投票列
const V_K = [6, 7, 8, 9, 10]; //          計数
const V_E = [5, 6, 7, 8, 9, 10]; //        英語

const SOURCES: SrcFile[] = [
  {
    label: '（新）C-GAB',
    match: (f) => f.includes('新') && /c.?gab/i.test(f) && f.includes('2025'),
    sheets: [
      { cat: 'gengo', sheet: '言語', type: 'passage', cfg: { theme: 0, q: 1, a: 4, seqCol: 5, confirmCol: 3, hasHeader: true } },
      { cat: 'keisuu', sheet: '非言語', type: 'flat', cfg: { q: 0, a: 2, a2: 3, hasHeader: true } },
      { cat: 'eigo', sheet: '英語', type: 'passage', cfg: { theme: 0, q: 1, a: 5, a2: 4, confirmCol: 3, hasHeader: true } },
    ],
  },
  {
    label: 'まさき',
    match: (f) => f.includes('まさき'),
    sheets: [
      { cat: 'keisuu', sheet: '非言語', type: 'flat', cfg: { q: 0, a: 1, hasHeader: false } },
      { cat: 'gengo', sheet: '言語', type: 'passage', cfg: { theme: 0, q: 1, a: 2, hasHeader: false } },
      { cat: 'eigo', sheet: '英語', type: 'passage', cfg: { theme: 0, q: 1, a: 2, hasHeader: false } },
      { cat: 'eigo', sheet: '英語 (2)', type: 'passage', cfg: { theme: 0, q: 1, a: 2, hasHeader: true } },
      // 「言語 (2)」は設問文が無く解答記号のみ → 検索不可のためスキップ
    ],
  },
  {
    label: '【言語9割】',
    match: (f) => f.includes('9割'),
    sheets: [
      { cat: 'gengo', sheet: 'c-gab 言語', type: 'passage', cfg: { theme: 0, q: 2, a: 1, hasHeader: false } },
      { cat: 'keisuu', sheet: 'C-GAB 非言語', type: 'flat', cfg: { q: 0, a: 1, hasHeader: true } },
      { cat: 'keisuu', sheet: 'C-GAB 計数', type: 'flat', cfg: { q: 0, a: 1, hasHeader: true } },
      { cat: 'eigo', sheet: 'C-GAB 英語　', type: 'passage', cfg: { theme: 0, q: 1, a: 2, confirmCol: 3, hasHeader: true } },
    ],
  },
  {
    label: 'cgab26',
    match: (f) => /cgab26/i.test(f) && !f.includes('(1)'),
    sheets: [
      { cat: 'gengo', sheet: '言語', type: 'seq', cfg: { q: 0, a: 1, voters: V_G, hasHeader: true } },
      { cat: 'keisuu', sheet: '計数', type: 'flat', cfg: { q: 0, a: 1, voters: V_K, hasHeader: true } },
      { cat: 'eigo', sheet: '英語', type: 'passage', cfg: { theme: 0, q: 1, a: 2, voters: V_E, hasHeader: true } },
    ],
  },
  {
    label: 'cgab26(1)',
    match: (f) => /cgab26/i.test(f) && f.includes('(1)'),
    sheets: [
      { cat: 'gengo', sheet: '言語', type: 'seq', cfg: { q: 0, a: 1, voters: V_G, hasHeader: true } },
      { cat: 'keisuu', sheet: '計数', type: 'flat', cfg: { q: 0, a: 1, voters: V_K, hasHeader: true } },
      { cat: 'eigo', sheet: '英語', type: 'passage', cfg: { theme: 0, q: 1, a: 2, voters: V_E, hasHeader: true } },
    ],
  },
];

function main() {
  const files = readdirSync(ROOT).filter((f) => f.toLowerCase().endsWith('.xlsx'));
  const rawByCat: Record<Cat, Cand[]> = { gengo: [], keisuu: [], eigo: [] };
  const contrib: Record<string, number> = {};

  for (const src of SOURCES) {
    const file = files.find(src.match);
    if (!file) { console.error(`⚠ ソース未検出: ${src.label}`); continue; }
    const wb = readWorkbook(path.join(ROOT, file));
    for (const spec of src.sheets) {
      const ws = wb.Sheets[spec.sheet];
      if (!ws) { console.error(`⚠ シート未検出: ${spec.sheet} (${src.label})`); continue; }
      const cands = parseSheetSpec(sheetRows(ws), spec, src.label);
      rawByCat[spec.cat].push(...cands);
      contrib[`${src.label}/${spec.sheet}→${CAT_LABEL[spec.cat]}`] = cands.length;
    }
  }

  console.log('── ソース別抽出件数 ──');
  for (const [k, v] of Object.entries(contrib)) console.log(`  ${k}: ${v}`);

  const mergedByCat: Record<Cat, Merged[]> = {
    gengo: mergeCands(rawByCat.gengo),
    keisuu: mergeCands(rawByCat.keisuu),
    eigo: mergeCands(rawByCat.eigo),
  };

  console.log('\n── 名寄せ後 ──');
  let grand = 0;
  for (const cat of Object.keys(mergedByCat) as Cat[]) {
    const its = mergedByCat[cat];
    const raw = rawByCat[cat].length;
    const answered = its.filter((i) => i.a).length;
    const verify = its.filter((i) => i.verify).length;
    const rank: Record<string, number> = {};
    for (const i of its) rank[i.rank] = (rank[i.rank] || 0) + 1;
    grand += its.length;
    console.log(`\n══ ${CAT_LABEL[cat]} ══ 生${raw} → 統合${its.length}件 (重複${raw - its.length}) / 解答済${answered} / 要検証${verify} / ${JSON.stringify(rank)}`);
    for (const it of its.slice(0, 6)) {
      const q = it.q.length > 44 ? it.q.slice(0, 44) + '…' : it.q;
      console.log(`  [${it.rank}]${it.verify ? '⚠' : ' '}(${it.sources}src) ${q} → ${it.a || '(空)'}`);
    }
  }
  console.log(`\n全カテゴリ合計: ${grand}件`);

  if (DRY) { console.log('\n--dry: ファイル未書き込み'); return; }

  const wb = XLSX.utils.book_new();
  for (const cat of Object.keys(mergedByCat) as Cat[]) {
    const aoa: string[][] = [['No.', '問題文', '採用解答', 'ランク', '要検証']];
    mergedByCat[cat].forEach((it, i) =>
      aoa.push([String(i + 1), it.q, it.a, it.rank, it.verify ? '要' : '']),
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), `${CAT_LABEL[cat]}_採用`);
  }
  const out = path.join(ROOT, 'C-GAB（正解確定版）.xlsx');
  writeFileSync(out, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  console.log(`\n✅ 出力: ${path.relative(ROOT, out)}`);
}

main();
