/**
 * Bulk generator: uses Gemini 2.5 Flash with Google Search grounding to
 * produce populated Markdown content for companies that are listed in
 * `src/data/industryCompanies.json` but have no entry yet in the Firestore
 * `/companyContent/{name}` collection. The output shape matches what
 * `scripts/uploadCompanyContent.ts` writes, so `writeCompanyFolder()` on
 * the client side picks it up with no code changes.
 *
 * Files generated per company:
 *   - 企業分析.md          (LLM-generated, grounded by Google Search)
 *   - ES・面接対策.md        (LLM-generated, grounded by Google Search)
 *   - インターン.md          (LLM-generated, grounded by Google Search)
 *   - 説明会・イベントメモ.md  (static empty template — users fill this in)
 *
 * Usage:
 *   export GEMINI_API_KEY=...
 *   export GOOGLE_APPLICATION_CREDENTIALS=~/.config/firebase/aisyuukatsu-admin.json
 *
 *   # Generate for one company, write locally, skip Firestore:
 *   npm run generate:content -- --company "サイボウズ" --dry-run --out ./tmp/generated
 *
 *   # Generate for one company and upload to Firestore:
 *   npm run generate:content -- --company "サイボウズ"
 *
 *   # Batch: generate for the first N missing companies (default: all 245):
 *   npm run generate:content -- --limit 5
 *   npm run generate:content
 *
 * Flags:
 *   --company <name>     Only generate for this one company name (doc ID).
 *   --limit <n>          Max companies to process in batch mode.
 *   --dry-run            Print + (optionally) write to --out, skip Firestore.
 *   --out <dir>          Local dir to write generated .md files into.
 *   --overwrite          Overwrite existing Firestore docs (default: skip).
 *   --sleep <ms>         Delay between companies to be nice to APIs (default 1500).
 */

import { GoogleGenAI } from '@google/genai';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import industryCompanies from '../src/data/industryCompanies.json';

// ── Config ────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const MODEL = 'gemini-2.5-flash';

if (!GEMINI_API_KEY) {
  console.error(
    '[generate] GEMINI_API_KEY env var is required.\n' +
      '   Get one at https://aistudio.google.com/app/apikey',
  );
  process.exit(1);
}

// ── CLI parsing ────────────────────────────────────────────────────────────
interface Args {
  company?: string;
  limit?: number;
  dryRun: boolean;
  out?: string;
  overwrite: boolean;
  sleepMs: number;
  concurrency: number;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { dryRun: false, overwrite: false, sleepMs: 0, concurrency: 5 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--company') a.company = argv[++i];
    else if (k === '--limit') a.limit = Number(argv[++i]);
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--overwrite') a.overwrite = true;
    else if (k === '--sleep') a.sleepMs = Number(argv[++i]);
    else if (k === '--concurrency') a.concurrency = Number(argv[++i]);
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));

// ── Firestore init (skip in pure dry-run without Firestore check) ─────────
let db: FirebaseFirestore.Firestore | null = null;
if (!SERVICE_ACCOUNT_PATH) {
  console.warn(
    '[generate] GOOGLE_APPLICATION_CREDENTIALS not set — running without Firestore.\n' +
      '   Will not skip existing docs and will not upload. Forcing --dry-run.',
  );
  args.dryRun = true;
} else {
  initializeApp({ credential: cert(path.resolve(SERVICE_ACCOUNT_PATH)) });
  db = getFirestore();
}

// ── Gemini client ──────────────────────────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ── Few-shot: DeNA (high quality reference) ───────────────────────────────
// Keep each file short enough to fit in context while showing the structure.
// These are trimmed excerpts, not the full files.
const FEWSHOT_COMPANY = 'DeNA';
const FEWSHOT_KIGYOU_BUNSEKI = `# 企業分析：DeNA

## 1. 企業概要

**「永久ベンチャー」を標榜し、ゲーム・スポーツ・ヘルスケア・AIと多角展開するメガベンチャー。**

株式会社ディー・エヌ・エー（DeNA）は1999年にネットオークションサービスから創業し、モバイルゲーム・スポーツ・ライブストリーミング・ヘルスケア・AIと事業領域を積極的に拡大してきたメガベンチャー企業。

| 項目       | 内容                              |
| -------- | ------------------------------- |
| 正式社名     | 株式会社ディー・エヌ・エー                   |
| 設立       | 1999年3月4日                       |
| 本社所在地    | 東京都渋谷区渋谷2-24-12 渋谷スクランブルスクエア    |
| 代表者      | 会長 南場智子 / 社長兼CEO 岡村信悟           |
| 従業員数（連結） | 2,572名（2025年3月末）                 |
| 上場市場     | 東証プライム                          |
| 証券コード    | 2432                            |

### ミッション・ビジョン・バリュー

- **ミッション**: 「一人ひとりに 想像を超えるDelightを」
- **ビジョン**: インターネットやAIを駆使し、エンタメと社会課題の両軸でDelightを提供
- **バリュー**: Delight / Surface of Sphere / Be the best we can be / Transparency & Honesty / Speak Up

---

## 2. 事業内容・セグメント構成

ゲーム事業が収益の柱だが、スポーツ・ライブ配信・ヘルスケア・AIと非ゲーム領域を積極拡大。

### 主要セグメント
| セグメント | 主要サービス | 特徴 |
|---|---|---|
| ゲーム | ポケポケ / ポケマス | 2024年にポケポケが世界1億DL突破 |
| スポーツ | 横浜DeNAベイスターズ | 2024年日本一 |
| ライブストリーミング | Pococha | 国内最大級のライブ配信 |
| ヘルスケア | kencom / 遺伝子検査 | データ活用型ヘルスケア |

---

## 3. 業績・財務ハイライト

- 2025年3月期 連結売上高: 約1,500億円 (要確認)
- ポケポケ大ヒットでV字回復
- 出典: DeNA 決算説明資料 (https://dena.com/jp/ir/)

---

## 4. 強み・競争優位性

1. **多角経営と事業ポートフォリオ転換力**: EC→ゲーム→スポーツ→AIと時代に合わせて主力を入れ替えてきた実績
2. **永久ベンチャーの組織文化**: 若手登用・新規事業提案制度「DeNA Delightventures」
3. **データ活用力**: 全事業で蓄積されたユーザーデータを横断的に活用

---

## 5. 課題・リスク

- ゲーム事業の収益ボラティリティ (ヒット作依存)
- 非ゲーム事業の収益化スピード
- AI人材の確保競争

---

## 6. 最近のトピック

- 2025年: 「AIオールイン」戦略を宣言、AI子会社「DeNA AI Link」設立
- 2024年10月: ポケポケ150ヶ国リリース → 1億DL突破
- 2024年: 横浜DeNAベイスターズ日本一

---

**参考情報源**
- DeNA コーポレートサイト: https://dena.com/jp/
- DeNA IR 情報: https://dena.com/jp/ir/
`;

const FEWSHOT_ES_MENSETSU = `# ES・面接対策：DeNA

---

## 求める人物像

### DeNAが求める2つの資質
1. **思考の独立性**: 常識や周囲に流されず、自分の頭で深く考え抜く力
2. **逃げずにやり抜く力**: 困難な状況でも粘り強く最後までやり切る姿勢

### DeNA Quality（全社員の行動規範）

| 項目 | 内容 |
|------|------|
| **Delight** | 顧客を第一に考え、期待を超える価値を提供 |
| **Surface of Sphere** | 高い基準と責任感を持つ |
| **Be the best we can be** | 組織・個人の成長に全力でコミット |
| **Transparency & Honesty** | 透明性・正直さを重視 |
| **Speak Up** | 年次・役職に関係なく自分の意見を発信 |

---

## 選考フロー（新卒）

1. エントリーシート提出
2. Web テスト (SPI / 玉手箱系)
3. 面接 (2〜4 回、職種により異なる)
4. 最終面接 (役員面接)
5. 内定

---

## ES 設問 (過去の例)

- **Q1**: あなたが「思考の独立性」を発揮した経験を教えてください (400字)
- **Q2**: DeNA でどんな Delight を生み出したいですか (400字)
- **Q3**: 困難な状況でやり抜いた経験 (400字)

### 書き方のコツ
- DeNA Quality のキーワード (Delight / Speak Up など) を自然に絡める
- 定量的な成果・数値を入れて具体性を出す
- 「自分で考えた」プロセスを言語化する

---

## 面接で聞かれること

- ガクチカ / 志望動機 / 逆質問が中心
- 「なぜ DeNA？」「なぜこの職種？」を深掘りされる
- ケース問題は少ないが、思考プロセスを問われる
- 「挑戦したこと」「失敗からの学び」は頻出

---

## 対策ポイント

- 公式の「南場智子メッセージ」「DeNA 行動規範」を読み込む
- 横浜DeNAベイスターズ・ポケポケ・AI戦略など**最新の動き**を語れるようにする
- 自分のガクチカと DeNA Quality を紐づけて 3 パターン用意

---

**参考情報源**
- DeNA 新卒採用サイト: https://dena.com/jp/recruit/new-graduate/
`;

const FEWSHOT_INTERN = `# インターン：DeNA

---

## コース概要

DeNAのインターンシップは職種別に複数プログラムが用意されている。

### エンジニア職インターン

| プログラム | 時期 | 期間 | 内容 |
|-----------|------|------|------|
| サマーインターン（短期） | 8月頃 | 数日間 | チーム開発課題 |
| 就業型インターン（長期） | 通年 | 数週間〜数ヶ月 | 実チームに配属 |

### ビジネス職インターン

| プログラム | 時期 | 期間 | 内容 |
|-----------|------|------|------|
| サマーインターン | 8〜9月 | 3〜5日間 | 事業立案グループワーク |
| 長期インターン | 通年 | 数ヶ月 | 実務参加 |

---

## 応募要件・選考フロー

1. エントリーシート提出
2. Web テスト
3. 面接 (1〜2 回)
4. インターン参加

---

## 参加メリット

- 本選考の優遇ルート (早期選考・一部ステップ免除) に招待されるケースあり
- 現場社員との交流で社風を肌で感じられる
- 実際のプロダクト課題に取り組める

---

## 対策ポイント

- エンジニア職: 競技プログラミングや個人開発のポートフォリオがあると強い
- ビジネス職: 事業立案の論理性・発想力を見られる
- 共通: DeNA Quality を自分の経験と結びつけて語れるようにする

---

**参考情報源**
- DeNA 新卒採用サイト: https://dena.com/jp/recruit/new-graduate/
`;

// ── Static template (説明会・イベントメモ.md) ────────────────────────────
// Even the populated DeNA version is just a form with blanks, so we use a
// deterministic template with the company name substituted. No LLM call.
function buildSetsumeikaiTemplate(company: string): string {
  return `# 説明会・イベントメモ：${company}

## 参加イベント一覧
| 日付 | イベント名 | 形式 | 参加済 |
|------|-----------|------|--------|
|      |           | 対面/オンライン | [ ] |

## イベントメモ

### 【日付】【イベント名】
- 登壇者・部署：
- 内容：
- 印象に残ったこと：
- 質問したこと：
- 今後のアクション：

---

## 社員との会話・OB訪問ログ

### 【日付】【氏名・役職】
- ポジション：
- 話題：
- 得られた情報：
- フィードバック：

---

## 企業イベント参加チェックリスト

- [ ] 会社説明会
- [ ] 部門別説明会
- [ ] 社員座談会
- [ ] OB・OG訪問
- [ ] インターン説明会
- [ ] 選考直結イベント
`;
}

// ── Prompt builders ────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `あなたは就職活動中の大学生を支援する企業分析のエキスパートです。
Google Search で最新の企業情報を調べて、指定された企業について高品質な日本語 Markdown を作成してください。

【絶対に守るルール】
1. 出力は Markdown のみ。前置き・後書き・コードブロック・「以下のとおりです」等の挨拶文は一切禁止。
2. **出力は必ず 6,000 文字以内**。参考例と同程度の長さを目安とする。
3. **検索結果の本文をそのままコピーしない**。自分の言葉で要約・構造化する。
4. **出典 URL は本文末尾の「参考情報源」セクションに最大 10 件まで**列挙する。本文中に URL を埋め込まない。
5. 数値・事実は可能な限り Google Search 結果に基づき、確証のない情報は「(要確認)」と明記する。
6. 企業の公式サイト・IR 資料・新卒採用サイトを優先情報源とする。
7. 表・箇条書き・見出しを活用して読みやすくする。
8. 見出し構造・セクション構成はユーザーが示す「参考例」に厳密に揃える。
9. 企業名は正確に記載する (略称と正式社名を使い分ける)。
`;

function buildPromptKigyouBunseki(company: string): string {
  return `以下の参考例と同じ構成・粒度で、企業「${company}」の「企業分析.md」を生成してください。
Google Search で最新情報を調べてから書いてください。

【参考例: ${FEWSHOT_COMPANY} の企業分析.md】
${FEWSHOT_KIGYOU_BUNSEKI}

【出力要件】
- 上記と同じセクション構成 (1. 企業概要 / 2. 事業内容 / 3. 業績 / 4. 強み / 5. 課題 / 6. 最近のトピック / 参考情報源)
- ${company} の実際の情報を Google Search で調べて記入
- 不確実な数値は「(要確認)」を付ける
- Markdown のみを出力。他の文字は一切含めない`;
}

function buildPromptEsMensetsu(company: string): string {
  return `以下の参考例と同じ構成・粒度で、企業「${company}」の「ES・面接対策.md」を生成してください。
Google Search で最新情報を調べてから書いてください。

【参考例: ${FEWSHOT_COMPANY} の ES・面接対策.md】
${FEWSHOT_ES_MENSETSU}

【出力要件】
- 上記と同じセクション構成 (求める人物像 / 選考フロー / ES 設問 / 面接で聞かれること / 対策ポイント / 参考情報源)
- ${company} の新卒採用情報を Google Search で調べる
- 選考フローや ES 設問が公開情報で見つからない場合は「(要確認)」「一般的な傾向として」などと明記
- Markdown のみを出力`;
}

function buildPromptIntern(company: string): string {
  return `以下の参考例と同じ構成・粒度で、企業「${company}」の「インターン.md」を生成してください。
Google Search で最新情報を調べてから書いてください。

【参考例: ${FEWSHOT_COMPANY} のインターン.md】
${FEWSHOT_INTERN}

【出力要件】
- 上記と同じセクション構成 (コース概要 / 応募要件・選考フロー / 参加メリット / 対策ポイント / 参考情報源)
- ${company} のインターンシップ情報を Google Search で調べる
- インターンを実施していない場合はその旨を明記し、本選考情報や OB 訪問のヒントを代わりに書く
- Markdown のみを出力`;
}

// ── Gemini call with Google Search grounding ───────────────────────────────
async function generateWithSearch(prompt: string): Promise<string> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ googleSearch: {} }],
      temperature: 0.4,
      // Hard cap: ~6,000 JP chars ≈ 8,000 tokens. Cuts off search-dump outputs
      // before they balloon to 100k+ tokens.
      maxOutputTokens: 8000,
    },
  });
  const text = res.text;
  if (!text || text.trim().length === 0) {
    throw new Error('Gemini returned empty text');
  }
  // Guard against abnormally large outputs (e.g. Gemini dumping raw search
  // results). Firestore has a 1MB document limit; sane output is <20KB.
  if (text.length > 50_000) {
    throw new Error(`Output too large (${text.length.toLocaleString()} chars) — likely search dump`);
  }
  return text.trim();
}

async function generateWithRetry(
  prompt: string,
  label: string,
  maxRetries = 2,
): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const out = await generateWithSearch(prompt);
      // Sanity: must contain a markdown heading
      if (!out.match(/^#\s+/m)) {
        throw new Error(`Output has no top-level heading (${label})`);
      }
      return out;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      // Search-dump outputs are deterministic for the same prompt — retrying
      // wastes quota. Fail fast.
      if (msg.startsWith('Output too large')) {
        throw e;
      }
      console.warn(`  [retry ${i + 1}/${maxRetries}] ${label}: ${msg}`);
      await sleep(2000 * (i + 1));
    }
  }
  throw lastErr;
}

// ── Per-company orchestration ──────────────────────────────────────────────
interface GeneratedFiles {
  '企業分析.md': string;
  'ES・面接対策.md': string;
  'インターン.md': string;
  '説明会・イベントメモ.md': string;
}

async function generateForCompany(company: string): Promise<GeneratedFiles> {
  // All three Gemini calls are independent — run in parallel (~3× faster).
  const [kigyou, es, intern] = await Promise.all([
    generateWithRetry(buildPromptKigyouBunseki(company), `${company}/企業分析`),
    generateWithRetry(buildPromptEsMensetsu(company), `${company}/ES・面接対策`),
    generateWithRetry(buildPromptIntern(company), `${company}/インターン`),
  ]);

  return {
    '企業分析.md': kigyou,
    'ES・面接対策.md': es,
    'インターン.md': intern,
    '説明会・イベントメモ.md': buildSetsumeikaiTemplate(company),
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // Resolve company list to process.
  const master = industryCompanies as Record<string, string[]>;
  const allNames = new Set<string>();
  for (const list of Object.values(master)) for (const n of list) allNames.add(n);

  let targets: string[];
  if (args.company) {
    targets = [args.company];
  } else {
    // Skip ones that already exist in Firestore (unless --overwrite).
    let existing = new Set<string>();
    if (db && !args.overwrite) {
      const docs = await db.collection('companyContent').listDocuments();
      existing = new Set(docs.map((d) => d.id));
    }
    targets = [...allNames].filter((n) => !existing.has(n));
    targets.sort((a, b) => a.localeCompare(b, 'ja'));
    if (args.limit) targets = targets.slice(0, args.limit);
  }

  console.log(`[generate] model:      ${MODEL}`);
  console.log(`[generate] targets:    ${targets.length} companies`);
  console.log(`[generate] dry-run:    ${args.dryRun}`);
  console.log(`[generate] out dir:    ${args.out ?? '(none)'}`);
  console.log(`[generate] overwrite:  ${args.overwrite}`);
  console.log('');

  if (args.out) {
    await mkdir(path.resolve(args.out), { recursive: true });
  }

  const stats = { ok: 0, failed: 0, totalBytes: 0 };
  const failures: Array<{ name: string; err: string }> = [];
  let completed = 0;

  console.log(`[generate] concurrency: ${args.concurrency}`);
  console.log('');

  // Simple semaphore: start next task as soon as any running one resolves.
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < targets.length) {
      const i = cursor++;
      const company = targets[i];
      try {
        const files = await generateForCompany(company);
        const bytes = Object.values(files).reduce(
          (acc, s) => acc + Buffer.byteLength(s, 'utf8'),
          0,
        );
        stats.totalBytes += bytes;

        if (args.out) {
          const dir = path.join(path.resolve(args.out), company);
          await mkdir(dir, { recursive: true });
          for (const [filename, content] of Object.entries(files)) {
            await writeFile(path.join(dir, filename), content, 'utf8');
          }
        }

        if (!args.dryRun && db) {
          await db
            .collection('companyContent')
            .doc(company)
            .set({
              version: 1,
              files,
              sourceName: company,
              generatedBy: MODEL,
              updatedAt: FieldValue.serverTimestamp(),
            });
        }

        stats.ok += 1;
        completed += 1;
        console.log(
          `(${completed}/${targets.length}) ✅ ${company} (${bytes.toLocaleString()} bytes)`,
        );
      } catch (e) {
        stats.failed += 1;
        completed += 1;
        const msg = e instanceof Error ? e.message : String(e);
        failures.push({ name: company, err: msg });
        console.error(`(${completed}/${targets.length}) ❌ ${company}: ${msg}`);
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, args.concurrency) }, () => worker());
  await Promise.all(workers);

  console.log('');
  console.log('[generate] ── summary ───────────────────────');
  console.log(`  ok:          ${stats.ok}`);
  console.log(`  failed:      ${stats.failed}`);
  console.log(
    `  total bytes: ${stats.totalBytes.toLocaleString()}  (~${(
      stats.totalBytes / 1024
    ).toFixed(1)} KB)`,
  );
  if (failures.length) {
    console.log('');
    console.log('  failures:');
    for (const f of failures) {
      console.log(`    - ${f.name}: ${f.err}`);
    }
  }
  console.log('');
  if (args.dryRun) {
    console.log('[generate] DRY RUN — nothing written to Firestore.');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error('[generate] FATAL:', e);
  process.exit(1);
});
