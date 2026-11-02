import { useEffect, useState, useSyncExternalStore } from 'react';
import { flushAllSaves, prepareAllSaves, pendingSaves, savesRevision, subscribeSaves } from '../lib/saveQueue';
import { isTauri } from '../lib/tauriFsaShim';
import { useSheet } from '../spreadsheet/lib/store';

export function SaveStatus({onSettings}: {onSettings:()=>void}) {
  useSyncExternalStore(subscribeSaves,savesRevision);
  const pending=pendingSaves(); const failed=pending.some(writer=>writer.state==='error');
  const hydrated=useSheet(s=>s.hydrated);
  const localError=useSheet(s=>s.localError);
  const [message,setMessage]=useState(''); const [online,setOnline]=useState(navigator.onLine);
  useEffect(()=>{
    const before=(event:BeforeUnloadEvent)=>{prepareAllSaves();if(pendingSaves().length){event.preventDefault();event.returnValue='';}};
    const hide=()=>{if(document.visibilityState==='hidden')void flushAllSaves().catch(()=>{});};
    const error=()=>setMessage('変更を保存できないため、画面の切り替えを停止しました。再試行するか、下書きを退避してください。');
    const network=()=>setOnline(navigator.onLine);
    window.addEventListener('beforeunload',before);document.addEventListener('visibilitychange',hide);window.addEventListener('aishukatsu-save-error',error);window.addEventListener('online',network);window.addEventListener('offline',network);
    let unlisten: (()=>void)|undefined;let cancelled=false;let closing=false;
    if(isTauri()) void import('@tauri-apps/api/window').then(async({getCurrentWindow})=>{
      const window=getCurrentWindow();
      const cleanup=await window.onCloseRequested(async event=>{
        if(closing)return;event.preventDefault();
        try{await flushAllSaves();closing=true;await window.close();}catch{error();}
      });
      if(cancelled)cleanup();else unlisten=cleanup;
    });
    return()=>{cancelled=true;unlisten?.();window.removeEventListener('beforeunload',before);document.removeEventListener('visibilitychange',hide);window.removeEventListener('aishukatsu-save-error',error);window.removeEventListener('online',network);window.removeEventListener('offline',network);};
  },[]);
  useEffect(()=>{if(!pending.length)setMessage('');},[pending.length]);
  if(!online||failed||message||localError)return <div role={failed?'alert':'status'} className={`flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2 text-sm ${failed?'bg-rose-50 text-rose-900':'bg-amber-50 text-amber-900'}`}><span>{message||localError||(!online?'オフラインです。端末への保存は利用できます。クラウド操作は接続後に再試行してください。':'保存できない変更があります。')}</span>{failed&&<button className="underline" onClick={()=>void flushAllSaves().catch(()=>setMessage('まだ保存できません。下書きの書き出し・バックアップをご利用ください。'))}>保存を再試行</button>}<button className="underline" onClick={onSettings}>バックアップと復元</button></div>;
  return <div className="flex shrink-0 justify-end border-b bg-white px-4 py-1 text-xs text-slate-600" role="status" aria-live="polite">{!hydrated?'一覧を読み込み中…':pending.length?'端末に保存中…':'端末の変更は保存済み'}</div>;
}
