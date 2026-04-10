/**
 * Bulk classifier: builds `src/data/companyToIndustry.json` — a flat
 * `{ "企業名": "業界" }` map covering every company in
 * `src/data/companyMaster.json` (≈ 2,434 entries).
 *
 * Strategy:
 *   1. Start from `src/data/industryCompanies.json` (316 manually curated
 *      entries) as ground truth. Cross-industry duplicates are resolved
 *      via the hand-picked `MANUAL_OVERRIDES` table below.
 *   2. For every company in `companyMaster.json` that is NOT already in
 *      that ground-truth set, ask Gemini 2.5 Flash to classify it into
 *      exactly one of the 12 canonical industries.
 *   3. Gemini is called in batches of BATCH_SIZE companies with a strict
 *      JSON response schema, so one request classifies many companies.
 *   4. Write the merged result (curated + LLM) to
 *      `src/data/companyToIndustry.json`, sorted alphabetically by company
 *      name for stable diffs.
 *
 * Usage:
 *   export GEMINI_API_KEY=...
 *   npx tsx scripts/generateCompanyIndustryMap.ts              # full run
 *   npx tsx scripts/generateCompanyIndustryMap.ts --limit 50   # smoke test
 *   npx tsx scripts/generateCompanyIndustryMap.ts --dry-run    # no file write
 *
 * The produced JSON is a *static data file* committed to the repo. The
 * app reads it at build time via `src/lib/companyIndustryMap.ts`. No
 * Firestore, no runtime LLM calls.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import industryCompanies from '../src/data/industryCompanies.json';
import companyMaster from '../src/data/companyMaster.json';

// ── Config ────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-flash';
const BATCH_SIZE = 25;
const SLEEP_MS = 1500;

if (!GEMINI_API_KEY) {
  console.error('[classify] GEMINI_API_KEY env var is required.');
  process.exit(1);
}

const INDUSTRIES = [
  'IT・ソフトウェア',
  '通信',
  'メーカー',
  '商社',
  '金融',
  'コンサル',
  '広告・マスコミ',
  '不動産・建設',
  '小売・サービス',
  '物流',
  'インフラ',
  'その他',
] as const;
type Industry = (typeof INDUSTRIES)[number];

// ── Ground truth: hand-resolve the 9 cross-industry duplicates in ─────────
// industryCompanies.json. Keyed exactly as they appear in the source.
const MANUAL_OVERRIDES: Record<string, Industry> = {
  野村総合研究所: 'コンサル',
  サイバーエージェント: 'IT・ソフトウェア',
  オープンハウスグループ: '不動産・建設',
  ZOZO: '小売・サービス',
  リクルート: '小売・サービス',
  JR東日本: 'インフラ',
  日本銀行: '金融',
  日本政策投資銀行: '金融',
  国際協力銀行: '金融',
};

// ── CLI ───────────────────────────────────────────────────────────────────
interface Args {
  limit?: number;
  dryRun: boolean;
}
function parseArgs(argv: string[]): Args {
  const a: Args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--limit') a.limit = Number(argv[++i]);
    else if (argv[i] === '--dry-run') a.dryRun = true;
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));

// ── Ground truth map ──────────────────────────────────────────────────────
function buildGroundTruth(): Map<string, Industry> {
  const map = new Map<string, Industry>();
  const raw = industryCompanies as Record<string, string[]>;
  for (const [industry, companies] of Object.entries(raw)) {
    if (!INDUSTRIES.includes(industry as Industry)) {
      throw new Error(`Unknown industry in industryCompanies.json: ${industry}`);
    }
    for (const name of companies) {
      if (name in MANUAL_OVERRIDES) {
        map.set(name, MANUAL_OVERRIDES[name]);
      } else if (!map.has(name)) {
        map.set(name, industry as Industry);
      }
      // If already in the map from an earlier industry key and no manual
      // override exists, keep the first one encountered — the MANUAL_OVERRIDES
      // table is expected to cover every actually-ambiguous case.
    }
  }
  return map;
}

// ── Gemini ────────────────────────────────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const SYSTEM_PROMPT = `あなたは日本の就活生向けの業界分類アシスタントです。
渡された日本企業の名前リストを、次の 12 業界のうち **ちょうど 1 つ** に分類してください。

【業界リスト】
- IT・ソフトウェア: SaaS、Web サービス、ゲーム、スマホアプリ、システム開発、SIer、インターネット広告以外の IT 事業会社
- 通信: キャリア、ISP、通信インフラ事業者
- メーカー: 自動車、電機、機械、化学、食品、製薬、素材などの製造業
- 商社: 総合商社、専門商社
- 金融: 銀行、証券、保険、資産運用、クレジットカード、リース
- コンサル: 経営・戦略・IT・シンクタンク系コンサルティングファーム
- 広告・マスコミ: 広告代理店、新聞、テレビ、出版、エンタメ・メディア
- 不動産・建設: デベロッパー、ゼネコン、住宅、不動産サービス
- 小売・サービス: 小売、EC、外食、人材、旅行、教育、ホテル、BtoC サービス全般
- 物流: 陸運、海運、空運、倉庫、宅配、輸送
- インフラ: 電力、ガス、鉄道、道路、空港、水道、石油元売り
- その他: 上記いずれにも当てはまらない企業（医療法人、公的機関、業界不明 等）

【ルール】
1. 必ず上記 12 個のいずれかを使う。新しい業界名を作らない。
2. 複数の事業を持つ企業は、**最も主業種と考えられるもの**を 1 つ選ぶ。
3. 自信がない／知らない企業も、社名から推測して 12 個のどれかに入れる。本当に手がかりがない場合のみ「その他」にする。
4. 入力と同じ順序・件数で、入力の社名をキーとするオブジェクトを返す。
`;

interface ClassifyResult {
  [companyName: string]: Industry;
}

async function classifyBatch(names: string[]): Promise<ClassifyResult> {
  const prompt = `次の企業を分類してください。\n\n${names
    .map((n, i) => `${i + 1}. ${n}`)
    .join('\n')}`;

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            industry: {
              type: Type.STRING,
              enum: INDUSTRIES as unknown as string[],
            },
          },
          required: ['name', 'industry'],
        },
      },
    },
  });

  const text = res.text;
  if (!text) throw new Error('empty response');
  const parsed = JSON.parse(text) as Array<{ name: string; industry: Industry }>;

  const out: ClassifyResult = {};
  for (const row of parsed) {
    if (!INDUSTRIES.includes(row.industry)) {
      console.warn(`  [warn] unknown industry "${row.industry}" for ${row.name} → その他`);
      out[row.name] = 'その他';
    } else {
      out[row.name] = row.industry;
    }
  }
  // Fill any missing entries (LLM sometimes drops items on long lists)
  for (const n of names) {
    if (!(n in out)) {
      console.warn(`  [warn] missing classification for ${n} → その他`);
      out[n] = 'その他';
    }
  }
  return out;
}

const MAX_ATTEMPTS = 6;
async function classifyWithRetry(names: string[], attempt = 1): Promise<ClassifyResult> {
  try {
    return await classifyBatch(names);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (attempt >= MAX_ATTEMPTS)
      throw new Error(`classifyBatch failed after ${attempt} tries: ${msg}`);
    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
    const wait = 2000 * 2 ** (attempt - 1);
    console.warn(
      `  [retry ${attempt}/${MAX_ATTEMPTS - 1}] ${msg.slice(0, 120)} — sleeping ${wait}ms`,
    );
    await new Promise((r) => setTimeout(r, wait));
    return classifyWithRetry(names, attempt + 1);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const groundTruth = buildGroundTruth();
  console.log(`[classify] ground truth: ${groundTruth.size} companies`);
  console.log(`[classify] companyMaster: ${(companyMaster as string[]).length} companies`);

  const master = companyMaster as string[];
  const missing = master.filter((c) => !groundTruth.has(c));
  console.log(`[classify] to classify via LLM: ${missing.length} companies`);

  const toProcess = args.limit ? missing.slice(0, args.limit) : missing;
  console.log(`[classify] processing: ${toProcess.length} (limit=${args.limit ?? 'none'})`);
  console.log(`[classify] model: ${MODEL}, batch size: ${BATCH_SIZE}`);
  console.log('');

  const llmResults: ClassifyResult = {};
  const batches = Math.ceil(toProcess.length / BATCH_SIZE);
  for (let b = 0; b < batches; b++) {
    const batch = toProcess.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    process.stdout.write(
      `(${b + 1}/${batches}) batch of ${batch.length} [${batch[0]} … ${batch[batch.length - 1]}] `,
    );
    const r = await classifyWithRetry(batch);
    Object.assign(llmResults, r);
    const counts: Record<string, number> = {};
    for (const v of Object.values(r)) counts[v] = (counts[v] || 0) + 1;
    const summary = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${v}`)
      .join(' ');
    console.log(`→ ${summary}`);
    if (b < batches - 1) await sleep(SLEEP_MS);
  }

  // Merge ground truth + LLM results
  const merged: Record<string, string> = {};
  for (const [k, v] of groundTruth) merged[k] = v;
  for (const [k, v] of Object.entries(llmResults)) merged[k] = v;

  // Sort alphabetically for stable diffs
  const sortedKeys = Object.keys(merged).sort((a, b) => a.localeCompare(b, 'ja'));
  const sorted: Record<string, string> = {};
  for (const k of sortedKeys) sorted[k] = merged[k];

  // Stats
  const dist: Record<string, number> = {};
  for (const v of Object.values(sorted)) dist[v] = (dist[v] || 0) + 1;
  console.log('');
  console.log(`[classify] final entries: ${Object.keys(sorted).length}`);
  console.log(`[classify] distribution:`);
  for (const ind of INDUSTRIES) {
    console.log(`  ${ind.padEnd(12, '　')}: ${dist[ind] || 0}`);
  }

  if (args.dryRun) {
    console.log('');
    console.log('[classify] --dry-run: skipping file write');
    // Show a sample
    const sample = sortedKeys.slice(0, 10);
    console.log('[classify] sample:');
    for (const k of sample) console.log(`  ${k}: ${sorted[k]}`);
    return;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outPath = path.resolve(__dirname, '../src/data/companyToIndustry.json');
  await writeFile(outPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  console.log('');
  console.log(`[classify] wrote ${outPath}`);
}

main().catch((e) => {
  console.error('[classify] fatal:', e);
  process.exit(1);
});
