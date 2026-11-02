import { useEffect, useState } from 'react';
import catalog from './catalog.generated.json';
import { MagazineView, type MagazineFilters, type MagazineTheme } from './MagazineView';
import { categories, isSlug, validateArticle, pageSize } from './schema.mjs';
import { magazineSeo } from './seo';
import type { Article, ArticleSummary } from './types';
import { publicAnalytics } from '../lib/analytics';

const articles = catalog as ArticleSummary[];
const THEME_KEY = 'aishukatsu-magazine-theme';
function readFilters(): MagazineFilters {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category') || '';
  const requestedPage = Number(window.location.pathname.match(/^\/magazine\/page\/(\d+)\/?$/)?.[1] || params.get('page') || 1);
  return { category: categories.some(item => item.id === category) ? category : '', query: params.get('q') || '', page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1 };
}
function routeSlug() {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/magazine') return '';
  const listing = path.match(/^\/magazine\/page\/([1-9]\d*)$/);
  if (listing) return Number(listing[1]) >= 2 && Number(listing[1]) <= Math.ceil(articles.length / pageSize) ? '' : null;
  const match = path.match(/^\/magazine\/([^/]+)$/);
  return match && isSlug(match[1]) ? match[1] : null;
}
function bootstrapArticle(slug: string | null) {
  try {
    const data = JSON.parse(document.getElementById('magazine-article-data')?.textContent || 'null');
    return data?.slug === slug && data.status === 'published' && validateArticle(data).length === 0 ? data as Article : null;
  } catch { return null; }
}

export function MagazineApp() {
  const slug = routeSlug();
  const summary = articles.find(article => article.slug === slug);
  const page = slug === '' ? 'index' : summary ? 'article' : 'not-found';
  const [article, setArticle] = useState<Article | null>(() => bootstrapArticle(slug));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState(readFilters);
  const [theme, setTheme] = useState<MagazineTheme>(() => {
    try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  useEffect(() => {
    if (!summary || article) return;
    const controller = new AbortController();
    setFailed(false);
    fetch(`/magazine/articles/${summary.slug}.json`, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async response => {
        if (!response.ok) throw new Error('Article request failed');
        const data = await response.json();
        if (data.slug !== summary.slug || data.status !== 'published' || validateArticle(data).length) throw new Error('Invalid article');
        if (!controller.signal.aborted) setArticle(data as Article);
      }).catch(error => { if (error.name !== 'AbortError' && !controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [summary, article, attempt]);
  useEffect(() => {
    const update = () => setFilters(readFilters());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  useEffect(() => {
    const seo = magazineSeo(article, articles, page === 'not-found', filters.page);
    document.title = seo.title;
    const meta = (name: string, content: string, property = false) => {
      const key = property ? 'property' : 'name';
      let element = document.querySelector<HTMLMetaElement>(`meta[${key}="${name}"]`);
      if (!element) { element = document.createElement('meta'); element.setAttribute(key, name); document.head.append(element); }
      element.content = content;
    };
    meta('description', seo.description);
    meta('twitter:card', article?.cover ? 'summary_large_image' : 'summary');
    meta('robots', filters.query || filters.category || failed ? 'noindex, follow' : seo.robots);
    for (const [key, value] of Object.entries({ 'og:title': seo.title, 'og:description': seo.description, 'og:url': seo.canonical, 'og:type': seo.type, 'og:image': seo.image })) meta(key, value, true);
    for (const [key,value] of [['article:published_time',article?.datePublished],['article:modified_time',article?.dateModified]] as const) {
      if(value) meta(key,value,true);
      else document.querySelector(`meta[property="${key}"]`)?.remove();
    }
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (page === 'not-found') canonical?.remove();
    else {
      if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
      canonical.href = seo.canonical;
    }
    document.getElementById('magazine-structured-data')?.remove();
    if (page === 'index' || article) {
      const script = document.createElement('script'); script.id = 'magazine-structured-data'; script.type = 'application/ld+json'; script.textContent = JSON.stringify(seo.structuredData); document.head.append(script);
    }
    if (!failed && (page === 'index' || article)) publicAnalytics.trackPage({ canonical: seo.canonical, title: seo.title });
    else publicAnalytics.suspend();
  }, [page, article, filters, failed]);
  useEffect(() => () => publicAnalytics.suspend(), []);
  const changeFilters = (next: MagazineFilters) => {
    const params = new URLSearchParams();
    if (next.category) params.set('category', next.category);
    if (next.query) params.set('q', next.query);
    if (next.page && next.page > 1) params.set('page', String(next.page));
    const url = '/magazine/' + (params.size ? '?' + params : '') + window.location.hash;
    if (next.category !== filters.category) window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
    setFilters(next);
  };
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* theme still works without storage */ }
  };
  useEffect(() => {
    if (!article || !window.location.hash.startsWith('#section-')) return;
    let frame = 0;
    const scrollToSection = () => {
      try {
        const id = decodeURIComponent(window.location.hash.slice(1));
        frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'instant' }));
      } catch { /* malformed fragments do not prevent reading the article */ }
    };
    // Wait until the initial document load has completed so browser scroll
    // restoration cannot undo an inbound section link after React mounts.
    if (document.readyState === 'complete') scrollToSection();
    else window.addEventListener('load', scrollToSection, { once: true });
    return () => { window.removeEventListener('load', scrollToSection); cancelAnimationFrame(frame); };
  }, [article]);
  return <MagazineView articles={articles} page={page} article={article} theme={theme} onThemeChange={toggleTheme} filters={filters} onFilterChange={changeFilters} loading={page === 'article' && !article && !failed} failed={failed} onRetry={() => setAttempt(value => value + 1)} />;
}
