import { ArrowUpRight } from 'lucide-react';
import latest from './landing.generated.json';
import { ArticleCard, type MagazineTheme } from './MagazineView';
import type { ArticleSummary } from './types';

export function LandingMagazine({ theme }: { theme: MagazineTheme }) {
  const articles = latest as ArticleSummary[];
  return <section id="magazine" className="magazine-site mag-landing-teaser" data-theme={theme} aria-labelledby="landing-magazine-heading"><div className="mag-shell">
    <div className="mag-section-head"><div><h2 id="landing-magazine-heading">就活を、自分の言葉で。</h2></div><a className="mag-text-link" href="/magazine/">マガジンを読む</a></div>
    <p className="mag-teaser-description">自己分析から、企業研究、AIの活用まで。あなたの次の一歩につながる読みもの。</p>
    {articles.length > 0 && <div className="mag-grid">{articles.map(article => <ArticleCard key={article.slug} article={article} />)}</div>}
  </div></section>;
}
