import { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowDownToLine, CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import { isTauri } from '../lib/tauriFsaShim';
import { AppUpdaterController, updatePercent } from '../lib/appUpdater';
import { nativeUpdater } from '../lib/nativeUpdater';
import { flushAllSaves } from '../lib/saveQueue';
import { Modal } from './ui/Modal';
import packageInfo from '../../package.json';
const updater=new AppUpdaterController(nativeUpdater,flushAllSaves,packageInfo.version);
/** Mounted outside the login and workspace gates, so updates remain reachable. */
export function UpdateBanner({controller}: {controller?:AppUpdaterController}={}) {
  const service=controller??updater;
  const state=useSyncExternalStore(service.subscribe,service.getSnapshot);
  const [open,setOpen]=useState(false);
  const desktop=!!controller||isTauri();
  const locked=state.phase==='saving'||state.phase==='installing';
  const percent=updatePercent(state.progress);
  useEffect(()=>{
    const manual=()=>{if(!desktop)return;setOpen(true);if(['idle','current'].includes(service.getSnapshot().phase))void service.check();};
    window.addEventListener('aishukatsu-check-update',manual);
    let dispose:(()=>void)|undefined,cancelled=false;
    if(isTauri())void import('@tauri-apps/api/event').then(async({listen})=>{const stop=await listen('aishukatsu-open-updates',manual);if(cancelled)stop();else dispose=stop;});
    if(!desktop)return()=>window.removeEventListener('aishukatsu-check-update',manual);
    const refresh=()=>{const current=service.getSnapshot();if(document.visibilityState!=='hidden'&&Date.now()-(current.checkedAt??0)>15*60_000)void service.check();};
    const timer=setTimeout(refresh,5000),interval=setInterval(refresh,30*60_000);
    window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
    return()=>{cancelled=true;dispose?.();clearTimeout(timer);clearInterval(interval);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('aishukatsu-check-update',manual);};
  },[desktop,service]);
  if(!desktop)return null;
  const show=()=>{setOpen(true);if(state.phase==='idle')void service.check();};
  const button='rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50';
  return <>
    <footer className="workspace-app flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-white px-4 py-2 text-xs text-slate-600">
      <span>AI就活 <span className="tabular-nums">v{state.info.currentVersion}</span></span>
      <button type="button" onClick={show} className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${state.info.version?'bg-indigo-50 text-indigo-800':'hover:bg-slate-100 text-slate-700'}`}><RefreshCw size={15}/>{state.phase==='downloading'?`ダウンロード中 ${percent===null?'':percent+'%'}`:state.phase==='ready'?'更新の準備ができました':state.info.version?`v${state.info.version}に更新できます`:'アプリの更新'}</button>
    </footer>
    <Modal open={open} onClose={()=>{if(!locked)setOpen(false);}} ariaLabel="アプリの更新" className="max-w-xl space-y-5">
      <div className="flex items-start justify-between gap-3"><div><div className="mb-3 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-700"><ArrowDownToLine size={25}/></div><h2 className="text-xl font-semibold">AI就活を最新に</h2><p className="mt-2 text-sm text-slate-600">現在のバージョン：v{state.info.currentVersion}</p></div><button className={button} disabled={locked} onClick={()=>setOpen(false)}>閉じる</button></div>
      <div aria-live="polite" className="space-y-3 text-sm">
        {state.phase==='checking'&&<p className="flex items-center gap-2"><RefreshCw size={17} className="animate-spin"/>更新を確認しています…</p>}
        {state.phase==='current'&&<p className="flex items-center gap-2 text-emerald-800"><CheckCircle2 size={18}/>最新版を利用しています。</p>}
        {state.info.version&&<><h3 className="text-lg font-semibold">バージョン {state.info.version}</h3>{state.info.notes&&<div className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 leading-7">{state.info.notes}</div>}</>}
        {state.phase==='available'&&<p>アプリ内でダウンロードして更新できます。</p>}
        {state.phase==='downloading'&&<div className="space-y-3"><p>{state.progress?.verifying?'更新ファイルの署名を確認しています…':`ダウンロードしています…${percent===null?'':' '+percent+'%'}`}</p><progress aria-label="更新のダウンロード" className="h-2 w-full accent-indigo-700" max={100} value={percent??undefined}/><p className="text-slate-600">この画面を閉じて作業を続けられます。</p></div>}
        {state.phase==='ready'&&<p className="rounded-lg bg-indigo-50 p-4 leading-7 text-indigo-950">更新の準備ができました。「更新して再起動」で変更を端末に保存してから更新します。</p>}
        {state.phase==='saving'&&<p>変更を端末に保存しています…</p>}
        {state.phase==='installing'&&<p>更新を適用しています。アプリが再起動するまでお待ちください…</p>}
      </div>
      {state.error&&<div role="alert" className="space-y-2 rounded-lg bg-rose-50 p-4 text-sm leading-7 text-rose-800"><p>{state.error}</p>{state.phase==='ready'&&<button className="underline" onClick={()=>setOpen(false)}>閉じて保存状態を確認する</button>}</div>}
      <p className="flex items-center gap-2 text-xs text-slate-600"><ShieldCheck size={16}/>署名を確認できた更新ファイルだけを適用します。</p>
      <div className="flex flex-wrap justify-end gap-3">{['idle','current','available'].includes(state.phase)&&<button className={button} onClick={()=>void service.check()}>更新を再確認</button>}{state.phase==='available'&&<button className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-medium text-white" onClick={()=>void service.download()}>更新をダウンロード</button>}{state.phase==='ready'&&<><button className={button} onClick={()=>void service.download()}>再ダウンロード</button><button className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-medium text-white" onClick={()=>void service.install()}>更新して再起動</button></>}</div>
    </Modal>
  </>;
}
