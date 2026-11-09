import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {ArrowDownToLine,Check,RefreshCw,X} from 'lucide-react';
import {isTauri} from '../lib/tauriFsaShim';
import {AppUpdaterController,updatePercent} from '../lib/appUpdater';
import {desktopUpdater} from '../lib/desktopUpdater';
import {getUpdateWork,type UpdateWork} from '../lib/updateWork';
import {pendingSaves} from '../lib/saveQueue';
import {usePreferences} from '../lib/preferences';
import {Modal} from './ui/Modal';
import './app-updater.css';

export function AppUpdateTrigger(){
 const state=useSyncExternalStore(desktopUpdater.subscribe,desktopUpdater.getSnapshot);
 if(!isTauri())return null;
 const active=!!state.info.version;
 const label=state.phase==='ready'?'更新の準備完了':state.phase==='downloading'?'更新をダウンロード中':active?`v${state.info.version}に更新できます`:'アプリの更新';
 return <button className={`app-rail-update ${active?'has-update':''}`} title={label} aria-label={label} onClick={()=>window.dispatchEvent(new Event('aishukatsu-check-update'))}><RefreshCw size={22} strokeWidth={1.65}/><span>更新</span>{active&&<i aria-hidden="true"/>}</button>;
}

/** One controller, shared by the rail, native menu, and the login screen. */
export function UpdateBanner({controller,previewTrigger=false}:{controller?:AppUpdaterController;previewTrigger?:boolean}={}){
 const service=controller??desktopUpdater;
 const state=useSyncExternalStore(service.subscribe,service.getSnapshot);
 const preferences=usePreferences();
 const [open,setOpen]=useState(false),[resume,setResume]=useState(false),[blockers,setBlockers]=useState<UpdateWork[]>([]);
 const openRef=useRef(open);openRef.current=open;
 const desktop=!!controller||isTauri();
 const locked=state.phase==='saving'||state.phase==='installing';
 const percent=updatePercent(state.progress);
 const show=()=>{setOpen(true);setResume(false);if(['idle','current'].includes(service.getSnapshot().phase))void service.check();};
 useEffect(()=>{
  if(!desktop)return;
  const manual=()=>show();
  window.addEventListener('aishukatsu-check-update',manual);
  let dispose:(()=>void)|undefined,cancelled=false;
  if(isTauri())void import('@tauri-apps/api/event').then(async({listen})=>{const stop=await listen('aishukatsu-open-updates',manual);if(cancelled)stop();else dispose=stop;});
  const refresh=()=>{const current=service.getSnapshot();if(!openRef.current&&document.visibilityState!=='hidden'&&Date.now()-(current.checkedAt??0)>15*60_000)void service.check();};
  const timer=setTimeout(refresh,12000),interval=setInterval(refresh,30*60_000);
  window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
  return()=>{cancelled=true;dispose?.();clearTimeout(timer);clearInterval(interval);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('aishukatsu-check-update',manual);};
 },[desktop,service]);
 if(!desktop)return null;
 const close=()=>{if(!locked)setOpen(false);};
 const install=async()=>{
  await service.install();
  if(service.getSnapshot().phase==='ready'&&service.getSnapshot().error){
   const drafts=getUpdateWork();
   const writers=pendingSaves().map((writer,index)=>({key:`save-${index}`,label:writer.documentLabel??'就活表・資料の保存'}));
   setBlockers([...drafts,...writers]);
  }else setBlockers([]);
 };
 const version=state.info.version;
 return <>
  <div className={`app-theme update-outside-trigger ${previewTrigger?'update-preview-trigger':''}`} data-theme={preferences.theme}><button className={`app-update-trigger ${version?'has-update':''}`} onClick={show}><RefreshCw size={16}/>{previewTrigger?'更新画面のプレビュー':version?'更新があります':'アプリの更新'}</button></div>
  {resume&&<div className="app-theme update-return" data-theme={preferences.theme}><button className="app-update-trigger has-update" onClick={show}><RefreshCw size={15}/>更新に戻る</button></div>}
  <Modal open={open} onClose={close} ariaLabel="アプリの更新" className="app-update-dialog">
   <div className="app-update-heading"><span className="app-update-symbol"><ArrowDownToLine size={24}/></span><button className="app-icon" aria-label="更新画面を閉じる" disabled={locked} onClick={close}><X size={19}/></button></div>
   <h2>AI就活を最新に</h2><p className="app-update-version">現在のバージョン {state.info.currentVersion}</p>
   <div className="app-update-status" aria-live="polite">
    {state.phase==='idle'&&!state.error&&<p>利用できる更新を確認できます。</p>}
    {state.phase==='checking'&&<p><RefreshCw className="app-update-spin" size={16}/>更新を確認しています…</p>}
    {state.phase==='current'&&<p><Check size={18}/>最新バージョンです。</p>}
    {version&&<><h3>バージョン {version}</h3>{state.info.notes&&<p className="app-update-notes">{state.info.notes}</p>}</>}
    {state.phase==='downloading'&&<div><p>{state.progress?.verifying?'更新ファイルを確認しています…':'ダウンロードしています…'}{percent!==null&&` ${percent}%`}</p><progress max={100} value={percent??undefined} aria-label="更新のダウンロード"/><small>この画面を閉じて作業を続けられます。</small></div>}
    {state.phase==='ready'&&<p>ダウンロードが完了しました。変更を保存してから更新し、アプリを再起動します。</p>}
    {state.phase==='saving'&&<p>変更を端末に保存しています…</p>}
    {state.phase==='installing'&&<p>更新を適用しています。再起動までお待ちください…</p>}
   </div>
   {state.error&&<p className="app-update-error" role="alert">{state.error}</p>}
   {!!blockers.length&&<div className="update-work-list"><strong>先に保存・確認が必要な作業</strong>{blockers.map((work,index)=><button key={`${work.key}-${index}`} onClick={()=>{setOpen(false);setResume(true);work.reveal?.();}}>{work.label}<span>編集に戻る →</span></button>)}</div>}
   <div className="app-update-actions">
    {['idle','current'].includes(state.phase)&&<button className="app-button primary" onClick={()=>void service.check()}>更新を確認</button>}
    {state.phase==='available'&&<button className="app-button primary" onClick={()=>void service.download()}><ArrowDownToLine size={17}/>更新をダウンロード</button>}
    {state.phase==='ready'&&<button className="app-button primary" onClick={()=>void install()}><RefreshCw size={17}/>更新して再起動</button>}
    {!locked&&<button className="app-button" onClick={close}>閉じる</button>}
   </div>
  </Modal>
 </>;
}
