import { useEffect, useState } from 'react';
import { Bookmark, Check, Columns2 } from 'lucide-react';
import type { Article, ArticleSummary } from './types';
import { companyName } from './discovery.mjs';
import { editLibrary, readLibrary, toggleReadingRecord, useReadingList, visitArticle } from './readingList';

export function ArticleActions({ article }: {article: ArticleSummary}) {
  const library = useReadingList();
  const [message, setMessage] = useState('');
  const saved = library.saved.some(item => item.slug === article.slug);
  const compared = library.compare.some(item => item.slug === article.slug);
  return <div className="mag-reader-actions"><button type="button" aria-pressed={saved} onClick={() => setMessage(toggleReadingRecord('saved', article) ? saved ? '保存を解除しました' : 'この端末に保存しました' : 'この端末では保存できません。ブラウザの設定をご確認ください。')}>{saved ? <Check size={16} /> : <Bookmark size={16} />}{saved ? '保存済み' : 'あとで読む'}</button>{companyName(article) && <button type="button" aria-pressed={compared} disabled={!compared && library.compare.length >= 3} onClick={() => setMessage(toggleReadingRecord('compare',article) ? compared ? '比較候補から外しました' : '比較候補に追加しました' : 'この端末では保存できません。')}><Columns2 size={16} />{compared ? '比較候補から外す' : '比較候補に追加'}</button>}<a href="/magazine/?collection=compare#stories">比較候補を見る{library.compare.length ? `（${library.compare.length}/3）` : ''}</a><span role="status">{message}</span>{companyName(article) && library.compare.length >= 3 && !compared && <small>比較候補は3社までです。候補一覧で外すと追加できます。</small>}</div>;
}
export function ReadingLibrary({ collection, articles }: {collection?: string; articles: ArticleSummary[]}) {
  const library = useReadingList();
  const [message, setMessage] = useState('');
  if (!collection) return null;
  const kind = collection === 'history' ? 'history' : collection === 'compare' ? 'compare' : 'saved';
  const available = new Set(articles.map(item => item.slug));
  const items = library[kind].filter(item => available.has(item.slug));
  return <section className="mag-library" aria-labelledby="reading-library-heading"><div className="mag-section-head"><h2 id="reading-library-heading">{kind === 'history' ? '最近読んだ記事' : kind === 'compare' ? '企業の比較候補' : 'あとで読む'}</h2><button type="button" className="mag-text-link" disabled={!library[kind].length} onClick={() => setMessage(editLibrary(value => ({...value, [kind]: []})) ? '一覧を消去しました' : '消去できませんでした。ブラウザの設定をご確認ください。')}>この一覧を消去</button></div>
    <p>このブラウザだけに保存します（あとで読む60件・履歴30件・比較3社まで）。別の端末とは同期しません。ブラウザのデータを消すと、この一覧も消えます。</p>
    {!items.length ? <p className="mag-library-empty">{kind === 'compare' ? '企業の記事で「比較候補に追加」を押すと、3社まで並べて確認できます。' : kind === 'history' ? '記事を開くと、ここに表示されます。' : '記事の「あとで読む」を押すと、ここに表示されます。'}</p> : kind === 'compare' ? <div className="mag-comparison" tabIndex={0} role="region" aria-label="企業の比較候補。横にスクロールできます"><table><caption>事業・仕事の違いを読み比べるための候補一覧</caption><thead><tr><th scope="col">企業</th>{items.map(item => <th scope="col" key={item.slug}><a href={'/magazine/'+item.slug+'/'}>{companyName(item)}</a></th>)}</tr></thead><tbody><tr><th scope="row">業界</th>{items.map(item => <td key={item.slug}>{item.companyIndustry || '未分類'}</td>)}</tr><tr><th scope="row">記事の内容</th>{items.map(item => <td key={item.slug}>{item.description}</td>)}</tr><tr><th scope="row">研究メモ</th>{items.map(item => <td key={item.slug}><a href={'/app/?article='+item.slug}>メモを作る</a></td>)}</tr><tr><th scope="row">候補の管理</th>{items.map(item => <td key={item.slug}><button type="button" onClick={() => setMessage(toggleReadingRecord('compare',item) ? '比較候補から外しました' : '変更できませんでした。')} aria-label={companyName(item)+'を比較候補から外す'}>外す</button></td>)}</tr></tbody></table></div> : <ul>{items.map(item => <li key={item.slug}><a href={'/magazine/'+item.slug+'/'+(kind === 'history' && item.section ? '#section-'+item.section : '')}>{item.title}{kind === 'history' && item.section ? ' — 続きから読む' : ''}</a>{kind === 'saved' && <button type="button" onClick={() => setMessage(toggleReadingRecord('saved',item) ? '保存を解除しました' : '変更できませんでした。')} aria-label={item.title+'の保存を解除'}>解除</button>}</li>)}</ul>}<p role="status">{message}</p>
  </section>;
}
export function useReadingProgress(article: Article, active: string) {
  const [resume, setResume] = useState('');
  useEffect(() => {
    try { const previous = JSON.parse(localStorage.getItem('aishukatsu-reading-list-v1') || '{}').history?.find((item: {slug: string}) => item.slug === article.slug); if (!window.location.hash && article.sections.some(section => section.id === previous?.section) && previous.section !== article.sections[0]?.id) setResume(previous.section); } catch { /* reading remains available */ }
    const previous = readLibrary().history.find(item => item.slug === article.slug);
    visitArticle(article, previous?.section);
  }, [article.slug]);
  useEffect(() => {
    if (!active) return;
    let touched = false;
    const save = () => { if (touched) visitArticle(article,active); };
    const onScroll = () => { touched = true; };
    // Persist only a chapter actually read, rather than replacing a saved
    // position with the top chapter while the reader considers resuming.
    const timer = window.setTimeout(() => { if (window.scrollY > 200) { touched = true; save(); } },1000);
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('pagehide',save);
    return () => { clearTimeout(timer); save(); window.removeEventListener('scroll',onScroll); window.removeEventListener('pagehide',save); };
  }, [article.slug,active]);
  return resume ? <a className="mag-resume" href={'#section-'+resume} onClick={() => setResume('')}>前回の続きから読む：{article.sections.find(section => section.id === resume)?.heading}</a> : null;
}
