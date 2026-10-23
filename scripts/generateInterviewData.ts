/**
 * 面接Q&A Markdown → 暗号化JSON変換スクリプト
 *
 * 入力: ~/Desktop/就活/面接対策/マッキンゼー/マッキンゼー.md
 * 出力: public/data/interview/mckinsey.enc.json  (AES-GCM暗号化済み)
 *
 * Usage:
 *   .env.local に MCKINSEY_PASSPHRASE=<任意のパス> を追加
 *   npm run generate:interview
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

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

const SRC_MD = path.join(
  os.homedir(),
  'Desktop',
  '就活',
  '面接対策',
  'マッキンゼー',
  'マッキンゼー.md',
);
const OUT_PATH = path.join(ROOT, 'public', 'data', 'interview', 'mckinsey.enc.json');

interface Question {
  id: string;          // "Q0", "Q1", ...
  category: string | null; // "Personal Impact", etc. or null
  title: string;       // heading without Q number/category
  html: string;        // rendered body HTML
}

/** Parse the full markdown and split into questions. */
function parseQuestions(md: string): Question[] {
  const lines = md.split('\n');
  const questions: Question[] = [];

  // Find all H2 headings matching `## QN. ...`
  const headingRe = /^## (Q\d+)\.\s*(?:（([^）]+)）)?\s*(.*)$/;

  type Marker = { idx: number; id: string; category: string | null; title: string };
  const markers: Marker[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (m) {
      markers.push({
        idx: i,
        id: m[1],
        category: m[2] ?? null,
        title: m[3].trim(),
      });
    }
  }

  for (let k = 0; k < markers.length; k++) {
    const cur = markers[k];
    const next = markers[k + 1];
    const startLine = cur.idx + 1;
    const endLine = next ? next.idx : lines.length;
    let body = lines.slice(startLine, endLine).join('\n');

    // Trim leading/trailing horizontal rules and whitespace.
    body = body.replace(/^\s*(?:\*\*\*|---)\s*\n/m, '');
    body = body.replace(/\n\s*(?:\*\*\*|---)\s*$/m, '');
    body = body.trim();

    const html = marked.parse(body, { async: false }) as string;
    questions.push({
      id: cur.id,
      category: cur.category,
      title: cur.title,
      html,
    });
  }
  return questions;
}

// ── Crypto (Web Crypto API, Node 18+) ──
type U8 = Uint8Array<ArrayBuffer>;
const PBKDF2_ITER = 200_000;
const SALT_LEN = 16;
const IV_LEN = 12;

function newU8(len: number): U8 {
  return new Uint8Array(new ArrayBuffer(len)) as U8;
}
function randomU8(len: number): U8 {
  return crypto.getRandomValues(newU8(len));
}
function b64(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Buffer.from(u8).toString('base64');
}

async function deriveKey(password: string, salt: U8): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(password);
  const pw = newU8(enc.length);
  pw.set(enc);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    pw,
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
  const salt = randomU8(SALT_LEN);
  const iv = randomU8(IV_LEN);
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder().encode(JSON.stringify(data));
  const pt = newU8(enc.length);
  pt.set(enc);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt);
  return { v: 1 as const, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

async function main() {
  const password = process.env.MCKINSEY_PASSPHRASE;
  if (!password) {
    console.error('❌ .env.local の MCKINSEY_PASSPHRASE が未設定です');
    process.exit(1);
  }
  if (!existsSync(SRC_MD)) {
    console.error(`❌ 原本ファイルが見つかりません: ${SRC_MD}`);
    process.exit(1);
  }

  const md = await readFile(SRC_MD, 'utf8');
  const questions = parseQuestions(md);
  if (questions.length === 0) {
    console.error('❌ 問題を1つも解析できませんでした。見出しフォーマットを確認してください。');
    process.exit(1);
  }

  const enc = await encryptJson(questions, password);
  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(enc));

  console.log(`✔ ${questions.length} 問を暗号化\n`);
  for (const q of questions) {
    const cat = q.category ? ` (${q.category})` : '';
    const title = q.title.length > 40 ? q.title.slice(0, 40) + '…' : q.title;
    console.log(`  ${q.id}${cat}  ${title}`);
  }
  console.log(`\n✅ 出力: ${path.relative(ROOT, OUT_PATH)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
