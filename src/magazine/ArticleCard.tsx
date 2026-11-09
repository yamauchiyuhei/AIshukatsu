import { ArrowUpRight, Clock3 } from 'lucide-react';
import { categories } from './schema.mjs';
import { companyName } from './discovery.mjs';
import type { ArticleSummary } from './types';
const coverWords: Record<string, string> = {
  'self-analysis': 'YOUR\nOWN\nSTORY.', 'company-research': 'FIND\nYOUR\nFIT.',
  es: 'WORDS\nTHAT\nMATTER.', interview: 'LET’S\nTALK.', schedule: 'ONE\nSTEP\nAHEAD.', ai: 'THINK\nWITH\nAI.',
};
const formatDate = (date: string) => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
const articleHref = (article: ArticleSummary) => `/magazine/${article.slug}/`;
const categoryOf = (article: ArticleSummary) => categories.find(category => category.id === article.category)!;

export function ArticleCover({ article, large = false, priority = large }: { article: ArticleSummary; large?: boolean; priority?: boolean }) {
  if (article.cover) return <div className={`mag-cover mag-cover-photo${large && article.cover.source === 'official-logo' ? ' mag-cover-logo' : ''}${large ? ' mag-cover-large' : ''}`}>
    <img src={large ? article.cover.src : article.cover.thumbnail} srcSet={large ? `${article.cover.thumbnail} 560w, ${article.cover.src} ${article.cover.width}w` : undefined} sizes={large ? article.cover.source === 'official-logo' ? '(max-width: 708px) calc(100vw - 36px), 672px' : '(max-width: 944px) calc(100vw - 64px), 880px' : undefined} alt={large ? article.cover.alt : ''} width={article.cover.width} height={article.cover.height} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async" />
  </div>;
  return <div className={`mag-cover mag-cover-${article.category}${large ? ' mag-cover-large' : ''}`} aria-hidden="true">
    <span className="mag-cover-label">AI就活マガジン</span>
    <span className="mag-cover-orbit" /><span className="mag-cover-orbit mag-cover-orbit-two" />
    <span className="mag-cover-words">{coverWords[article.category]}</span>
    <span className="mag-cover-bottom"><span>{categoryOf(article).english}</span><ArrowUpRight size={22} strokeWidth={1.4} /></span>
  </div>;
}

export function ArticleCard({ article, priority }: { article: ArticleSummary; priority?: boolean }) {
  return <article className="mag-card">
    <a href={articleHref(article)}>
      <ArticleCover article={article} priority={priority} />
      <div className="mag-card-content"><div className="mag-card-meta"><span className="mag-card-category">{categoryOf(article).label}</span><time dateTime={article.datePublished}>{formatDate(article.datePublished)}</time></div>
      <h3>{companyName(article) ? <><span className="mag-company-name">{companyName(article)}</span><span className="mag-card-topic">{article.title.split(/[｜|]/).slice(1).join('｜') || '事業・職種と企業研究のポイント'}</span></> : article.title}</h3><p>{article.description}</p>
      <span className="mag-card-foot"><span><Clock3 size={13} />約{article.readingMinutes}分</span></span></div>
    </a>
  </article>;
}
