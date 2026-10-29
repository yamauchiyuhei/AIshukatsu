import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { articleSummary, filterArticles, isSlug, readingMinutes, todayInTokyo, validateArticle } from '../src/magazine/schema.mjs';
import { buildMagazine } from './build-magazine.mjs';

const fixture = () => ({ slug: 'career-note', status: 'published', title: '自分の経験を整理する', description: 'ESを準備するためのメモ', category: 'self-analysis', author: 'AI就活', datePublished: '2026-10-01', dateModified: '2026-10-02', tags: ['ES'], lead: '経験を書き出します。', sections: [{ id: 'start', heading: '場面を選ぶ', blocks: [{ type: 'paragraph', text: 'どんな場面だったかを思い出します。' }] }], sources: [] });
const validate = article => validateArticle(article, { today: '2026-10-23' });

test('published articles require a complete body and real, non-future dates', () => {
  assert.deepEqual(validate(fixture()), []);
  for (const value of ['2026-02-30', '2026-10-24', 'bad-date']) assert.ok(validate({ ...fixture(), dateModified: value }).length);
  assert.ok(validate({ ...fixture(), dateModified: '2026-09-30' }).length);
  assert.ok(validate({ ...fixture(), sections: [] }).length);
  assert.ok(validate({ ...fixture(), tags: ['ES', 'ES'] }).length);
});
test('drafts may be incomplete but still need a safe identity', () => {
  assert.deepEqual(validate({ slug: 'new-story', title: '準備中', category: 'es', status: 'draft' }), []);
  assert.ok(validate({ ...fixture(), slug: '../private' }).length);
  assert.equal(isSlug('valid-slug-2'), true);
  assert.equal(isSlug('draft.json'), false);
});
test('sources reject executable URLs and credentials; heading IDs are unique', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:secret@example.com', 'https://example.com/\npath']) assert.ok(validate({ ...fixture(), sources: [{ title: '参考', url }] }).length);
  assert.deepEqual(validate({ ...fixture(), sources: [{ title: '参考', url: 'https://example.com/source' }] }), []);
  const article = fixture(); article.sections.push(article.sections[0]);
  assert.ok(validate(article).length);
});
test('covers require safe local paths and dimensions, and exclude private generation data', () => {
  const cover = { src: '/magazine/covers/career-note-ab1234.webp', thumbnail: '/magazine/covers/career-note-ab1234-card.webp', alt: '経験をノートに書き出す学生', width: 1280, height: 720, source: 'ai-generated', prompt: 'PRIVATE-PROMPT', sourceFile: '/PRIVATE/source.png' };
  const article = { ...fixture(), cover };
  assert.deepEqual(validate(article), []);
  assert.deepEqual(Object.keys(articleSummary(article).cover), ['src', 'thumbnail', 'alt', 'width', 'height', 'source']);
  assert.equal(JSON.stringify(articleSummary(article)).includes('PRIVATE'), false);
  for (const src of ['https://external.example/image.webp', '/magazine/covers/../../secret.png', '/magazine/covers/image.svg', '/magazine/covers/image.webp?private=1']) assert.ok(validate({ ...article, cover: { ...cover, src } }).length);
  for (const width of [0, -1, 1.5, 99999, '1280']) assert.ok(validate({ ...article, cover: { ...cover, width } }).length);
});
test('calendar date is based on Tokyo at the UTC date boundary', () => {
  assert.equal(todayInTokyo(new Date('2026-10-22T15:00:00Z')), '2026-10-23');
  assert.equal(todayInTokyo(new Date('2026-10-22T14:59:59Z')), '2026-10-22');
});
test('search combines category with normalized, case-insensitive terms', () => {
  const items = [articleSummary(fixture()), { ...articleSummary(fixture()), slug: 'ai-note', category: 'ai', title: 'AIで経験を整理', description: 'AIとの対話を準備する', tags: ['AI'] }];
  assert.equal(filterArticles(items, { query: 'ｅｓ 経験' }).length, 1);
  assert.equal(filterArticles(items, { category: 'ai', query: 'ai' })[0].slug, 'ai-note');
  assert.equal(filterArticles(items, { category: 'es', query: '経験' }).length, 0);
});
test('reading time counts body text, with a minimum of one minute', () => {
  assert.equal(readingMinutes({ lead: '', sections: [] }), 1);
  assert.equal(readingMinutes({ lead: 'あ'.repeat(801), sections: [] }), 3);
});
test('publication excludes drafts and editorial notes and removes stale bodies', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'magazine-test-'));
  try {
    const contentDir = join(folder, 'content'), outputDir = join(folder, 'public'), catalogFile = join(folder, 'catalog.json');
    await mkdir(contentDir); await mkdir(outputDir);
    await writeFile(join(outputDir, 'old.json'), '{}');
    await writeFile(join(contentDir, 'career-note.json'), JSON.stringify({ ...fixture(), editorialNotes: 'PRIVATE-NOTE' }));
    await writeFile(join(contentDir, 'private-draft.json'), JSON.stringify({ slug: 'private-draft', title: 'PRIVATE-DRAFT', category: 'ai', status: 'draft', lead: 'PRIVATE-BODY' }));
    const options = { contentDir, outputDir, catalogFile, today: '2026-10-23' };
    await buildMagazine(options);
    assert.deepEqual(await readdir(outputDir), ['career-note.json']);
    const catalog = await readFile(catalogFile, 'utf8'), body = await readFile(join(outputDir, 'career-note.json'), 'utf8');
    assert.equal(catalog.includes('PRIVATE'), false); assert.equal(body.includes('PRIVATE'), false);
    assert.equal(catalog.includes('sections'), false); assert.equal(JSON.parse(body).sections.length, 1);
    await writeFile(join(contentDir, 'career-note.json'), JSON.stringify({ ...fixture(), status: 'draft' }));
    await buildMagazine(options);
    assert.deepEqual(await readdir(outputDir), []); assert.deepEqual(JSON.parse(await readFile(catalogFile, 'utf8')), []);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
test('an invalid collection fails before changing the previous publication', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'magazine-test-'));
  try {
    const contentDir = join(folder, 'content'), outputDir = join(folder, 'public'), catalogFile = join(folder, 'catalog.json');
    await mkdir(contentDir); await mkdir(outputDir);
    await writeFile(join(outputDir, 'keep.json'), 'previous-publication');
    await writeFile(catalogFile, 'previous-catalog');
    await writeFile(join(contentDir, 'career-note.json'), JSON.stringify({ ...fixture(), datePublished: '2099-01-01' }));
    await assert.rejects(buildMagazine({ contentDir, outputDir, catalogFile, today: '2026-10-23' }));
    assert.equal(await readFile(join(outputDir, 'keep.json'), 'utf8'), 'previous-publication');
    assert.equal(await readFile(catalogFile, 'utf8'), 'previous-catalog');
  } finally { await rm(folder, { recursive: true, force: true }); }
});
test('a missing cover fails before replacing the previous publication', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'magazine-cover-test-'));
  try {
    const contentDir=join(folder,'content'),outputDir=join(folder,'output'),catalogFile=join(folder,'catalog.json');
    await mkdir(contentDir); await mkdir(outputDir);
    await writeFile(join(outputDir,'keep.json'),'previous-publication');
    await writeFile(catalogFile,'previous-catalog');
    await writeFile(join(contentDir,'career-note.json'),JSON.stringify({...fixture(),cover:{src:'/magazine/covers/nonexistent-test-asset.webp',thumbnail:'/magazine/covers/nonexistent-test-asset-card.webp',alt:'画像',width:1280,height:720,source:'ai-generated'}}));
    await assert.rejects(buildMagazine({contentDir,outputDir,catalogFile,today:'2026-10-23'}),/表紙画像が存在しません/);
    assert.equal(await readFile(join(outputDir,'keep.json'),'utf8'),'previous-publication');
    assert.equal(await readFile(catalogFile,'utf8'),'previous-catalog');
  } finally { await rm(folder,{recursive:true,force:true}); }
});

test('the posting CLI creates drafts, rejects incomplete publication and publishes complete articles', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'magazine-cli-test-'));
  const root = fileURLToPath(new URL('../', import.meta.url));
  try {
    for (const directory of ['content/magazine', 'scripts', 'src/magazine']) await mkdir(join(folder, directory), { recursive: true });
    for (const file of ['scripts/magazine.mjs', 'scripts/build-magazine.mjs', 'src/magazine/schema.mjs']) await copyFile(join(root, file), join(folder, file));
    const run = (...args) => execFileSync(process.execPath, [join(folder, 'scripts/magazine.mjs'), ...args], { stdio: 'pipe' }).toString();
    run('new', '--slug', 'new-story', '--title', '新しい記事', '--category', 'interview');
    const file = join(folder, 'content/magazine/new-story.json');
    const draft = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(draft.status, 'draft');
    assert.throws(() => run('new', '--slug', 'new-story', '--title', '上書きしない'));
    assert.throws(() => run('publish', 'new-story'));
    assert.equal(JSON.parse(await readFile(file, 'utf8')).status, 'draft');
    const complete = { ...fixture(), slug: 'new-story', title: draft.title, category: draft.category, status: 'draft' };
    delete complete.datePublished; delete complete.dateModified;
    await writeFile(file, JSON.stringify(complete));
    run('publish', 'new-story');
    const published = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(published.status, 'published'); assert.equal(published.datePublished, todayInTokyo());
    assert.equal(JSON.parse(await readFile(join(folder, 'public/magazine/articles/new-story.json'), 'utf8')).slug, 'new-story');
    const originalDate = published.datePublished;
    run('publish', 'new-story');
    assert.equal(JSON.parse(await readFile(file, 'utf8')).datePublished, originalDate);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('pagination covers a thousand articles exactly once and clamps invalid pages', async () => {
  const { paginateArticles, magazinePagePath } = await import('../src/magazine/schema.mjs');
  const rows = Array.from({ length: 1006 }, (_, i) => ({ slug: 'article-' + i }));
  const first = paginateArticles(rows);
  assert.equal(first.pages, 42);
  assert.equal(first.items.length, 24);
  const collected = Array.from({ length: first.pages }, (_, i) => paginateArticles(rows, i + 1).items).flat();
  assert.deepEqual(collected, rows);
  assert.equal(paginateArticles(rows, -1).page, 1);
  assert.equal(paginateArticles(rows, Infinity).page, 1);
  assert.equal(paginateArticles(rows, 999).page, 42);
  assert.equal(magazinePagePath(1), '/magazine/');
  assert.equal(magazinePagePath(42), '/magazine/page/42/');
});
