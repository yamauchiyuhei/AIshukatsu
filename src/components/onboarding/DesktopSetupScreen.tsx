import { useState } from 'react';
import { pickRootDirectory } from '../../lib/fs';
import { isTauri, TauriFileSystemDirectoryHandle } from '../../lib/tauriFsaShim';
import { readWorkspaceArchive, restoreWorkspaceArchive } from '../../lib/workspaceArchive';
import { OnboardingShell } from './LoginScreen';

interface Props { onReady: (handle: FileSystemDirectoryHandle, existing?: boolean) => void; }
export function DesktopSetupScreen({onReady}: Props) {
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [picked,setPicked]=useState<FileSystemDirectoryHandle|null>(null);const [existing,setExisting]=useState(false);
  const [archive,setArchive]=useState<Record<string,Uint8Array>|null>(null);const [message,setMessage]=useState('');
  const supported=isTauri()||typeof window.showDirectoryPicker==='function';
  const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action();}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setError('保存先を開けません。フォルダのアクセス権を確認し、別のフォルダを選択してください。');}finally{setBusy(false);}};
  const choose=async(create:boolean)=>{
    let directory:FileSystemDirectoryHandle;
    if(create&&isTauri()){
      const {invoke}=await import('@tauri-apps/api/core');const path=await invoke<string|null>('pick_workspace_directory',{create:true});
      if(!path)return;directory=new TauriFileSystemDirectoryHandle(path) as unknown as FileSystemDirectoryHandle;
    }else{
      const parent=await pickRootDirectory({startIn:'documents'});
      directory=create&&parent.name!=='AI就活'?await parent.getDirectoryHandle('AI就活',{create:true}):parent;
    }
    setPicked(directory);setExisting(!create);setMessage('フォルダを確認して、下のボタンから続けてください。');
  };
  const button='w-full rounded-xl border border-slate-300 bg-white p-4 text-left text-sm hover:border-indigo-500 disabled:opacity-40';
  return <OnboardingShell step={1} total={4}>
    <h1 className="text-2xl font-bold">就活データの保存先を選択</h1><p className="mt-3 text-sm leading-6 text-slate-600">新しく始める方も、以前のデータを使う方もここから進めます。旧ドメインから移行する場合は、以前のフォルダを選んでください。</p>
    {!supported&&<div role="alert" className="mt-5 rounded bg-amber-50 p-4 text-sm text-amber-900">このブラウザでは保存フォルダを開けません。Chrome・Edge、またはMac・Windows版をご利用ください。<a className="ml-2 underline" href="https://aishukatsu.net/#download">ダウンロード案内</a></div>}
    <div className="mt-6 space-y-3"><button className={button} disabled={busy||!supported} onClick={()=>void run(()=>choose(true))}><strong className="block">新しいAI就活フォルダを作成</strong><span className="mt-1 block text-slate-600">保存する場所を選ぶと、その中に作成します。Web版では選択画面で新しいフォルダを作ることもできます。</span></button><button className={button} disabled={busy||!supported} onClick={()=>void run(()=>choose(false))}><strong className="block">既存の就活フォルダを開く</strong><span className="mt-1 block text-slate-600">既存データを使います。初期テンプレートで上書きしません。</span></button><label className={button+' block'}><strong className="block">ZIPバックアップから復元</strong><input className="mt-2 block max-w-full" type="file" accept=".zip" disabled={busy||!supported} onChange={event=>{const file=event.target.files?.[0];if(file)void run(async()=>{setArchive(await readWorkspaceArchive(file));setPicked(null);setMessage('復元先として空のフォルダを選んでください。既存ファイルは上書きしません。');});event.target.value='';}}/></label></div>
    {archive&&<div className="mt-4 rounded bg-blue-50 p-4 text-sm"><p>{Object.keys(archive).length}件を復元します。</p><button className="mt-2 underline" disabled={busy} onClick={()=>void run(async()=>{const destination=await pickRootDirectory();const result=await restoreWorkspaceArchive(archive,destination,setMessage);setPicked(destination);setExisting(true);setArchive(null);setMessage(`${result.created}ファイルを復元しました。同名の${result.skipped}件は保持しました。`);})}>復元先フォルダを選択</button></div>}
    {picked&&<div className="mt-5 rounded bg-indigo-50 p-4 text-left text-sm"><p>保存先：<strong>{picked.name}</strong></p><p className="mt-1">{message}</p><button className="mt-3 rounded bg-indigo-700 px-5 py-3 text-white" disabled={busy} onClick={()=>onReady(picked,existing)}>{existing?'このフォルダで始める':'テンプレートの設定へ進む'}</button></div>}
    {busy&&<p role="status" className="mt-3 text-sm">{message||'選択・処理中…'}</p>}{error&&<p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
  </OnboardingShell>;
}
