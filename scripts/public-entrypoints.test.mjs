import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// Run after npm run build: guard the actual HTML delivered to readers.
const dist = resolve(import.meta.dirname, '../dist');
const manifest = JSON.parse(readFileSync(resolve(dist, '.vite/manifest.json'), 'utf8'));
function dependencies(entry) {
  const seen = new Set();
  function visit(key) { if (seen.has(key)) return; seen.add(key); for (const dependency of manifest[key].imports || []) visit(dependency); }
  visit(entry);
  return [...seen].map(key => manifest[key]);
}
for (const [kind, path] of [['listing', 'magazine/index.html'], ['reader', 'magazine/company-analysis-7203/index.html']]) {
  test(`${kind}: public entry ships only its styles and dependencies`, () => {
    const html = readFileSync(resolve(dist, path), 'utf8');
    const chunks = dependencies(`src/magazine/${kind}.tsx`);
    assert.ok(html.includes(`src="/${chunks[0].file}"`));
    assert.ok(!html.includes(`src="/${manifest['index.html'].file}"`));
    const css = [...new Set(chunks.flatMap(chunk => chunk.css || []))];
    assert.ok(css.length > 0);
    const actualCss = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\/([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(actualCss.sort(), css.sort());
    assert.ok(css.reduce((size, path) => size + statSync(resolve(dist, path)).size, 0) < 40000, 'Public CSS must not include workspace/editor utilities');
    for (const chunk of chunks.slice(1)) assert.ok(html.includes(`rel="modulepreload" crossorigin href="/${chunk.file}"`), chunk.file);
    assert.ok(!chunks.some(chunk => chunk.name === 'main' || chunk.name === 'App'), 'No landing or private workspace runtime');
    if (kind === 'reader') assert.ok(!chunks.some(chunk => chunk.name === 'MagazineApp'), 'Reader must not download the complete search catalog');
  });
}

test('landing prerender keeps literal CSS selectors for hydration and no-script display', () => {
  const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
  const style = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]).find(css => css.includes('.landing-mono'));
  assert.ok(!/&#x27;|&quot;|&gt;/.test(style));
  assert.ok(html.includes('[data-stagger][data-revealed="true"] > *'));
  assert.ok(html.includes('[data-reveal],[data-stagger],[data-stagger]>*{opacity:1!important'), 'No-script fallback also reveals staggered children');
});
