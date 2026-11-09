import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const skillDirectory = process.env.HALLMARK_SKILL_DIR || resolve(homedir(), '.codex/skills/hallmark');
const linter = resolve(skillDirectory, 'scripts/sloplint.mjs');
if (!existsSync(linter)) {
  console.error('Hallmarkを導入するか、HALLMARK_SKILL_DIRで導入先を指定してください。');
  process.exit(1);
}
const origin = process.env.HALLMARK_SITE_URL || 'http://127.0.0.1:4173';
const paths = [
  'src/components/LandingPage.tsx',
  'src/components/landing.css',
  'src/magazine/MagazineView.tsx',
  'src/magazine/LandingMagazine.tsx',
  'src/magazine/magazine.css',
  'src/magazine/entry.css',
];
const routes = ['/', '/magazine/', '/magazine/company-analysis-7203/'];
const result = spawnSync(process.execPath, [
  linter, ...paths, '--genre', 'modern-minimal', '--render',
  ...routes.flatMap(route => ['--url', new URL(route, origin).href]),
  ...process.argv.slice(2),
], { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
