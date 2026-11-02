import { SaveQueue } from '../lib/saveQueue';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Code2, Eye, Redo2, Undo2 } from 'lucide-react';
import { get, set, del } from 'idb-keyval';
import { MarkdownEditor, MarkdownEditorHandle } from './MarkdownEditor';
import { Breadcrumb } from './Breadcrumb';
import { useAutoSave } from '../hooks/useAutoSave';
import { useSheet } from '../spreadsheet/lib/store';
import { pullNote, pushNote, type PullNoteResult } from '../lib/markdownCloudSync';
import { getPreferences, platformShortcut, usePreferences } from '../lib/preferences';
import { downloadBlob } from '../lib/download';
interface Props {
  fileHandle: FileSystemFileHandle;
  /** Stable identifier so the editor remounts when the file changes. */
  fileKey: string;
  documentIdentity?: string;
  /** File name (e.g. `業界研究.md`), used for Firestore metadata. */
  label: string;
  /** Ancestor labels (e.g. `['IT・通信', 'DeNA']`), used for Firestore metadata. */
  breadcrumb: string[];
  /** Workspace root label used by the optional Breadcrumb header. */
  rootName?: string;
  /** Breadcrumb click handler: -1 = root, else 0-based segment index. */
  onNavigate?: (index: number) => void;
}


export function MarkdownPage({ fileHandle, fileKey, documentIdentity = fileKey, label, breadcrumb, rootName, onNavigate }: Props) {
  const [body, setBody] = useState('');
  const bodyRef = useRef('');
  const localRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [reload, setReload] = useState(0);
  const [cloudState, setCloudState] = useState('クラウド自動保存はオフ');
  const [cloudConflict, setCloudConflict] = useState<PullNoteResult | null>(null);
  const conflictRef = useRef<PullNoteResult | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const sourceRef=useRef<HTMLTextAreaElement|null>(null);
  const captureRef=useRef<()=>void>(()=>{});
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const user = useSheet(s => s.user);
  const passphrase = useSheet(s => s.passphrase);
  const preferences = usePreferences();
  const documentOwner = useRef(user?.uid ?? 'local-guest');
  const draftKey = `aishukatsu-draft:${documentOwner.current}:${rootName}:${fileKey}`;
  const active = useRef({ fileHandle, fileKey, label, breadcrumb, user, passphrase, draftKey });
  active.current = { fileHandle, fileKey, label, breadcrumb, user, passphrase, draftKey };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const cloudQueue = useRef<SaveQueue>();
  const cloudRequest = useRef(0);
  if (!cloudQueue.current) cloudQueue.current = new SaveQueue(async encoded => {
    const payload = JSON.parse(encoded);
    const current = () => mounted.current && active.current.user?.uid === payload.uid && active.current.fileKey === payload.fileKey && cloudRequest.current === payload.request;
    if (current()) setCloudState('クラウドへ保存中…');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      timer=setTimeout(()=>{if(current())setCloudState('クラウド応答待ち・端末には保存済み');},12000);
      await pushNote(payload);
      if (current()) setCloudState('クラウド保存済み');
    } catch (error) {
      if (mounted.current && active.current.user?.uid===payload.uid) setCloudState('クラウド保存失敗・端末には保存済み');
      throw error;
    } finally { if(timer)clearTimeout(timer); }
  });
  const saveCloud = async (value: string) => {
    const state = active.current;
    if (!state.user || state.user.uid !== documentOwner.current || !getPreferences().cloudDocuments) return;
    if (conflictRef.current) { if (mounted.current) setCloudState('別の版があります。端末の変更は保存済み'); return; }
    cloudQueue.current!.set(JSON.stringify({ uid:state.user.uid,fileKey:state.fileKey,label:state.label,breadcrumb:state.breadcrumb,content:value,passphrase:state.passphrase,request:++cloudRequest.current }));
    await cloudQueue.current!.flush().catch(()=>{});
  };
  useEffect(()=>{const retry=()=>{if(cloudQueue.current?.dirty)void cloudQueue.current.flush().catch(()=>{});};window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry);},[]);
  const { state, schedule, flush, discard } = useAutoSave({ documentKey:documentIdentity,documentLabel:label,owner:documentOwner.current, onBeforeSave:()=>captureRef.current(), onSave: async value => {
    const target = active.current;
    if (localRef.current === null) throw new Error('読み込みが完了していません');
    const disk = await (await target.fileHandle.getFile()).text();
    if (disk !== localRef.current && disk !== value) throw new Error('外部で変更されています。再読み込み前に下書きを書き出してください。');
    const writable = await target.fileHandle.createWritable();
    await writable.write(value); await writable.close();
    localRef.current = value;
    if (bodyRef.current === value) await del(target.draftKey);
    window.dispatchEvent(new Event('aishukatsu-document-saved'));
    // Cloud failures have their own state and must not misreport local writes.
    void saveCloud(value);
  }});
  const handleChange = useCallback((value: string) => {
    if (value === bodyRef.current) return;
    bodyRef.current = value; if(mounted.current)setBody(value);
    void set(active.current.draftKey, value).catch(() => {});
    schedule(value);
  }, [schedule]);

  captureRef.current=()=>{if(loading||loadError)return;if(sourceRef.current)handleChange(sourceRef.current.value);else editorRef.current?.flushChanges();};
  useEffect(() => {
    let cancelled = false;
    localRef.current = null; setLoading(true); setLoadError(null); setDraft(null);
    setCloudConflict(null); conflictRef.current = null;
    void (async () => {
      try {
        const file = await fileHandle.getFile();
        const text = await file.text();
        const savedDraft = await get<string>(draftKey);
        if (cancelled) return;
        localRef.current = text; bodyRef.current = text; setBody(text);
        if (savedDraft != null && savedDraft !== text) setDraft(savedDraft);
      } catch {
        if (!cancelled) setLoadError('文書を読み込めません。保存先の権限やファイルの場所を確認してください。読み込めるまで編集は行いません。');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [documentIdentity, user?.uid, reload]);

  useEffect(() => {
    if (!user || !preferences.cloudDocuments || loading || loadError) { setCloudState('クラウド自動保存はオフ'); return; }
    let cancelled = false;
    setCloudState('クラウドを確認中…');
    void pullNote(user.uid, fileKey, passphrase).then(result => {
      if (cancelled) return;
      if (result?.decryptFailed) { setCloudState('合言葉を確認してください・端末の文書を使用中'); return; }
      if (result && result.content !== localRef.current) {
        conflictRef.current = result; setCloudConflict(result); setCloudState('クラウドに別の版があります');
      } else if (result) setCloudState('クラウドと一致');
      else setCloudState('未送信・編集時に自動保存します');
    }).catch(() => { if (!cancelled) setCloudState('クラウドに接続できません・端末の文書を使用中'); });
    return () => { cancelled = true; };
  }, [user?.uid, preferences.cloudDocuments, passphrase, fileKey, loading, loadError]);

  useEffect(()=>{const check=async()=>{if(loading||loadError||localRef.current===null||state==='dirty'||state==='saving'||state==='error')return;try{const text=await (await active.current.fileHandle.getFile()).text();if(mounted.current&&text!==localRef.current){setReload(n=>n+1);}}catch{if(mounted.current)setLoadError('文書へのアクセスが失われました。フォルダの接続を確認してください。');}};window.addEventListener('focus',check);return()=>window.removeEventListener('focus',check);},[loading,loadError,state]);
  const labels = { idle: '変更なし', dirty: '端末：未保存', saving: '端末：保存中…', saved: '端末：保存済み', error: '端末：保存できませんでした' };
  const reloadFromDisk = async () => {
    // Preserve the draft before abandoning a conflicting file version.
    if (state === 'dirty' || state === 'error') await set(draftKey, bodyRef.current);
    await discard();
    setReload(n => n + 1);
  };
  return <div className="flex h-full flex-col overflow-hidden bg-white">
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2">
      <button disabled={!history.canUndo || viewMode === 'source'} onClick={() => editorRef.current?.undo()} title={`元に戻す (${platformShortcut('Z')})`} aria-label="文書の変更を元に戻す"><Undo2 size={18}/></button>
      <button disabled={!history.canRedo || viewMode === 'source'} onClick={() => editorRef.current?.redo()} title={`やり直す (${platformShortcut('Shift+Z')})`} aria-label="文書の変更をやり直す"><Redo2 size={18}/></button>
      <span className="text-xs text-slate-600" role="status" aria-live="polite">{labels[state]}</span>
      <span className="text-xs text-slate-500">{cloudState}</span>
      {state === 'error' && <><button className="text-sm text-rose-700 underline" onClick={() => void flush().catch(() => {})}>保存を再試行</button><button className="text-sm underline" onClick={() => void downloadBlob(new Blob([body]), `${label}.下書き.md`)}>下書きを書き出す</button><button className="text-sm underline" onClick={() => void reloadFromDisk()}>外部の変更を読み込む</button></>}
      {(cloudState.includes('失敗') || cloudState.includes('未送信')) && <button className="text-sm underline" onClick={() => void saveCloud(body)}>クラウドへ再送信</button>}
      <button className="ml-auto inline-flex items-center gap-1 text-sm" onClick={() => setViewMode(mode => mode === 'preview' ? 'source' : 'preview')}>{viewMode === 'preview' ? <><Code2 size={15}/>ソース編集</> : <><Eye size={15}/>プレビュー</>}</button>
    </div>
    {rootName && onNavigate && <Breadcrumb segments={[...breadcrumb,label]} rootLabel={rootName} onNavigate={onNavigate}/>}
    {draft !== null && <div className="flex flex-wrap items-center gap-3 bg-amber-50 p-3 text-sm" role="status">未保存の下書きがあります。<button className="underline" onClick={() => { handleChange(draft); setEditorRevision(n=>n+1); setDraft(null); }}>下書きを復元</button><button className="underline" onClick={() => { void del(draftKey); setDraft(null); }}>下書きを破棄</button></div>}
    {cloudConflict && <div className="flex flex-wrap gap-3 bg-blue-50 p-3 text-sm"><span>クラウドに別の版があります。自動上書きを停止しています。</span><button className="underline" onClick={() => void downloadBlob(new Blob([cloudConflict.content]), `${label}.クラウド版.md`)}>クラウド版を確認</button><button className="underline" onClick={() => { conflictRef.current = null; const content = cloudConflict.content; setCloudConflict(null); handleChange(content); setEditorRevision(n=>n+1); }}>クラウド版を採用</button><button className="underline" onClick={() => { conflictRef.current = null; setCloudConflict(null); void saveCloud(body); }}>端末の版をクラウドへ保存</button></div>}
    <div className="relative flex-1 overflow-auto px-6 py-6 md:px-10">
      {loading ? <p role="status">読み込み中…</p> : loadError ? <div role="alert" className="space-y-4 text-rose-700"><p>{loadError}</p><button onClick={() => setReload(n => n + 1)} className="underline">読み込みを再試行</button></div> : viewMode === 'source' ? <textarea ref={sourceRef} aria-label={`${label}のMarkdownソース`} className="markdown-source h-full min-h-80 w-full font-mono text-sm leading-relaxed" value={body} onChange={event => handleChange(event.target.value)} spellCheck={false}/> : <MarkdownEditor key={`${documentIdentity}:${reload}:${editorRevision}`} ref={editorRef} resetKey={`${documentIdentity}:${reload}:${editorRevision}`} initialValue={body} onChange={handleChange} onHistoryChange={setHistory}/>}
    </div>
  </div>;
}
