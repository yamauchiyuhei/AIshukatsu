import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { MagazineView, relatedArticles } from './MagazineView';
import { magazineSeo } from './seo';
import type { Article, ArticleSummary } from './types';
import { LandingPage } from '../components/LandingPage';

export function renderLanding() {
  return renderToStaticMarkup(<LandingPage onOpenApp={() => {}} />);
}

export function renderMagazine(article: Article | null, articles: ArticleSummary[], notFound = false, page = 1) {
  return {
    html: renderToString(<MagazineView articles={article ? relatedArticles(article, articles) : articles} article={article} page={notFound ? 'not-found' : article ? 'article' : 'index'} filters={{ category: '', query: '', page }} />),
    seo: magazineSeo(article, articles, notFound, page),
  };
}

export { relatedArticles };
