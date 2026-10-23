/**
 * public/data/*.enc.json を復号し、テスト別・カテゴリ別の件数/ランク内訳を集計する。
 * パイプラインの健全性チェック用。
 *
 * Usage:
 *   npx tsx scripts/verifyData.ts            # 全テスト
 *   npx tsx scripts/verifyData.ts cgab spi   # 指定テストのみ
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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

const b64d = (s: string) => Uint8Array.from(Buffer.from(s, 'base64'));
async function decrypt(blob: { salt: string; iv: string; ct: string }, pw: string): Promise<unknown> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), { name: 'PBKDF2' }, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64d(blob.salt), iterations: 200000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, key, b64d(blob.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

async function main() {
  const filter = process.argv.slice(2);
  const webPw = process.env.TGWEB_PASSPHRASE!;
  const mckPw = process.env.MCKINSEY_PASSPHRASE!;
  const DATA = path.join(ROOT, 'public', 'data');
  const tests = readdirSync(DATA, { withFileTypes: true })
    .filter((d) => d.isDirectory() && (filter.length === 0 || filter.includes(d.name)))
    .map((d) => d.name)
    .sort();

  let grand = 0;
  for (const test of tests) {
    const files = readdirSync(path.join(DATA, test)).filter((f) => f.endsWith('.enc.json')).sort();
    console.log(`\n■ ${test}`);
    for (const f of files) {
      const cat = f.replace('.enc.json', '');
      const blob = JSON.parse(readFileSync(path.join(DATA, test, f), 'utf8'));
      const pw = test === 'interview' ? mckPw : webPw;
      try {
        const items = (await decrypt(blob, pw)) as Array<{ a?: string; rank?: string; verify?: boolean }>;
        if (test === 'interview') { console.log(`  ${cat.padEnd(14)} ${items.length} 問`); grand += items.length; continue; }
        const rank: Record<string, number> = {};
        let answered = 0, verify = 0;
        for (const it of items) { rank[it.rank || '?'] = (rank[it.rank || '?'] || 0) + 1; if (it.a) answered++; if (it.verify) verify++; }
        console.log(`  ${cat.padEnd(14)} ${String(items.length).padStart(5)}件  解答済${String(answered).padStart(5)} 要検証${String(verify).padStart(4)}  ${JSON.stringify(rank)}`);
        grand += items.length;
      } catch (e) {
        console.log(`  ${cat.padEnd(14)} ✗ 復号失敗: ${(e as Error).name}`);
      }
    }
  }
  console.log(`\n合計: ${grand}件`);
}
main();
