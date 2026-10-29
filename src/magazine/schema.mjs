// Shared by the publisher, reader and tests. Article text is rendered as text,
// never HTML. Draft manuscripts stay outside src/ and public/.
export const categories = [
  { id: 'self-analysis', label: '自己分析', english: 'KNOW YOURSELF', description: '自分の経験から、働く軸を見つける。' },
  { id: 'company-research', label: '企業研究', english: 'FIND YOUR FIT', description: '企業を知って、自分との接点を探す。' },
  { id: 'es', label: 'ES・書類', english: 'TELL YOUR STORY', description: 'あなたの経験を、伝わる言葉にする。' },
  { id: 'interview', label: '面接対策', english: 'MAKE IT A CONVERSATION', description: '準備した言葉を、自分の声で届ける。' },
  { id: 'schedule', label: '就活の進め方', english: 'ONE STEP AT A TIME', description: '目の前の一歩を、無理なく積み重ねる。' },
  { id: 'ai', label: 'AIの活用', english: 'THINK WITH AI', description: '考えることを手放さず、AIを味方に。' },
];

export const isSlug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 100;
const text = value => typeof value === 'string' && value.trim().length > 0;
export function todayInTokyo(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function safeSource(source) {
  if (!source || !text(source.title) || typeof source.url !== 'string' || /[\s\u0000-\u001f\u007f]/.test(source.url)) return false;
  try {
    const url = new URL(source.url);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

export function validateArticle(article, { today = todayInTokyo() } = {}) {
  const errors = [];
  if (!article || typeof article !== 'object') return ['記事はオブジェクトで指定してください'];
  if (!isSlug(article.slug)) errors.push('slug は100文字以内の半角英数字とハイフンで指定してください');
  if (!['draft', 'published'].includes(article.status)) errors.push('status は draft または published です');
  if (!text(article.title)) errors.push('タイトルが必要です');
  if (!categories.some(category => category.id === article.category)) errors.push('カテゴリが不正です');
  if (article.status === 'draft') return errors;
  for (const key of ['description', 'author', 'lead']) if (!text(article[key])) errors.push(`${key} が必要です`);
  for (const key of ['datePublished', 'dateModified']) {
    if (!isDate(article[key]) || article[key] > today) errors.push(`${key} は今日以前の実在する日付にしてください`);
  }
  if (article.dateModified < article.datePublished) errors.push('更新日は公開日以降にしてください');
  if (!Array.isArray(article.tags) || !article.tags.every(text) || new Set(article.tags).size !== article.tags.length) errors.push('tags は重複のない文字列配列です');
  if (article.featured !== undefined && typeof article.featured !== 'boolean') errors.push('featured は真偽値です');
  if (article.writingAssistance !== undefined && !text(article.writingAssistance)) errors.push('執筆補助の表記が不正です');
  if (article.cover !== undefined) {
    const image = article.cover;
    const safeImage = path => typeof path === 'string' && /^\/magazine\/covers\/[a-z0-9-]+\.(?:webp|png|jpe?g)$/.test(path);
    if (!image || !safeImage(image.src) || !safeImage(image.thumbnail) || !text(image.alt)
      || !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height)
      || image.width < 1 || image.height < 1 || image.width > 8192 || image.height > 8192
      || image.source !== 'ai-generated') errors.push('表紙には公開用画像・説明・実寸・生成元が必要です');
  }
  if (!Array.isArray(article.sources) || !article.sources.every(safeSource)) errors.push('sources には公開HTTPSリンクを指定してください');
  if (!Array.isArray(article.sections) || article.sections.length === 0) errors.push('本文のセクションが必要です');
  else {
    const ids = new Set();
    for (const section of article.sections) {
      if (!section || !isSlug(section.id) || !text(section.heading) || ids.has(section.id)) errors.push('見出しには一意のidとテキストが必要です');
      ids.add(section?.id);
      if (!Array.isArray(section?.blocks) || section.blocks.length === 0) errors.push('見出しごとの本文が必要です');
      else for (const block of section.blocks) {
        if (!block || !['paragraph', 'note', 'list', 'quote'].includes(block.type)) errors.push('本文ブロックの種類が不正です');
        else if (block.type === 'list' ? !Array.isArray(block.items) || !block.items.length || !block.items.every(text) : !text(block.text)) errors.push('本文ブロックが空です');
      }
    }
  }
  return errors;
}

export function readingMinutes(article) {
  const strings = [article.lead || ''];
  for (const section of article.sections || []) for (const block of section.blocks || []) strings.push(block.text || '', ...(block.items || []));
  return Math.max(1, Math.ceil([...strings.join('').replace(/\s/g, '')].length / 400));
}

export function articleSummary(article) {
  const keys = ['slug', 'title', 'description', 'category', 'author', 'datePublished', 'dateModified', 'tags', 'featured', 'writingAssistance'];
  const result = { ...Object.fromEntries(keys.filter(key => article[key] !== undefined).map(key => [key, article[key]])), readingMinutes: readingMinutes(article) };
  if (article.cover) result.cover = Object.fromEntries(['src', 'thumbnail', 'alt', 'width', 'height', 'source'].map(key => [key, article.cover[key]]));
  return result;
}

export function filterArticles(articles, { category = '', query = '' } = {}) {
  const terms = query.normalize('NFKC').toLocaleLowerCase('ja').trim().split(/\s+/).filter(Boolean);
  return articles.filter(article => {
    if (category && article.category !== category) return false;
    const haystack = [article.title, article.description, ...(article.tags || []), categories.find(item => item.id === article.category)?.label].join(' ').normalize('NFKC').toLocaleLowerCase('ja');
    return terms.every(term => haystack.includes(term));
  }).sort((a, b) => b.datePublished.localeCompare(a.datePublished) || a.slug.localeCompare(b.slug));
}

export const pageSize = 24;
export function magazinePagePath(page = 1) {
  return page > 1 ? `/magazine/page/${page}/` : '/magazine/';
}
export function paginateArticles(articles, page = 1) {
  const pages = Math.max(1, Math.ceil(articles.length / pageSize));
  const current = Math.min(pages, Math.max(1, Number.isSafeInteger(page) ? page : 1));
  return { page: current, pages, items: articles.slice((current - 1) * pageSize, current * pageSize) };
}
