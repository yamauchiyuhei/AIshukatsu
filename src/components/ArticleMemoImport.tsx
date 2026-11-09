import { useEffect, useState } from 'react';
import { validateArticle, isSlug } from '../magazine/schema.mjs';
import { articleMemo, companyName } from '../magazine/discovery.mjs';
import type { Article } from '../magazine/types';
import { fileExists, writeTextFile } from '../lib/fs';
import { flushAllSaves } from '../lib/saveQueue';

export function ArticleMemoImport({ root, onOpen }: { root: FileSystemDirectoryHandle; onOpen: (file: FileSystemFileHandle, name: string) => Promise<void> }) {
  const [slug] = useState(() => new URLSearchParams(window.location.search).get('article') || '');
  const [article,setArticle] = useState<Article|null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [done,setDone] = useState(false);
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    if (!slug) return;
    if (!isSlug(slug)) { setError('記事のURLをご確認ください。'); return; }
    const controller = new AbortController();
    setError('');
    fetch('/magazine/articles/'+slug+'.json',{signal:controller.signal}).then(async response => {
      if (!response.ok) throw new Error('記事を読み込めませんでした。');
      const value = await response.json();
      if (value.slug !== slug || value.status !== 'published' || validateArticle(value).length) throw new Error('記事を確認できませんでした。');
      if (!controller.signal.aborted) setArticle(value);
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '記事を読み込めませんでした。'); });
    return () => controller.abort();
  },[slug,attempt]);
  if (!slug || done) return null;
  const dismiss = () => { setDone(true); const url = new URL(window.location.href);url.searchParams.delete('article');window.history.replaceState(null,'',url.pathname+url.search+url.hash); };
  return <section aria-label="記事からメモを作成" className="shrink-0 border-b border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-900">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{article ? (companyName(article) || 'この記事')+'のメモを作る' : '記事の引き継ぎ'}</h2><p className="mt-1">{article ? '記事名とURL、自分で書き込める見出しを用意します。保存先は「記事メモ」フォルダです。同名のメモがあれば、そのまま開きます。' : '記事を確認しています。'}</p>{article && <a className="mt-2 inline-block underline" href={'/magazine/'+article.slug+'/'}>{article.title}</a>}</div><button type="button" className="min-h-11 px-3 underline" onClick={dismiss}>あとで</button></div>
    {article && <div className="mt-3 flex flex-wrap items-center gap-4"><button type="button" disabled={busy} className="min-h-11 rounded-lg bg-indigo-700 px-4 py-2 font-medium text-white disabled:opacity-50" onClick={async () => {
      setBusy(true);setError('');
      try {
        await flushAllSaves();
        const dir = await root.getDirectoryHandle('記事メモ',{create:true});
        const name = article.slug+'.md';
        if (!await fileExists(dir,name)) await writeTextFile(dir,name,articleMemo(article));
        const file = await dir.getFileHandle(name);
        await onOpen(file,name);
        dismiss();
      } catch { setError('メモを開けませんでした。保存フォルダの権限と空き容量を確認して、もう一度お試しください。'); }
      finally { setBusy(false); }
    }}>{busy ? 'メモを準備中…' : 'メモを作成・開く'}</button><span className="text-xs text-slate-600">ボタンを押すまでファイルは作成しません。</span></div>}
    {error && <p role="alert" className="mt-2 text-rose-700">{error}{!article && isSlug(slug) && <button type="button" className="ml-3 min-h-11 underline" onClick={() => setAttempt(value => value+1)}>再試行</button>}</p>}
  </section>;
}
