/**
 * One-off uploader: walks a local "就活" folder and pushes each company's
 * populated Markdown files into Firestore at /companyContent/{companyName}.
 *
 * Usage:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   npm run upload:content -- --dry-run        # list without writing
 *   npm run upload:content                     # actually write
 *   SOURCE_ROOT=/some/other/path npm run upload:content
 *
 * See scripts/README.md for how to obtain the service account JSON.
 */

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// ── Config ────────────────────────────────────────────────────────────────
const TARGET_FILES = [
  '企業分析.md',
  'ES・面接対策.md',
  'インターン.md',
  '説明会・イベントメモ.md',
] as const;

const DEFAULT_SOURCE = path.join(os.homedir(), 'Desktop', '就活');
const SOURCE_ROOT = process.env.SOURCE_ROOT ?? DEFAULT_SOURCE;

const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const DRY_RUN = process.argv.includes('--dry-run');

// Folders at the top level that are NOT industry folders (skip them).
const IGNORED_TOP = new Set([
  '_テンプレート',
  '自己分析',
  '練習',
  '.git',
  '.claude',
]);

// ── Init ──────────────────────────────────────────────────────────────────
if (!SERVICE_ACCOUNT_PATH) {
  console.error(
    '[upload] GOOGLE_APPLICATION_CREDENTIALS env var is required.\n' +
      '   Export it to point at a Firebase service-account JSON file.\n' +
      '   See scripts/README.md for how to generate one.',
  );
  process.exit(1);
}

initializeApp({
  credential: cert(path.resolve(SERVICE_ACCOUNT_PATH)),
});
const db = getFirestore();

// ── Walk & upload ─────────────────────────────────────────────────────────
interface UploadSummary {
  uploaded: number;
  skipped: number;
  totalFiles: number;
  totalBytes: number;
  companies: Array<{ name: string; fileCount: number; bytes: number }>;
}

async function main(): Promise<void> {
  console.log(`[upload] source: ${SOURCE_ROOT}`);
  console.log(`[upload] dry-run: ${DRY_RUN}`);
  console.log('');

  const rootStat = await stat(SOURCE_ROOT).catch(() => null);
  if (!rootStat || !rootStat.isDirectory()) {
    console.error(`[upload] source root not found: ${SOURCE_ROOT}`);
    process.exit(1);
  }

  const summary: UploadSummary = {
    uploaded: 0,
    skipped: 0,
    totalFiles: 0,
    totalBytes: 0,
    companies: [],
  };

  const topEntries = await readdir(SOURCE_ROOT);
  for (const industry of topEntries) {
    if (IGNORED_TOP.has(industry) || industry.startsWith('.')) continue;
    const industryPath = path.join(SOURCE_ROOT, industry);
    const industryStat = await stat(industryPath).catch(() => null);
    if (!industryStat || !industryStat.isDirectory()) continue;

    const companyEntries = await readdir(industryPath);
    for (const company of companyEntries) {
      if (company.startsWith('.')) continue;
      const companyPath = path.join(industryPath, company);
      const companyStat = await stat(companyPath).catch(() => null);
      if (!companyStat || !companyStat.isDirectory()) continue;

      const files: Record<string, string> = {};
      for (const filename of TARGET_FILES) {
        try {
          files[filename] = await readFile(
            path.join(companyPath, filename),
            'utf8',
          );
        } catch {
          /* file missing for this company — skip that slot */
        }
      }

      if (Object.keys(files).length === 0) {
        summary.skipped += 1;
        console.log(`[skip] ${industry}/${company} — no target files`);
        continue;
      }

      const bytes = Object.values(files).reduce(
        (acc, s) => acc + Buffer.byteLength(s, 'utf8'),
        0,
      );
      summary.totalFiles += Object.keys(files).length;
      summary.totalBytes += bytes;
      summary.companies.push({
        name: company,
        fileCount: Object.keys(files).length,
        bytes,
      });

      const tag = DRY_RUN ? '[DRY]' : '[PUT]';
      console.log(
        `${tag} ${company.padEnd(30)} ${Object.keys(files).length} files, ${bytes.toLocaleString()} bytes  (${industry})`,
      );

      if (!DRY_RUN) {
        await db
          .collection('companyContent')
          .doc(company)
          .set({
            version: 1,
            files,
            sourceName: company,
            updatedAt: FieldValue.serverTimestamp(),
          });
        summary.uploaded += 1;
      } else {
        summary.uploaded += 1;
      }
    }
  }

  console.log('');
  console.log('[upload] ── summary ───────────────────────');
  console.log(
    `  ${DRY_RUN ? 'would upload' : 'uploaded'}: ${summary.uploaded} companies`,
  );
  console.log(`  skipped (no target files): ${summary.skipped}`);
  console.log(`  total files:  ${summary.totalFiles}`);
  console.log(
    `  total bytes:  ${summary.totalBytes.toLocaleString()}  (~${(
      summary.totalBytes / 1024
    ).toFixed(1)} KB)`,
  );
  console.log('');
  if (DRY_RUN) {
    console.log('[upload] DRY RUN — no data written to Firestore.');
    console.log('[upload] Rerun without --dry-run to actually upload.');
  } else {
    console.log('[upload] done.');
  }
}

main().catch((e) => {
  console.error('[upload] FAILED:', e);
  process.exit(1);
});
