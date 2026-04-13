/**
 * Uploads 業界研究.md files from a local "就活" folder into Firestore at
 * /industryResearch/{industryName}.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   npm run upload:industry -- --dry-run
 *   npm run upload:industry
 */

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_SOURCE = path.join(os.homedir(), 'Desktop', '就活');
const SOURCE_ROOT = process.env.SOURCE_ROOT ?? DEFAULT_SOURCE;
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const DRY_RUN = process.argv.includes('--dry-run');

const IGNORED_TOP = new Set([
  '_テンプレート',
  '自己分析',
  '練習',
  'エントリーシート',
  '.git',
  '.claude',
]);

if (!SERVICE_ACCOUNT_PATH) {
  console.error(
    '[upload:industry] GOOGLE_APPLICATION_CREDENTIALS env var is required.',
  );
  process.exit(1);
}

initializeApp({ credential: cert(path.resolve(SERVICE_ACCOUNT_PATH)) });
const db = getFirestore();

async function main(): Promise<void> {
  console.log(`[upload:industry] source: ${SOURCE_ROOT}`);
  console.log(`[upload:industry] dry-run: ${DRY_RUN}`);
  console.log('');

  const rootStat = await stat(SOURCE_ROOT).catch(() => null);
  if (!rootStat || !rootStat.isDirectory()) {
    console.error(`[upload:industry] source root not found: ${SOURCE_ROOT}`);
    process.exit(1);
  }

  let uploaded = 0;
  let skipped = 0;

  const topEntries = await readdir(SOURCE_ROOT);
  for (const industry of topEntries) {
    if (IGNORED_TOP.has(industry) || industry.startsWith('.')) continue;
    const industryPath = path.join(SOURCE_ROOT, industry);
    const industryStat = await stat(industryPath).catch(() => null);
    if (!industryStat || !industryStat.isDirectory()) continue;

    const researchPath = path.join(industryPath, '業界研究.md');
    let content: string;
    try {
      content = await readFile(researchPath, 'utf8');
    } catch {
      console.log(`[skip] ${industry} — 業界研究.md not found`);
      skipped += 1;
      continue;
    }

    if (!content.trim()) {
      console.log(`[skip] ${industry} — 業界研究.md is empty`);
      skipped += 1;
      continue;
    }

    const bytes = Buffer.byteLength(content, 'utf8');
    const tag = DRY_RUN ? '[DRY]' : '[PUT]';
    console.log(
      `${tag} ${industry.padEnd(30)} ${bytes.toLocaleString()} bytes`,
    );

    if (!DRY_RUN) {
      await db.collection('industryResearch').doc(industry).set({
        content,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    uploaded += 1;
  }

  console.log('');
  console.log('[upload:industry] ── summary ───────────────────────');
  console.log(`  ${DRY_RUN ? 'would upload' : 'uploaded'}: ${uploaded} industries`);
  console.log(`  skipped: ${skipped}`);
  if (DRY_RUN) {
    console.log('[upload:industry] DRY RUN — no data written.');
  } else {
    console.log('[upload:industry] done.');
  }
}

main().catch((e) => {
  console.error('[upload:industry] FAILED:', e);
  process.exit(1);
});
