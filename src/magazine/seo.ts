import site from './site.json';
import type { Article, ArticleSummary } from './types';
import { filterArticles, magazinePagePath, paginateArticles } from './schema.mjs';

export function magazineSeo(article: Article | null, articles: ArticleSummary[], notFound = false, page = 1) {
  const pagination = paginateArticles(filterArticles(articles), page);
  const path = article ? `/magazine/${article.slug}/` : magazinePagePath(pagination.page);
  const canonical = site.origin + path;
  const title = notFound ? 'ページが見つかりません | AI就活' : article ? `${article.title} | ${site.name}` : `${site.name} — 就活を、自分の言葉で。${pagination.page > 1 ? `（${pagination.page}ページ目）` : ''}`;
  const description = article?.description || site.description;
  const image = site.origin + (article?.cover?.src || '/logo.png');
  const breadcrumbs = [
    { '@type': 'ListItem', position: 1, name: 'AI就活', item: site.origin + '/' },
    { '@type': 'ListItem', position: 2, name: 'マガジン', item: site.origin + '/magazine/' },
    ...(article ? [{ '@type': 'ListItem', position: 3, name: article.title, item: canonical }] : []),
  ];
  const structuredData = notFound ? [] : [
    article ? {
      '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description,
      mainEntityOfPage: canonical, url: canonical, inLanguage: 'ja', datePublished: article.datePublished + 'T00:00:00+09:00', dateModified: article.dateModified + 'T00:00:00+09:00',
      author: { '@type': 'Organization', name: article.author, url: site.origin + '/magazine/#editorial' }, publisher: { '@type': 'Organization', name: 'AI就活', url: site.origin },
      ...(article.cover ? { image: { '@type': 'ImageObject', url: image, width: article.cover.width, height: article.cover.height, caption: 'AI生成のイメージ画像' } } : {}),
      articleBody: [article.lead, ...article.sections.flatMap(section => [section.heading, ...section.blocks.flatMap(block => block.type === 'list' ? block.items! : [block.text!])])].join('\n\n'),
    } : {
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: site.name, description, url: canonical, inLanguage: 'ja',
      mainEntity: { '@type': 'ItemList', itemListElement: pagination.items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.title, url: `${site.origin}/magazine/${item.slug}/` })) },
    },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: breadcrumbs },
  ];
  return { title, description, canonical, image, type: article ? 'article' : 'website', robots: notFound || !articles.length ? 'noindex, follow' : 'index, follow, max-image-preview:large', structuredData };
}
