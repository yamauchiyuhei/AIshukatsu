import { useEffect, useState } from 'react';
import { validateArticle, isSlug } from '../magazine/schema.mjs';
import { articleMemo, companyName } from '../magazine/discovery.mjs';
import type { Article } from '../magazine/types';
import { fileExists, writeTextFile } from '../lib/fs';
import { flushAllSaves } from '../lib/saveQueue';
import { isTauri } from '../lib/tauriFsaShim';
import { useIncomingArticle } from '../hooks/useIncomingArticle';
import { ARTICLE_ORIGIN } from '../lib/researchLinks.mjs';

export function ArticleMemoImport({ root, onOpen }: { root: FileSystemDirectoryHandle; onOpen: (file: FileSystemFileHandle, name: string) => Promise<void> }) {
  const {request,complete} = useIncomingArticle();
  const slug = request?.slug || '';
  const [article,setArticle] = useState<Article|null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    setArticle(null);setError('');
    if (!request) return;
    if (!isSlug(slug)) { setError('記事のURLをご確認ください。'); return; }
    const controller = new AbortController();
    const load = async () => {
      if (isTauri()) {
        const {invoke} = await import('@tauri-apps/api/core');
        return invoke<unknown>('load_public_article',{slug});
      }
      const response = await fetch('/magazine/articles/'+slug+'.json',{signal:controller.signal});
      if (!response.ok) throw new Error('公開記事を読み込めませんでした。');
      return response.json();
    };
    void load().then(value => {
      const data = value as Article;
      if (data?.slug !== slug || data?.status !== 'published' || validateArticle(data).length) throw new Error('公開記事を確認できませんでした。');
      if (!controller.signal.aborted) setArticle(data);
    }).catch(error => { if (!controller.signal.aborted) setError(typeof error === 'string' ? error : error instanceof Error ? error.message : '記事を読み込めませんでした。接続を確認して再試行してください。'); });
    return () => controller.abort();
  },[request?.id,slug,attempt]);
  if (!request) return null;
  const source = ARTICLE_ORIGIN+'/magazine/'+slug+'/';
  return <section aria-label="記事からメモを作成" className="shrink-0 border-b border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-900">
    <div className="flex flex-wrap items-start justify-between gap-3"><div>
      <h2 className="font-bold">{article ? (companyName(article) || 'この記事')+'のメモを作る' : '記事の引き継ぎ'}</h2>
      <p className="mt-1">{article ? '記事名とURL、自分で書き込める見出しを用意します。同名のメモがあれば、そのまま開きます。' : error ? '記事を確認できませんでした。' : '公開記事を確認しています。'}</p>
      <p className="mt-1">保存先：<strong>{root.name} / 記事メモ</strong></p>
      {article && <a className="mt-2 inline-block underline" href={source} onClick={isTauri() ? event => { event.preventDefault(); void import('@tauri-apps/plugin-shell').then(({open}) => open(source)).catch(() => setError('参考記事をブラウザで開けませんでした。')); } : undefined}>{article.title}</a>}
    </div><button type="button" disabled={busy} className="min-h-11 px-3 underline disabled:opacity-50" onClick={() => complete(request.id)}>今回は作成しない</button></div>
    {article && <div className="mt-3 flex flex-wrap items-center gap-4"><button type="button" disabled={busy} className="min-h-11 rounded-lg bg-indigo-700 px-4 py-2 font-medium text-white disabled:opacity-50" onClick={async () => {
      setBusy(true);setError('');
      try {
        await flushAllSaves();
        const dir = await root.getDirectoryHandle('記事メモ',{create:true});
        const name = article.slug+'.md';
        if (!await fileExists(dir,name)) await writeTextFile(dir,name,articleMemo(article));
        const file = await dir.getFileHandle(name);
        await onOpen(file,name);
        complete(request.id);
      } catch { setError('メモを開けませんでした。保存フォルダの権限と空き容量を確認して、もう一度お試しください。'); }
      finally { setBusy(false); }
    }}>{busy ? 'メモを準備中…' : 'メモを作成・開く'}</button><span className="text-xs text-slate-600">ボタンを押すまでファイルは作成しません。</span></div>}
    {error && <p role="alert" className="mt-2 text-rose-700">{error}{!article && isSlug(slug) && <button type="button" className="ml-3 min-h-11 underline" onClick={() => setAttempt(value => value+1)}>再試行</button>}</p>}
  </section>;
}
