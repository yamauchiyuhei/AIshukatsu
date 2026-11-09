import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, Copy, Moon, Search, Sun, X } from 'lucide-react';
import { categories, filterArticles, magazinePagePath, paginateArticles } from './schema.mjs';
import type { Article, ArticleSummary } from './types';
import { DesktopResearchLink } from './DesktopResearchLink';
import { WebsiteHeader } from '../components/website/WebsiteHeader';
import { companyName, filterDiscovery } from './discovery.mjs';
import { ArticleCover, ArticleCard } from './ArticleCard';
export { ArticleCover, ArticleCard } from './ArticleCard';
import { ArticleActions, ReadingLibrary, useReadingProgress } from './ReaderTools';

export type MagazineTheme = 'light' | 'dark';
export type MagazineFilters = { category: string; query: string; page?: number; industry?: string; order?: string; collection?: string };
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

const formatDate = (date: string) => new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
const articleHref = (article: ArticleSummary) => `/magazine/${article.slug}/`;
const categoryOf = (article: ArticleSummary) => categories.find(category => category.id === article.category)!;

export function relatedArticles(article: Article, articles: ArticleSummary[]) {
  const genericTags = new Set(['就活', '企業分析', '企業研究']);
  const tags = new Set(article.tags.filter(tag => !genericTags.has(tag)));
  const score = (item: ArticleSummary) => Number(item.category === article.category)
    + item.tags.filter(tag => tags.has(tag)).length * 3;
  const candidates = articles.filter(item => item.slug !== article.slug);
  const sameIndustry = article.companyIndustry && article.companyIndustry !== '未分類' ? candidates.filter(item => item.companyIndustry === article.companyIndustry).sort((a,b) => score(b)-score(a)).slice(0,2) : [];
  const ranked = candidates.sort((a,b) => score(b)-score(a));
  const nextStep = candidates.filter(item => !companyName(item) && ['es','interview'].includes(item.category)).slice(0,2);
  return [...new Map([...(sameIndustry.length ? sameIndustry : ranked.slice(0,2)), ...nextStep.slice(0,1), ...ranked].map(item => [item.slug,item])).values()].slice(0,3);
}

function ArticleShelf({ title, articles, href, prioritizeFirst }: { title: string; articles: ArticleSummary[]; href?: string; prioritizeFirst?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const move = (direction: number) => {
    const element = track.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * .8, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <section className="mag-shelf" aria-label={title}>
    <div className="mag-shelf-header">{href ? <a className="mag-shelf-title" href={href}><h2>{title}</h2><ArrowRight size={18} /></a> : <h2>{title}</h2>}
      <div className="mag-shelf-controls"><button type="button" onClick={() => move(-1)} aria-label={`${title}の前の記事を表示`}><ArrowLeft size={17} /></button><button type="button" onClick={() => move(1)} aria-label={`${title}の次の記事を表示`}><ArrowRight size={17} /></button></div>
    </div>
    <div ref={track} className="mag-shelf-track" tabIndex={0} role="region" aria-label={`${title}の記事一覧。横にスクロールできます`}>{articles.map((article, index) => <ArticleCard key={article.slug} article={article} priority={prioritizeFirst && index === 0} />)}</div>
  </section>;
}

function MagazineIndex({ articles, filters, onFilterChange }: { articles: ArticleSummary[]; filters: MagazineFilters; onFilterChange?: (filters: MagazineFilters) => void }) {
  const results = filterDiscovery(filterArticles(articles, filters), filters);
  const pagination = paginateArticles(results, filters.page);
  const filtering = Boolean(filters.category || filters.query.trim() || filters.industry || filters.collection || filters.order);
  const browse = !filtering && pagination.page === 1;
  const starterSlugs = ['find-your-own-career-axis', 'company-research-one-page', 'es-first-draft'];
  const starters = starterSlugs.map(slug => articles.find(article => article.slug === slug))
    .filter((article): article is ArticleSummary => Boolean(article));
  const selectedCategory = categories.find(category => category.id === filters.category);
  const categoryLink = (category: string) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (filters.query) params.set('q', filters.query);
    if (filters.industry && category === 'company-research') params.set('industry',filters.industry);
    if (filters.order) params.set('order',filters.order);
    if (filters.collection) params.set('collection',filters.collection);
    return '/magazine/' + (params.size ? '?' + params : '') + '#stories';
  };
  return <main id="mag-main" className="mag-shell mag-index">
    <section className="mag-page-heading" aria-labelledby="mag-heading">
      <h1 id="mag-heading">就活マガジン</h1>
      <p>自己分析から、企業研究、選考の準備まで。<br className="mag-heading-break" />あなたの次の一歩につながる読みもの。</p>
    </section>
    <section className="mag-stories" id="stories" aria-labelledby="mag-stories-heading">
      <div className="mag-browse-tools">
        <p className="mag-catalog-loading" role="status">記事検索を準備しています…</p>
        <p className="mag-catalog-error" role="status">検索を読み込めませんでした。<a href="/magazine/">マガジンを開き直す</a>してください。</p>
        <form className="mag-search" action="/magazine/" role="search" onSubmit={onFilterChange ? event => event.preventDefault() : undefined}>
          <Search size={17} aria-hidden="true" /><label className="sr-only" htmlFor="mag-query">記事を検索</label><input id="mag-query" name="q" type="search" placeholder="企業名・証券コード・就活のテーマ" value={filters.query} onChange={event => onFilterChange?.({ ...filters, query: event.target.value, page: 1 })} />{filters.category && <input type="hidden" name="category" value={filters.category} />}
        </form>
      <noscript><p className="mag-search-help">キーワード検索にはJavaScriptが必要です。記事は下の一覧から閲覧できます。</p></noscript>
      <nav className="mag-filters" aria-label="記事のカテゴリ">
        {[{ id: '', label: 'すべて' }, ...categories].map(category => <a key={category.id} href={categoryLink(category.id)} aria-current={filters.category === category.id ? 'page' : undefined} onClick={onFilterChange ? event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onFilterChange({ ...filters, category: category.id, industry: category.id === 'company-research' ? filters.industry : '', collection: '', page: 1 }); } : undefined}>{category.label}<span>{category.id ? articles.filter(article => article.category === category.id).length : articles.length}</span></a>)}
      </nav>
      <details className="mag-advanced-search" open={Boolean(filters.industry || filters.order)}><summary>業界・並び順で絞り込む</summary><div className="mag-discovery-tools">
        <label>業界から企業を探す<select value={filters.industry || ''} onChange={event => onFilterChange?.({...filters, category: event.target.value ? 'company-research' : filters.category, industry:event.target.value, page:1})}><option value="">すべての業界</option>{[...new Set(articles.filter(item => companyName(item)).map(item => item.companyIndustry || '未分類'))].sort((a,b) => a.localeCompare(b,'ja')).map(industry => <option key={industry} value={industry}>{industry}</option>)}</select></label>
        <label>並び順<select value={filters.order || ''} onChange={event => onFilterChange?.({...filters, order:event.target.value,page:1})}><option value="">公開日が新しい順</option><option value="name">企業名・記事名順</option></select></label>
      </div>
      <p className="mag-discovery-help">業界は既存の企業分類を使用しています。分類がない企業は「未分類」から探せます。</p></details>
      <nav className="mag-library-tabs" aria-label="自分の記事一覧">{[['','記事を探す'],['saved','あとで読む'],['history','履歴'],['compare','比較候補']].map(([value,label]) => <a key={value} href={'/magazine/'+(value ? '?collection='+value : '')+'#stories'} aria-current={(filters.collection || '') === value ? 'page' : undefined} onClick={onFilterChange ? event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onFilterChange({category:'',query:'',collection:value,page:1}); } : undefined}>{label}</a>)}</nav>
      {filtering ? <div className="mag-filter-summary">
        <span>{[selectedCategory?.label, filters.industry, filters.order === 'name' && '企業名・記事名順', filters.query.trim() && `「${filters.query.trim()}」`].filter(Boolean).join(' / ')}{!filters.collection && <> · {results.length.toLocaleString('ja-JP')}件</>}</span>
        <a href="/magazine/#stories" className="mag-text-link" onClick={onFilterChange ? event => { event.preventDefault(); onFilterChange({ category: '', query: '' }); } : undefined}>解除</a>
      </div> : <a className="mag-text-link mag-jump-list" href="#article-list">すべての記事へ<ArrowRight size={16} aria-hidden="true" /></a>}
      </div>
      {browse && <div className="mag-shelves">
        {starters.length > 0 && <ArticleShelf title="まず読みたい記事" articles={starters} prioritizeFirst />}
        <ArticleShelf title="新着記事" articles={articles.slice(0, 6)} />
      </div>}
      <ReadingLibrary collection={filters.collection} articles={articles} />
      {!filters.collection && <>
      <div id="article-list" className="mag-section-head mag-all-articles"><h2 id="mag-stories-heading">{selectedCategory?.label || (filters.query.trim() ? '検索結果' : 'すべての記事')}<span>{results.length.toLocaleString('ja-JP')}本</span></h2></div>
      <p className="sr-only mag-result-count" role="status" aria-live="polite">{results.length}件の記事が見つかりました</p>
      {results.length ? <div className="mag-grid">{pagination.items.map((article, index) => <ArticleCard article={article} key={article.slug} priority={!browse && index === 0} />)}</div> : <div className="mag-empty"><Search size={28} strokeWidth={1.2} /><h3>{articles.length ? '記事が見つかりませんでした' : '最初の記事を準備しています'}</h3><p>{articles.length ? '会社名を短くする、証券コードで探す、またはカテゴリを解除してお試しください。' : '自己分析や企業研究など、就活に役立つ読みものをお届けします。'}</p>{filtering && <a href="/magazine/" className="mag-text-link" onClick={onFilterChange ? event => { event.preventDefault(); onFilterChange({ category: '', query: '' }); } : undefined}><X size={15} />絞り込みを解除する</a>}</div>}
      {pagination.pages > 1 && <nav className="mag-pagination" aria-label="記事一覧のページ"><p>{pagination.page} / {pagination.pages} ページ</p><div>{Array.from({ length: pagination.pages }, (_, index) => index + 1).filter(number => number === 1 || number === pagination.pages || Math.abs(number - pagination.page) <= 2).map(number => {
        const params = new URLSearchParams();
        if (filters.category) params.set('category', filters.category);
        if (filters.query) params.set('q', filters.query);
        if (filters.industry) params.set('industry', filters.industry);
        if (filters.order) params.set('order', filters.order);
        if (filtering && number > 1) params.set('page', String(number));
        const href = (filtering ? '/magazine/?' + params : magazinePagePath(number)) + '#stories';
        return <a key={number} href={href} aria-current={number === pagination.page ? 'page' : undefined} onClick={filtering && onFilterChange ? event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onFilterChange({ ...filters, page: number }); document.getElementById('stories')?.scrollIntoView(); } : undefined}>{number}</a>;
      })}</div></nav>}
      </>}
    </section>
    <ProductCallout />
  </main>;
}

function ProductCallout({ article }: { article?: ArticleSummary }) {
  const name = article && companyName(article);
  const webLabel = name ? `Web版で${name}のメモを作る` : article?.category === 'es' ? 'Web版でESの下書きメモを作る' : article ? 'Web版でこの記事のメモを作る' : 'Web版を試す';
  return <aside className="mag-callout" aria-label="記事をアプリでの就活準備に活かす"><div><h2>{article ? '読んで気づいたことを、アプリのメモへ。' : '企業研究も、次の締切も。PCのアプリで。'}</h2><p>{article ? '企業研究で気づいたことや、自分の経験との接点を、Mac・Windowsアプリに書き残しましょう。この記事を参考に、ES・面接の準備を進められます。' : 'Mac・Windowsアプリで、企業ごとのメモと選考の進捗をひとつの場所に。'}<br />無料で利用できます。Googleログインは任意です。</p></div><div>{article ? <DesktopResearchLink article={article} primary /> : <a className="mag-button" href="/#download">Mac・Windows版を入手</a>}<a className="mag-text-link" href="/#download">Mac・Windows版をダウンロード</a><a className="mag-text-link" href="/#start">アプリのはじめ方を見る</a><a className="mag-text-link mag-web-alternative" href={article ? '/app/?article='+article.slug : '/app/'}>{webLabel}</a></div></aside>;
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

// Emphasize only explicit labels already present in the manuscript; preserve its text.
function ArticleText({ text, listItem = false }: { text: string; listItem?: boolean }) {
  const label = text.match(/^【[^】\n]{1,48}】/)?.[0]
    || (listItem ? text.match(/^[^：\n。！？]{1,48}：/)?.[0] : undefined);
  return label ? <><strong className="mag-label-emphasis">{label}</strong>{text.slice(label.length)}</> : <>{text}</>;
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
  const resume = useReadingProgress(article,active);
  const related = relatedArticles(article, articles);
  const industryRelated = article.companyIndustry && article.companyIndustry !== '未分類' ? related.filter(item => item.companyIndustry === article.companyIndustry && companyName(item)) : [];
  const nextSteps = related.filter(item => !companyName(item) && ['es','interview'].includes(item.category));
  const otherRelated = related.filter(item => !industryRelated.includes(item) && !nextSteps.includes(item));
  return <main id="mag-main" className="mag-shell mag-reader">
    <div className="mag-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
    <nav className="mag-breadcrumbs" aria-label="パンくずリスト"><a href="/">ホーム</a><span>/</span><a href="/magazine/">マガジン</a></nav>
    <article ref={ref}>
      <header className="mag-article-header"><a className="mag-category" href={'/magazine/?category=' + article.category}>{categoryOf(article).label}</a><div className="mag-byline"><a href="/magazine/#editorial">{article.author}</a><time dateTime={article.datePublished}>{formatDate(article.datePublished)} 公開</time>{article.dateModified !== article.datePublished && <time dateTime={article.dateModified}>{formatDate(article.dateModified)} 更新</time>}<span><Clock3 size={14} />約{article.readingMinutes}分</span></div><h1>{article.title}</h1></header>
      <figure className="mag-article-cover"><ArticleCover article={article} large />{article.cover && <figcaption>
        {article.cover.source === 'ai-generated' && 'AI生成のイメージ画像'}
        {article.cover.source === 'editorial-design' && 'AI就活編集部による図版'}
        {article.cover.source === 'official-logo' && article.cover.attribution && <>ロゴの出典　<a href={article.cover.attribution.url} target="_blank" rel="noopener noreferrer">{article.cover.attribution.title}</a>
          {article.cover.attribution.author && <> ／ {article.cover.attribution.author}</>}
          {article.cover.attribution.license && <> ／ <a href={article.cover.attribution.license.url} target="_blank" rel="noopener noreferrer">{article.cover.attribution.license.title}</a></>}
          {article.cover.attribution.modifications && <> ／ {article.cover.attribution.modifications}</>}
        </>}
      </figcaption>}</figure>
      <div className="mag-reading-layout">
        <div className="mag-body">
          {resume}
          <p className="mag-lead">{article.lead}</p>
          <aside className="mag-takeaways" aria-label="この記事でわかること"><h2>この記事でわかること</h2><ul>{article.sections.slice(0,3).map(section => <li key={section.id}><a href={'#section-'+section.id}>{section.heading}</a></li>)}</ul></aside>
          <ArticleActions article={article} />
          <details id="article-toc" className="mag-inline-toc">
            <summary>この記事の目次 <span className="mag-toc-count">{article.sections.length}項目</span><ChevronDown size={18} aria-hidden="true" /></summary>
            <nav aria-label="記事冒頭の目次"><TableOfContents article={article} active={active} /></nav>
          </details>
        {article.sections.map((section, index) => <section id={'section-' + section.id} key={section.id}><h2>{section.heading}</h2>{section.blocks.map((block, i) => block.type === 'list' ? <ul key={i}>{block.items!.map((item, j) => <li key={j}><ArticleText text={item} listItem /></li>)}</ul> : block.type === 'note' ? <aside className="mag-note" key={i}>{block.text}</aside> : block.type === 'quote' ? <blockquote key={i}>{block.text}</blockquote> : <p key={i}><ArticleText text={block.text || ''} /></p>)}{index % 3 === 2 && <a className="mag-text-link mag-return-toc" href="#article-toc">目次に戻る</a>}</section>)}
        {article.sources.length > 0 && <section id="article-sources" className="mag-sources"><h2>参考資料</h2><p className="mag-source-policy">資料に基づく解説です。採用条件・募集状況は企業の最新の公式情報をご確認ください。</p><ul>{article.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul></section>}
        {article.writingAssistance && <p className="mag-writing-credit">{article.writingAssistance}</p>}<div className="mag-article-tags">{article.tags.map(tag => <a href={'/magazine/?q=' + encodeURIComponent(tag)} key={tag}>#{tag}</a>)}</div><a className="mag-text-link" href="/#contact">記事の誤りを連絡する</a><ShareButton article={article} /><a className="mag-text-link mag-back" href="/magazine/"><ArrowLeft size={16} />記事一覧に戻る</a>
      </div><aside className="mag-desktop-toc"><nav aria-label="この記事の目次"><TableOfContents article={article} active={active} /></nav></aside></div>
    </article>
    {[[industryRelated, '同じ業界の企業を読み比べる'], [otherRelated.slice(0,3), '関連する記事'], [nextSteps, '研究の次に、ES・面接の準備へ']].map(([items,label]) => (items as ArticleSummary[]).length > 0 && <section className="mag-related" key={label as string} aria-label={label as string}><div className="mag-section-head"><h2>{label as string}</h2><a className="mag-text-link" href="/magazine/">記事一覧</a></div><div className="mag-grid">{(items as ArticleSummary[]).map(item => <ArticleCard key={item.slug} article={item} />)}</div></section>)}
    <ProductCallout article={article} />
    <details className="mag-mobile-toc"><summary><span>目次</span><span>{article.sections.find(section => section.id === active)?.heading}</span><ChevronDown size={16} /></summary><nav aria-label="読み進めながら使える目次" onClick={event => { if ((event.target as HTMLElement).closest('a')) (event.currentTarget.parentElement as HTMLDetailsElement).open = false; }}><TableOfContents article={article} active={active} /></nav></details>
  </main>;
}

export function MagazineView({ articles, page, article, theme = 'light', onThemeChange, filters = { category: '', query: '' }, onFilterChange, loading, failed, onRetry }: MagazineViewProps) {
  return <div className="magazine-site" data-theme={theme}><a className="mag-skip" href="#mag-main">本文に進む</a><WebsiteHeader theme={theme} onThemeChange={onThemeChange} magazine />
    {page === 'index' ? <MagazineIndex articles={articles} filters={filters} onFilterChange={onFilterChange} /> : page === 'article' && article ? <ArticleReader article={article} articles={articles} /> : <main className="mag-shell mag-empty mag-page-state" id="mag-main" aria-busy={loading || undefined}><h1>{loading ? '記事を読み込んでいます' : failed ? '記事を読み込めませんでした' : 'ページが見つかりません'}</h1><p>{loading ? 'もう少しお待ちください。' : failed ? '通信状況を確認して、もう一度お試しください。' : 'URLをご確認いただくか、記事一覧からお探しください。'}</p>{failed && <button className="mag-button" type="button" onClick={onRetry}>もう一度読み込む</button>}<a className="mag-text-link" href="/magazine/"><ArrowLeft size={16} />マガジンに戻る</a>{!loading && !failed && <a className="mag-text-link" href="/">トップへ戻る</a>}</main>}
    <footer className="mag-footer" id="editorial"><div className="mag-shell"><a className="mag-brand" href="/">AI就活<span className="mag-brand-journal">マガジン</span></a><p>考える、書く、一歩進む。</p><p>運営：AI就活。記事ごとの執筆補助と参考資料は本文末尾に記載しています。</p><details className="mag-editorial-policy"><summary>編集方針・更新日の考え方</summary><p>公開日は記事を公開した日、更新日は内容を修正した日です。デザインの変更では記事の更新日を変更しません。情報確認日の記録がない記事には、確認済みの日付を表示しません。記事ごとの参考資料と執筆補助を明示しています。</p><a href="/#contact">記事の誤り・修正の連絡</a></details><nav aria-label="フッターナビゲーション"><a href="/magazine/">マガジン</a><a href="/#features">AI就活について</a><a href="/#download">ダウンロード</a><a href="/#privacy">プライバシーポリシー</a><a href="/#contact">お問い合わせ</a></nav><small>© {new Date().getFullYear()} AIshukatsu</small></div></footer>
  </div>;
}
