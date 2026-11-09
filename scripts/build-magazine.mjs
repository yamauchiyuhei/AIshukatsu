import { access, readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { articleSummary, todayInTokyo, validateArticle } from '../src/magazine/schema.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const industries = await readFile(resolve(root, 'src/data/companyToIndustry.json'), 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return {}; throw error; });
const aliasesByCode = { '6758': ['sony', 'sony group', 'ソニー'], '7203': ['toyota', 'toyota motor', 'トヨタ'], '7974': ['nintendo', 'ニンテンドー'], '7267': ['honda', 'ホンダ'], '7201': ['nissan', '日産'], '9432': ['ntt', '日本電信電話'], '6501': ['hitachi', '日立'], '6752': ['panasonic', 'パナソニック'], '6702': ['fujitsu', '富士通'], '6701': ['nec', '日本電気'], '8729': ['sony financial group', 'ソニーフィナンシャルグループ'] };

// Index site-name spellings found in the public official cover attribution.
function companySearchAliases(article) {
  if (!/^company-analysis-[a-z0-9-]+$/.test(article.slug)) return [];
  const source = article.cover?.attribution;
  const code = article.slug.replace('company-analysis-', '');
  const manual = aliasesByCode[code] || [];
  if (!source?.title.includes('公式')) return manual;
  const host = new URL(source.url).hostname;
  const parts = host.split('.');
  const brand = host.endsWith('.co.jp') ? parts.at(-3)
    : /\.(com|jp|net)$/.test(host) ? parts.at(-2) : parts.at(-1);
  if (!brand || !/^[a-z][a-z0-9-]{2,}$/.test(brand)) return manual;
  return [...manual, brand, brand.replaceAll('-', ' ')].filter((value, i, values) => values.indexOf(value) === i);
}

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
      ...articleSummary(article),
      ...(/^company-analysis-/.test(article.slug) ? {companyIndustry: industries[article.title.split('の企業分析')[0]] || '未分類'} : {}),
      status: 'published', lead: article.lead,
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
  await writeFile(catalogFile, JSON.stringify(articles.map(article => {
    const summary = { ...articleSummary(article), ...(article.companyIndustry ? {companyIndustry: article.companyIndustry} : {}) };
    const searchAliases = companySearchAliases(article);
    return searchAliases.length ? { ...summary, searchAliases } : summary;
  }), null, 2) + '\n');
  if (catalogFile === resolve(root, 'src/magazine/catalog.generated.json')) {
    const featured = articles.find(article => article.featured);
    const latest = featured ? [featured, ...articles.filter(article => article !== featured)] : articles;
    await writeFile(resolve(root, 'src/magazine/landing.generated.json'), JSON.stringify(latest.slice(0, 3).map(articleSummary), null, 2) + '\n');
  }
  return articles;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildMagazine().then(articles => console.log(`マガジン: ${articles.length}本の公開記事を生成しました`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
