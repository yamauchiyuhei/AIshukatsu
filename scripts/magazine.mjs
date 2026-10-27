import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { categories, isSlug, todayInTokyo, validateArticle } from '../src/magazine/schema.mjs';
import { buildMagazine } from './build-magazine.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'new') {
    const { values } = parseArgs({ args, options: { slug: { type: 'string' }, title: { type: 'string' }, category: { type: 'string', default: 'self-analysis' } } });
    if (!isSlug(values.slug) || !values.title?.trim() || !categories.some(category => category.id === values.category)) throw new Error('例: npm run magazine:new -- --slug my-story --title "記事タイトル" --category self-analysis');
    const article = { slug: values.slug, status: 'draft', title: values.title, description: '', category: values.category, author: 'AI就活', tags: [], lead: '', sections: [{ id: 'first-step', heading: '最初の一歩', blocks: [{ type: 'paragraph', text: '' }] }], sources: [] };
    await writeFile(resolve(root, 'content/magazine', values.slug + '.json'), JSON.stringify(article, null, 2) + '\n', { flag: 'wx' });
    console.log(`下書きを作成しました: content/magazine/${values.slug}.json`);
  } else if (command === 'publish') {
    const [slug, ...extra] = args;
    if (!isSlug(slug) || extra.length) throw new Error('例: npm run magazine:publish -- my-story');
    const file = resolve(root, 'content/magazine', slug + '.json');
    const original = await readFile(file, 'utf8');
    const article = JSON.parse(original);
    const today = todayInTokyo();
    const published = { ...article, status: 'published', datePublished: article.datePublished || today, dateModified: today };
    if (published.slug !== slug) throw new Error('ファイル名とslugが一致しません');
    const errors = validateArticle(published, { today });
    if (errors.length) throw new Error(errors.join('\n'));
    await writeFile(file, JSON.stringify(published, null, 2) + '\n');
    try { await buildMagazine(); }
    catch (error) { await writeFile(file, original); throw error; }
    console.log('記事を公開対象にしました。npm run build で配信用ページを生成できます。');
  } else throw new Error('new または publish を指定してください');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
