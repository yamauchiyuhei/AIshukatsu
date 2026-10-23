/**
 * SPI / 玉手箱 / GAB / WEBテスティング / テストセンター の解答データを
 * Excel から読み、TG-WEB と同じ TGWEB_PASSPHRASE で AES-GCM 暗号化した
 * JSON を public/data/{testType}/*.enc.json に出力する。
 *
 * Usage:
 *   .env.local に TGWEB_PASSPHRASE=<TG-WEB と同じパス>
 *   npm run generate:webtest-others
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function loadEnvFile(p: string) {
  if (!existsSync(p)) return;
  for (const rawLine of readFileSync(p, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(path.join(ROOT, '.env.local'));

interface TestSpec {
  testKey: string;
  xlsx: string;
  categories: ReadonlyArray<{ sheet: string; file: string }>;
}

const TESTS: ReadonlyArray<TestSpec> = [
  {
    testKey: 'spi',
    xlsx: 'SPI（正解確定版）のコピー.xlsx',
    categories: [
      { sheet: '言語_採用', file: 'gengo.enc.json' },
      { sheet: '非言語_採用', file: 'higengo.enc.json' },
      { sheet: '英語_採用', file: 'eigo.enc.json' },
    ],
  },
  {
    testKey: 'tamatebako',
    xlsx: '玉手箱（正解確定版）のコピー.xlsx',
    categories: [
      { sheet: '言語_採用', file: 'gengo.enc.json' },
      { sheet: '言語_不一致_採用', file: 'gengo_fuitchi.enc.json' },
      { sheet: '非言語_図表読取_採用', file: 'higengo_zuhyou.enc.json' },
      { sheet: '非言語_空欄推測_採用', file: 'higengo_kuuran.enc.json' },
      { sheet: '非言語_混合_採用', file: 'higengo_kongou.enc.json' },
      { sheet: '非言語_不一致_採用', file: 'higengo_fuitchi.enc.json' },
      { sheet: '英語_採用', file: 'eigo.enc.json' },
      { sheet: '新型_採用', file: 'shingata.enc.json' },
    ],
  },
  {
    testKey: 'gab',
    xlsx: 'GAB（正解確定版）のコピー.xlsx',
    categories: [
      { sheet: '言語_採用', file: 'gengo.enc.json' },
      { sheet: '非言語_採用', file: 'higengo.enc.json' },
      { sheet: '英語_採用', file: 'eigo.enc.json' },
    ],
  },
  {
    testKey: 'cgab',
    xlsx: 'C-GAB（正解確定版）.xlsx',
    categories: [
      { sheet: '言語_採用', file: 'gengo.enc.json' },
      { sheet: '計数_採用', file: 'keisuu.enc.json' },
      { sheet: '英語_採用', file: 'eigo.enc.json' },
    ],
  },
  {
    testKey: 'webtesting',
    xlsx: 'WEBテスティング（正解確定版）のコピー.xlsx',
    categories: [
      { sheet: '言語_採用', file: 'gengo.enc.json' },
      { sheet: '非言語_採用', file: 'higengo.enc.json' },
      { sheet: '英語_採用', file: 'eigo.enc.json' },
    ],
  },
  {
    testKey: 'testcenter',
    xlsx: 'テストセンター（正解確定版）のコピー.xlsx',
    categories: [
      { sheet: '言語_採用', file: 'gengo.enc.json' },
      { sheet: '非言語_採用', file: 'higengo.enc.json' },
      { sheet: '英語_採用', file: 'eigo.enc.json' },
    ],
  },
];

type Rank = 'A' | 'B' | 'C' | 'D' | 'N';
interface Item {
  id: number;
  q: string;
  a: string;
  rank: Rank;
  verify: boolean;
}

const RANK_SET = new Set(['A', 'B', 'C', 'D', 'N']);

function parseSheet(wb: XLSX.WorkBook, sheetName: string): Item[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`シートが見つかりません: ${sheetName}`);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
  });
  const items: Item[] = [];
  for (const row of rows) {
    const idRaw = row['No.'];
    const id = Number(idRaw);
    const q = String(row['問題文'] ?? '').trim();
    if (!Number.isFinite(id) || !q) continue;
    const aRaw = row['採用解答'];
    const a = aRaw == null ? '' : String(aRaw).trim();
    const rankStr = String(row['ランク'] ?? 'N').trim().toUpperCase();
    const rank: Rank = RANK_SET.has(rankStr) ? (rankStr as Rank) : 'N';
    const verify = row['要検証'] != null && String(row['要検証']).trim() !== '';
    items.push({ id, q, a, rank, verify });
  }
  return items;
}

const PBKDF2_ITER = 200_000;
const SALT_LEN = 16;
const IV_LEN = 12;

function b64(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Buffer.from(u8).toString('base64');
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
}

async function encryptJson(data: unknown, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const pt = new TextEncoder().encode(JSON.stringify(data));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt);
  return { v: 1 as const, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

async function processTest(spec: TestSpec, password: string): Promise<number> {
  const xlsxPath = path.join(ROOT, spec.xlsx);
  if (!existsSync(xlsxPath)) {
    console.error(`⚠ skip: Excel が見つかりません — ${spec.xlsx}`);
    return 0;
  }
  const outDir = path.join(ROOT, 'public', 'data', spec.testKey);
  await mkdir(outDir, { recursive: true });

  const buf = await readFile(xlsxPath);
  const wb = XLSX.read(buf, { type: 'buffer' });

  let total = 0;
  console.log(`\n▶ ${spec.testKey} (${spec.xlsx})`);
  for (const cat of spec.categories) {
    const items = parseSheet(wb, cat.sheet);
    const enc = await encryptJson(items, password);
    const outPath = path.join(outDir, cat.file);
    await writeFile(outPath, JSON.stringify(enc));
    console.log(
      `  ✔ ${cat.sheet.padEnd(22)} ${String(items.length).padStart(5)} 件 → ${path.relative(ROOT, outPath)}`,
    );
    total += items.length;
  }
  return total;
}

async function main() {
  const password = process.env.TGWEB_PASSPHRASE;
  if (!password) {
    console.error('❌ .env.local の TGWEB_PASSPHRASE が未設定です');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('❌ TGWEB_PASSPHRASE が短すぎます（6文字以上推奨）');
    process.exit(1);
  }

  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : null;
  const tests = only ? TESTS.filter((t) => t.testKey === only) : TESTS;
  if (only && tests.length === 0) {
    console.error(`❌ --only ${only}: 該当するテストがありません`);
    process.exit(1);
  }

  let grand = 0;
  for (const spec of tests) {
    grand += await processTest(spec, password);
  }
  console.log(`\n✅ 完了（全 ${grand} 件）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
