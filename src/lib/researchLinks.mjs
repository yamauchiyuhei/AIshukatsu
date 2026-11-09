export const ARTICLE_ORIGIN = 'https://aishukatsu.net';
export const RESEARCH_MIN_VERSION = '0.2.20';
export const validArticleSlug = slug => typeof slug === 'string' && slug.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
export function researchDeepLink(slug) {
  if (!validArticleSlug(slug)) throw new Error('記事の識別情報が不正です');
  return `aisyuukatsu://research?article=${encodeURIComponent(slug)}`;
}
export function parseResearchDeepLink(raw) {
  if (typeof raw !== 'string' || raw.length > 256) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'aisyuukatsu:' || url.hostname !== 'research' || url.username || url.password || url.port || url.hash || !['','/'].includes(url.pathname)) return null;
    if ([...url.searchParams.keys()].some(key => key !== 'article') || url.searchParams.getAll('article').length !== 1) return null;
    const slug = url.searchParams.get('article');
    return validArticleSlug(slug) ? slug : null;
  } catch { return null; }
}
export function publicArticleUrl(slug) {
  if (!validArticleSlug(slug)) throw new Error('記事の識別情報が不正です');
  return `${ARTICLE_ORIGIN}/magazine/articles/${slug}.json`;
}
