import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, Copy, Moon, Search, Sun, X } from 'lucide-react';
import { categories, filterArticles, magazinePagePath, paginateArticles } from './schema.mjs';
import type { Article, ArticleSummary } from './types';

export type MagazineTheme = 'light' | 'dark';
export type MagazineFilters = { category: string; query: string; page?: number };
export interface MagazineViewProps {
  articles: ArticleSummary[];
  page: 'index' | 'article' | 'not-found';
  article?: Article | null;
  theme?: MagazineTheme;
  onThemeChange?: () => void;
  filters?: MagazineFilters;
  onFilterChange?: (filters: MagazineFilters) => void;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}

const coverWords: Record<string, string> = {
  'self-analysis': 'YOUR\nOWN\nSTORY.', 'company-research': 'FIND\nYOUR\nFIT.',
  es: 'WORDS\nTHAT\nMATTER.', interview: 'LET’S\nTALK.', schedule: 'ONE\nSTEP\nAHEAD.', ai: 'THINK\nWITH\nAI.',
};
const formatDate = (date: string) => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
const articleHref = (article: ArticleSummary) => `/magazine/${article.slug}/`;
const categoryOf = (article: ArticleSummary) => categories.find(category => category.id === article.category)!;

export function ArticleCover({ article, large = false }: { article: ArticleSummary; large?: boolean }) {
  if (article.cover) return <div className={`mag-cover mag-cover-photo${large ? ' mag-cover-large' : ''}`}>
    <img src={large ? article.cover.src : article.cover.thumbnail} srcSet={large ? `${article.cover.thumbnail} 560w, ${article.cover.src} ${article.cover.width}w` : undefined} sizes={large ? '(max-width: 600px) calc(100vw - 36px), 880px' : undefined} alt={large ? article.cover.alt : ''} width={article.cover.width} height={article.cover.height} loading={large ? 'eager' : 'lazy'} fetchPriority={large ? 'high' : undefined} decoding="async" />
  </div>;
  return <div className={`mag-cover mag-cover-${article.category}${large ? ' mag-cover-large' : ''}`} aria-hidden="true">
    <span className="mag-cover-label">AI SHUKATSU JOURNAL</span>
    <span className="mag-cover-orbit" /><span className="mag-cover-orbit mag-cover-orbit-two" />
    <span className="mag-cover-words">{coverWords[article.category]}</span>
    <span className="mag-cover-bottom"><span>{categoryOf(article).english}</span><ArrowUpRight size={22} strokeWidth={1.4} /></span>
  </div>;
}

export function ArticleCard({ article }: { article: ArticleSummary }) {
  return <article className="mag-card">
    <a href={articleHref(article)}>
      <ArticleCover article={article} />
      <div className="mag-card-content"><div className="mag-card-meta"><span className="mag-category">{categoryOf(article).label}</span><time dateTime={article.datePublished}>{formatDate(article.datePublished)}</time></div>
      <h3>{article.title}</h3><p>{article.description}</p>
      <span className="mag-card-foot"><span><Clock3 size={13} />約{article.readingMinutes}分</span><ArrowUpRight size={19} /></span></div>
    </a>
  </article>;
}

function ArticleShelf({ title, articles, href }: { title: string; articles: ArticleSummary[]; href?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const move = (direction: number) => {
    const element = track.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * .8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <section className="mag-shelf" aria-label={title}>
    <div className="mag-shelf-header">{href ? <a className="mag-shelf-title" href={href}><h2>{title}</h2><ArrowRight size={18} /></a> : <h2>{title}</h2>}
      <div className="mag-shelf-controls"><button type="button" onClick={() => move(-1)} aria-label={`${title}の前の記事を表示`}><ArrowLeft size={17} /></button><button type="button" onClick={() => move(1)} aria-label={`${title}の次の記事を表示`}><ArrowRight size={17} /></button></div>
    </div>
    <div ref={track} className="mag-shelf-track" tabIndex={0} role="region" aria-label={`${title}の記事一覧。横にスクロールできます`}>{articles.map(article => <ArticleCard key={article.slug} article={article} />)}</div>
  </section>;
}

function Header({ theme, onThemeChange }: { theme: MagazineTheme; onThemeChange?: () => void }) {
  return <header className="mag-header"><div className="mag-shell mag-header-inner">
    <a className="mag-brand" href="/" aria-label="AI就活 ホーム"><img src="/logo.png" alt="" width={34} height={34} /><span>AI就活<span className="mag-brand-divider">/</span><span className="mag-brand-journal">JOURNAL</span></span></a>
    <nav aria-label="メインナビゲーション"><a href="/magazine/" aria-current="page">マガジン</a><a className="mag-nav-product" href="/#features">AI就活について<ArrowUpRight size={13} /></a></nav>
    <div className="mag-header-actions"><button className="mag-icon-button" type="button" onClick={onThemeChange} aria-label={theme === 'dark' ? 'ライトテーマに切り替える' : 'ダークテーマに切り替える'}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button><a className="mag-button mag-header-cta" href="/app/">アプリを使う<ArrowUpRight size={14} /></a></div>
  </div></header>;
}

function MagazineIndex({ articles, filters, onFilterChange }: { articles: ArticleSummary[]; filters: MagazineFilters; onFilterChange?: (filters: MagazineFilters) => void }) {
  const results = filterArticles(articles, filters);
  const pagination = paginateArticles(results, filters.page);
  const filtering = Boolean(filters.category || filters.query.trim());
  const browse = !filtering && pagination.page === 1;
  const featured = articles.find(article => article.featured);
  const starters = [featured, ...[...articles].filter(article => article.slug !== featured?.slug).sort((a, b) => a.datePublished.localeCompare(b.datePublished))].filter((article): article is ArticleSummary => Boolean(article)).slice(0, 6);
  const selectedCategory = categories.find(category => category.id === filters.category);
  const categoryLink = (category: string) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (filters.query) params.set('q', filters.query);
    return '/magazine/' + (params.size ? '?' + params : '') + '#stories';
  };
  return <main id="mag-main" className="mag-shell mag-index">
    <section className="mag-page-heading" aria-labelledby="mag-heading">
      <p className="mag-eyebrow">AI SHUKATSU MAGAZINE</p><h1 id="mag-heading">就活マガジン</h1>
      <p>自己分析から、企業研究、選考の準備まで。<br className="mag-heading-break" />あなたの次の一歩につながる読みもの。</p>
    </section>
    <section className="mag-stories" id="stories" aria-labelledby="mag-stories-heading">
      <div className="mag-browse-tools">
        <form className="mag-search" action="/magazine/" role="search" onSubmit={onFilterChange ? event => event.preventDefault() : undefined}>
          <Search size={17} aria-hidden="true" /><label className="sr-only" htmlFor="mag-query">記事を検索</label><input id="mag-query" name="q" type="search" placeholder="気になるキーワードで探す" value={filters.query} onChange={event => onFilterChange?.({ ...filters, query: event.target.value, page: 1 })} />{filters.category && <input type="hidden" name="category" value={filters.category} />}
        </form>
      <nav className="mag-filters" aria-label="記事のカテゴリ">
        {[{ id: '', label: 'すべて' }, ...categories].map(category => <a key={category.id} href={categoryLink(category.id)} aria-current={filters.category === category.id ? 'page' : undefined} onClick={onFilterChange ? event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onFilterChange({ ...filters, category: category.id, page: 1 }); } : undefined}>{category.label}<span>{category.id ? articles.filter(article => article.category === category.id).length : articles.length}</span></a>)}
      </nav></div>
      {browse && <div className="mag-shelves"><ArticleShelf title="まず読みたい記事" articles={starters} /><ArticleShelf title="新着記事" articles={articles.slice(0, 10)} />{categories.map(category => <ArticleShelf key={category.id} title={category.label} href={categoryLink(category.id)} articles={articles.filter(article => article.category === category.id).slice(0, 8)} />)}</div>}
      <div className="mag-section-head mag-all-articles"><h2 id="mag-stories-heading">{selectedCategory?.label || (filters.query.trim() ? '検索結果' : 'すべての記事')}<span>{results.length.toLocaleString('ja-JP')}本</span></h2></div>
      <p className="sr-only" role="status" aria-live="polite">{results.length}件の記事が見つかりました</p>
      {results.length ? <div className="mag-grid">{pagination.items.map(article => <ArticleCard article={article} key={article.slug} />)}</div> : <div className="mag-empty"><Search size={28} strokeWidth={1.2} /><h3>{articles.length ? '記事が見つかりませんでした' : '最初の記事を準備しています'}</h3><p>{articles.length ? 'キーワードやカテゴリを変えて、もう一度お試しください。' : '自己分析や企業研究など、就活に役立つ読みものをお届けします。'}</p>{filtering && <a href="/magazine/" className="mag-text-link" onClick={onFilterChange ? event => { event.preventDefault(); onFilterChange({ category: '', query: '' }); } : undefined}><X size={15} />絞り込みを解除する</a>}</div>}
      {pagination.pages > 1 && <nav className="mag-pagination" aria-label="記事一覧のページ"><p>{pagination.page} / {pagination.pages} ページ</p><div>{Array.from({ length: pagination.pages }, (_, index) => index + 1).filter(number => number === 1 || number === pagination.pages || Math.abs(number - pagination.page) <= 2).map(number => {
        const params = new URLSearchParams();
        if (filters.category) params.set('category', filters.category);
        if (filters.query) params.set('q', filters.query);
        if (filtering && number > 1) params.set('page', String(number));
        const href = (filtering ? '/magazine/?' + params : magazinePagePath(number)) + '#stories';
        return <a key={number} href={href} aria-current={number === pagination.page ? 'page' : undefined} onClick={filtering && onFilterChange ? event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onFilterChange({ ...filters, page: number }); document.getElementById('stories')?.scrollIntoView(); } : undefined}>{number}</a>;
      })}</div></nav>}
    </section>
    <ProductCallout />
  </main>;
}

function ProductCallout() {
  return <aside className="mag-callout" aria-label="AI就活のご案内"><div><p className="mag-eyebrow">READ. THINK. TAKE ACTION.</p><h2>読んだ先の一歩も、<br />AI就活と。</h2><p>企業研究も、書きかけのESも、次の締切も。<br />考えたことをひとつの場所に残して、就活を進めよう。</p></div><a className="mag-button" href="/#download">AI就活を見てみる<ArrowUpRight size={17} /></a></aside>;
}

function ShareButton({ article }: { article: Article }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const shareUrl = typeof window === 'undefined' ? '' : window.location.origin + articleHref(article);
  return <div className="mag-share"><button type="button" className="mag-text-link" onClick={async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); }
    catch { setFallback(true); }
  }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'リンクをコピーしました' : '記事のリンクをコピー'}</button><span className="sr-only" role="status">{copied ? 'リンクをコピーしました' : ''}</span>{fallback && <label>共有用リンク<input aria-label="共有用リンク" readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} /></label>}</div>;
}

function TableOfContents({ article, active }: { article: Article; active: string }) {
  return <ol>{article.sections.map((section, index) => <li key={section.id}><a href={'#section-' + section.id} aria-current={active === section.id ? 'location' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{section.heading}</a></li>)}</ol>;
}

function ArticleReader({ article, articles }: { article: Article; articles: ArticleSummary[] }) {
  const ref = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(article.sections[0]?.id || '');
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const element = ref.current;
      if (!element) return;
      const box = element.getBoundingClientRect();
      const distance = box.height - window.innerHeight;
      setProgress(distance <= 0 ? (box.top <= 100 ? 1 : 0) : Math.max(0, Math.min(1, (100 - box.top) / distance)));
      let current = article.sections[0]?.id || '';
      for (const section of article.sections) if ((document.getElementById('section-' + section.id)?.getBoundingClientRect().top ?? Infinity) < 160) current = section.id;
      setActive(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame); };
  }, [article]);
  const score = (item: ArticleSummary) => Number(item.category === article.category) + item.tags.filter(tag => article.tags.includes(tag)).length * 2;
  const related = [...articles].filter(item => item.slug !== article.slug).sort((a, b) => score(b) - score(a)).slice(0, 3);
  return <main id="mag-main" className="mag-shell mag-reader">
    <div className="mag-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
    <nav className="mag-breadcrumbs" aria-label="パンくずリスト"><a href="/">ホーム</a><span>/</span><a href="/magazine/">マガジン</a><span>/</span><span>{categoryOf(article).label}</span></nav>
    <article ref={ref}>
      <header className="mag-article-header"><a className="mag-category" href={'/magazine/?category=' + article.category}>{categoryOf(article).label}</a><div className="mag-byline"><a href="/magazine/#editorial">{article.author}</a><time dateTime={article.datePublished}>{formatDate(article.datePublished)} 公開</time>{article.dateModified !== article.datePublished && <time dateTime={article.dateModified}>{formatDate(article.dateModified)} 更新</time>}<span><Clock3 size={14} />約{article.readingMinutes}分</span></div><h1>{article.title}</h1></header>
      <figure className="mag-article-cover"><ArticleCover article={article} large />{article.cover && <figcaption>AI生成のイメージ画像</figcaption>}</figure>
      <div className="mag-reading-layout"><div className="mag-body"><p className="mag-lead">{article.lead}</p><details className="mag-mobile-toc"><summary>この記事の目次<ChevronDown size={17} /></summary><TableOfContents article={article} active={active} /></details>
        {article.sections.map(section => <section id={'section-' + section.id} key={section.id}><h2>{section.heading}</h2>{section.blocks.map((block, i) => block.type === 'list' ? <ul key={i}>{block.items!.map((item, j) => <li key={j}>{item}</li>)}</ul> : block.type === 'note' ? <aside className="mag-note" key={i}>{block.text}</aside> : block.type === 'quote' ? <blockquote key={i}>{block.text}</blockquote> : <p key={i}>{block.text}</p>)}</section>)}
        {article.sources.length > 0 && <section className="mag-sources"><h2>参考資料</h2><ul>{article.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ArrowUpRight size={14} /></a></li>)}</ul></section>}
        {article.writingAssistance && <p className="mag-writing-credit">{article.writingAssistance}</p>}<div className="mag-article-tags">{article.tags.map(tag => <a href={'/magazine/?q=' + encodeURIComponent(tag)} key={tag}>#{tag}</a>)}</div><ShareButton article={article} /><a className="mag-text-link mag-back" href="/magazine/"><ArrowLeft size={16} />記事一覧に戻る</a>
      </div><aside className="mag-desktop-toc"><nav aria-label="この記事の目次"><p className="mag-eyebrow">この記事の目次</p><TableOfContents article={article} active={active} /></nav></aside></div>
    </article>
    {related.length > 0 && <section className="mag-related" aria-labelledby="mag-related-heading"><div className="mag-section-head"><div><p className="mag-eyebrow">KEEP EXPLORING</p><h2 id="mag-related-heading">こちらの記事も</h2></div><a className="mag-text-link" href="/magazine/">すべての記事<ArrowRight size={17} /></a></div><div className="mag-grid">{related.map(item => <ArticleCard key={item.slug} article={item} />)}</div></section>}
    <ProductCallout />
  </main>;
}

export function MagazineView({ articles, page, article, theme = 'light', onThemeChange, filters = { category: '', query: '' }, onFilterChange, loading, failed, onRetry }: MagazineViewProps) {
  return <div className="magazine-site" data-theme={theme}><a className="mag-skip" href="#mag-main">本文に進む</a><Header theme={theme} onThemeChange={onThemeChange} />
    {page === 'index' ? <MagazineIndex articles={articles} filters={filters} onFilterChange={onFilterChange} /> : page === 'article' && article ? <ArticleReader article={article} articles={articles} /> : <main className="mag-shell mag-empty mag-page-state" id="mag-main" aria-busy={loading || undefined}><p className="mag-eyebrow">AI SHUKATSU JOURNAL</p><h1>{loading ? '記事を読み込んでいます' : failed ? '記事を読み込めませんでした' : 'ページが見つかりません'}</h1><p>{loading ? 'もう少しお待ちください。' : failed ? '通信状況を確認して、もう一度お試しください。' : 'URLをご確認いただくか、記事一覧からお探しください。'}</p>{failed && <button className="mag-button" type="button" onClick={onRetry}>もう一度読み込む</button>}<a className="mag-text-link" href="/magazine/"><ArrowLeft size={16} />マガジンに戻る</a></main>}
    <footer className="mag-footer" id="editorial"><div className="mag-shell"><a className="mag-brand" href="/">AI就活<span className="mag-brand-journal">JOURNAL</span></a><p>考える、書く、一歩進む。</p><p>運営：AI就活。記事ごとの執筆補助と参考資料は本文末尾に記載しています。</p><nav aria-label="フッターナビゲーション"><a href="/magazine/">マガジン</a><a href="/#features">AI就活について</a><a href="/#download">ダウンロード</a><a href="/#privacy">プライバシーポリシー</a></nav><small>© {new Date().getFullYear()} AIshukatsu</small></div></footer>
  </div>;
}
