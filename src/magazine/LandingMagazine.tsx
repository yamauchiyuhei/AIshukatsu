import { ArrowUpRight } from 'lucide-react';
import catalog from './catalog.generated.json';
import { ArticleCard, type MagazineTheme } from './MagazineView';
import type { ArticleSummary } from './types';

export function LandingMagazine({ theme }: { theme: MagazineTheme }) {
  const articles = catalog as ArticleSummary[];
  const featured = articles.find(article => article.featured);
  const latest = [featured, ...articles.filter(article => article.slug !== featured?.slug)].filter((article): article is ArticleSummary => Boolean(article)).slice(0, 3);
  return <section id="magazine" className="magazine-site mag-landing-teaser" data-theme={theme} aria-labelledby="landing-magazine-heading"><div className="mag-shell">
    <div className="mag-section-head"><div><p className="mag-eyebrow">AI SHUKATSU MAGAZINE</p><h2 id="landing-magazine-heading">就活を、自分の言葉で。</h2></div><a className="mag-text-link" href="/magazine/">マガジンを読む<ArrowUpRight size={17} /></a></div>
    <p className="mag-teaser-description">自己分析から、企業研究、AIの活用まで。あなたの次の一歩につながる読みもの。</p>
    {latest.length > 0 && <div className="mag-grid">{latest.map(article => <ArticleCard key={article.slug} article={article} />)}</div>}
  </div></section>;
}
