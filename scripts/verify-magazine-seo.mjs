import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageSize, magazinePagePath } from '../src/magazine/schema.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(resolve(root, path), 'utf8');
const catalog = JSON.parse(await read('src/magazine/catalog.generated.json'));
const site = JSON.parse(await read('src/magazine/site.json'));
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const sitemap = await read('dist/sitemap.xml');
const index = await read('dist/magazine/index.html');
let allListings = index;
for (let page = 2; page <= Math.ceil(catalog.length / pageSize); page++) {
  const path = magazinePagePath(page);
  const listing = await read('dist' + path + 'index.html');
  assert.ok(listing.includes(`<link rel="canonical" href="${site.origin}${path}">`));
  assert.ok(sitemap.includes(site.origin + path));
  assert.ok((listing.match(/class="mag-card"/g) || []).length <= pageSize);
  allListings += listing;
}
assert.ok(index.includes('就活マガジン'));
assert.ok(index.includes(`<link rel="canonical" href="${site.origin}/magazine/">`));
assert.equal((index.match(/<h1\b/g) || []).length, 1);
for (const article of catalog) {
  const body = JSON.parse(await read(`public/magazine/articles/${article.slug}.json`));
  const html = await read(`dist/magazine/${article.slug}/index.html`);
  const visibleHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  assert.ok(visibleHtml.includes(escapeHtml(article.title)), article.slug + ': title');
  assert.ok(visibleHtml.includes(escapeHtml(body.lead)), article.slug + ': full body');
  assert.ok(html.includes(`href="${site.origin}/magazine/${article.slug}/"`), article.slug + ': canonical');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  for (const section of body.sections) assert.ok(html.includes(`id="section-${section.id}"`), article.slug + ': TOC anchor');
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json" id="magazine-structured-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(schema[0]['@type'], 'Article'); assert.equal(schema[0].headline, article.title);
  assert.ok(schema[0].articleBody.includes(body.lead));
  if (article.cover) {
    assert.equal(schema[0].image.url, site.origin + article.cover.src, article.slug + ': image schema');
    assert.ok(html.includes(`property="og:image" content="${site.origin}${article.cover.src}"`), article.slug + ': social image');
    assert.ok(visibleHtml.includes(`src="${article.cover.src}"`), article.slug + ': visible cover');
    assert.ok(visibleHtml.includes('AI生成のイメージ画像'), article.slug + ': image disclosure');
    assert.deepEqual(Object.keys(body.cover).sort(), ['src', 'thumbnail', 'alt', 'width', 'height', 'source'].sort(), article.slug + ': public cover fields');
  }
  const payload = JSON.parse(html.match(/<script type="application\/json" id="magazine-article-data">([\s\S]*?)<\/script>/)[1]);
  assert.equal(payload.slug, article.slug);
  assert.ok(sitemap.includes(`${site.origin}/magazine/${article.slug}/`));
  assert.ok(allListings.includes(`/magazine/${article.slug}/`), article.slug + ': reachable from paginated index');
}
for (const file of (await readdir(resolve(root, 'content/magazine'))).filter(name => name.endsWith('.json'))) {
  const article = JSON.parse(await read('content/magazine/' + file));
  if (article.status === 'draft') { assert.equal(index.includes(article.title), false); assert.equal(sitemap.includes('/' + article.slug + '/'), false); }
}
assert.ok((await read('dist/404.html')).includes('noindex, follow'));
assert.ok((await read('dist/robots.txt')).includes(`Sitemap: ${site.origin}/sitemap.xml`));
const workspace = await read('dist/app/index.html');
assert.ok(workspace.includes('<title>AI就活 ワークスペース</title>'));
assert.ok(workspace.includes('noindex, nofollow'));
assert.ok(workspace.includes('type="module"'));
assert.equal(sitemap.includes(`${site.origin}/app/`), false);
assert.ok(!(JSON.parse(await read('firebase.json')).hosting.rewrites || []).some(item => item.source === '**'), 'Unknown article routes must reach the real Hosting 404');
console.log(`SEO検証成功: 記事${catalog.length}本・本文HTML・構造化データ・目次・サイトマップ・404・アプリ入口`);
