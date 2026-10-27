import { access, readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { articleSummary, todayInTokyo, validateArticle } from '../src/magazine/schema.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

export async function buildMagazine({ contentDir = resolve(root, 'content/magazine'), outputDir = resolve(root, 'public/magazine/articles'), catalogFile = resolve(root, 'src/magazine/catalog.generated.json'), today = todayInTokyo() } = {}) {
  const articles = [];
  const problems = [];
  for (const file of (await readdir(contentDir)).filter(name => name.endsWith('.json')).sort()) {
    let article;
    try { article = JSON.parse(await readFile(resolve(contentDir, file), 'utf8')); }
    catch { problems.push(`${file}: JSONを読み込めません`); continue; }
    const errors = validateArticle(article, { today });
    if (article.slug !== basename(file, '.json')) errors.push('ファイル名とslugが一致しません');
    if (article.status === 'published' && article.cover && !errors.length) {
      for (const image of [article.cover.src, article.cover.thumbnail]) {
        try { await access(resolve(root, 'public', image.slice(1))); }
        catch { errors.push(`表紙画像が存在しません: ${image}`); }
      }
    }
    if (errors.length) { problems.push(`${file}: ${errors.join(' / ')}`); continue; }
    if (article.status !== 'published') continue;
    // Publish only the public contract. Local editorial notes never ship.
    articles.push({
      ...articleSummary(article), status: 'published', lead: article.lead,
      sections: article.sections.map(section => ({
        id: section.id, heading: section.heading,
        blocks: section.blocks.map(block => block.type === 'list' ? { type: 'list', items: block.items } : { type: block.type, text: block.text }),
      })),
      sources: article.sources.map(source => ({ title: source.title, url: source.url })),
    });
  }
  if (problems.length) throw new Error(problems.join('\n'));
  articles.sort((a, b) => b.datePublished.localeCompare(a.datePublished) || a.slug.localeCompare(b.slug));
  // Validate the entire collection before replacing generated output. Removing
  // stale bodies also removes an article that was returned to draft.
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  for (const article of articles) await writeFile(resolve(outputDir, article.slug + '.json'), JSON.stringify(article));
  await mkdir(resolve(catalogFile, '..'), { recursive: true });
  await writeFile(catalogFile, JSON.stringify(articles.map(articleSummary), null, 2) + '\n');
  return articles;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildMagazine().then(articles => console.log(`マガジン: ${articles.length}本の公開記事を生成しました`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
