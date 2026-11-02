import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { parseWorkbook } from '../lib/workbookValidation';
import { Modal } from './ui/Modal';
import { usePreferences, updatePreferences } from '../lib/preferences';
import { useSheet } from '../spreadsheet/lib/store';
import { listBackups, createManualBackup } from '../spreadsheet/lib/persistence';
import { downloadWorkspaceArchive, readWorkspaceArchive, restoreWorkspaceArchive, withoutCredentials } from '../lib/workspaceArchive';
import { listWorkspaceTrash, restoreWorkspaceTrash, type TrashEntry } from '../lib/workspaceTrash';
import { downloadBlob } from '../lib/download';
import { pickRootDirectory } from '../lib/fs';
import { confirmDialog } from '../spreadsheet/components/Toast';
import { pullWorkbook } from '../spreadsheet/lib/cloudSync';
import { flushAllSaves, subscribeSaves,savesRevision,pendingSaves } from '../lib/saveQueue';
import type { Workbook } from '../spreadsheet/types/sheet';

export function WorkspaceSettings({ root, onClose, onRefresh }: { root: FileSystemDirectoryHandle; onClose: () => void; onRefresh: () => void }) {
  const preferences=usePreferences(); const user=useSheet(s=>s.user); const owner=user?.uid ?? 'local-guest';
  useSyncExternalStore(subscribeSaves,savesRevision);
  const orphaned=pendingSaves().filter(writer=>writer.detached&&writer.resourceKey&&writer.owner===owner);
  const [tab,setTab]=useState<'settings'|'backup'|'trash'|'help'>('settings');
  const [pass,setPass]=useState(''); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [error,setError]=useState('');
  const [secrets,setSecrets]=useState(false); const [backups,setBackups]=useState<Awaited<ReturnType<typeof listBackups>>>([]);
  const [selectedBackup,setSelectedBackup]=useState(''); const [selectedSheets,setSelectedSheets]=useState<string[]>([]);
  const [trash,setTrash]=useState<TrashEntry[]>([]); const [archive,setArchive]=useState<Record<string,Uint8Array> | null>(null);
  const load=async()=>{const [saved,deleted]=await Promise.all([listBackups(owner),listWorkspaceTrash(root)]);setBackups(saved);setTrash(deleted);};
  useEffect(()=>{void load().catch(()=>setError('バックアップの一覧を読み込めません。'));},[root,owner]);
  const busyRef=useRef(false);
  const run=async(action:()=>Promise<unknown>)=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');setMessage('');try{await action();}catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))setError(error instanceof Error?error.message:'操作を完了できませんでした。');}finally{busyRef.current=false;setBusy(false);}};
  const restoreSheets=async(workbook:Workbook, ids=workbook.sheets.map(s=>s.id))=>{
    const ok=await confirmDialog('選んだシートを別シートとして追加します。現在のデータは置き換えません。',{title:'バックアップを復元',okLabel:'別シートへ復元'}); if(!ok)return;
    await flushAllSaves();const state=useSheet.getState();await createManualBackup(owner,state.workbook);
    const extra=workbook.sheets.filter(s=>ids.includes(s.id)).map(sheet=>({...sheet,id:crypto.randomUUID(),name:`${sheet.name}（復元）`,rows:sheet.rows.map(row=>({...row,id:crypto.randomUUID()}))}));
    state.replaceWorkbook({...state.workbook,sheets:[...state.workbook.sheets,...extra],activeSheetId:extra[0]?.id ?? state.workbook.activeSheetId});
    await state.flushCsvNow();setMessage(`${extra.length}シートを復元しました。`);await load();
  };
  const button='rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50';
  return <Modal open onClose={()=>{if(!busy)onClose();}} ariaLabel="設定とバックアップ" className="max-w-4xl space-y-5">
    <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">設定とバックアップ</h2><button className={button} disabled={busy} onClick={onClose}>閉じる</button></div>
    <nav aria-label="設定のカテゴリ" className="flex flex-wrap gap-2">{([['settings','表示と保存'],['backup','バックアップと復元'],['trash','ゴミ箱'],['help','使い方とAI連携']] as const).map(([id,label])=><button key={id} aria-pressed={tab===id} className={button+(tab===id?' bg-indigo-50 text-indigo-800':'')} onClick={()=>setTab(id)}>{label}</button>)}</nav>
    <p className="text-sm text-slate-600">保存先：{root.name} ／ {user ? 'Google接続中' : 'この端末だけで利用中'}</p>
    {tab==='settings'&&<div className="space-y-5">
      <div className="flex flex-wrap gap-5"><label className="text-sm">表示密度<select className="ml-2 rounded border p-2" value={preferences.density} onChange={e=>updatePreferences({density:e.target.value as typeof preferences.density})}><option value="comfortable">標準</option><option value="compact">コンパクト</option></select></label><label className="text-sm">文字サイズ<select className="ml-2 rounded border p-2" value={preferences.textSize} onChange={e=>updatePreferences({textSize:e.target.value as typeof preferences.textSize})}><option value="normal">標準</option><option value="large">大きめ</option></select></label></div>
      <div className="rounded bg-slate-50 p-4 text-sm leading-7"><p>エントリー一覧は端末のフォルダに自動保存されます。クラウドへは「今すぐアップロード」を選んだときにバックアップします。</p><p>文書のクラウド自動保存は任意です。写真・PDF・Wordは自動送信しません。端末のID・パスワードは隠し保存ファイルに保持され、端末内で暗号化される機能ではありません。</p></div>
      <label className="flex gap-2 text-sm"><input type="checkbox" disabled={!user} checked={preferences.cloudDocuments} onChange={e=>updatePreferences({cloudDocuments:e.target.checked})}/>Markdown文書をGoogleのクラウドへ自動保存する（ログイン時のみ）</label>
      <p className="text-sm text-slate-600">合言葉がない文書は平文で送信されます。合言葉を設定すると本文を暗号化します。ファイル名やフォルダ名は暗号化されません。</p>
      <label className="block text-sm">暗号化の合言葉<input aria-label="暗号化の合言葉" type="password" autoComplete="new-password" className="mt-2 block w-full rounded border p-2" value={pass} onChange={e=>setPass(e.target.value)} placeholder="他の端末でも同じ合言葉を使います"/></label>
      <button className={button} disabled={!user||pass.length<8} onClick={()=>{useSheet.getState().setPassphrase(pass);setPass('');setMessage('このセッションの合言葉を設定しました。忘れると暗号化した内容を復元できません。');}}>合言葉を設定</button>
      <p className="text-sm text-slate-600">合言葉を変えても、過去のバックアップは自動で再暗号化されません。先に旧合言葉で復元・確認してください。</p>
    </div>}
    {tab==='backup'&&<div className="space-y-5">
      {orphaned.length>0&&<div className="space-y-3 rounded border border-amber-300 p-4"><h3 className="font-semibold">閉じた文書に未保存の下書きがあります</h3><p className="text-sm">元のファイルが移動・削除されて保存できない場合は、下書きを書き出して保存の保留を解除できます。</p>{orphaned.map((writer,index)=><div key={index} className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{writer.documentLabel??'文書'}</span><button className={button} disabled={busy} onClick={()=>void run(async()=>{const value=writer.pendingValue;if(value===null)return;if(!await downloadBlob(new Blob([value]),`${writer.documentLabel??'文書'}.未保存.md`))return;if(await confirmDialog('下書きのファイルを保存できたことを確認してください。元の保存先には反映せず、保留を解除します。',{title:'保存の保留を解除',okLabel:'下書きを保存したので解除'}))await writer.discard();})}>下書きを書き出して保留を解除</button></div>)}</div>}

      <div className="space-y-3 rounded border p-4"><h3 className="font-semibold">フォルダ全体をZIPに保存</h3><p className="text-sm text-slate-600">文書・写真・全シートを含みます。文書本文に書かれた個人情報も含まれるため、共有先にご注意ください。システム用の隠しフォルダとゴミ箱は除きます。</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={secrets} onChange={e=>setSecrets(e.target.checked)}/>一覧のID・パスワードも含める（平文）</label><button className={button} disabled={busy} onClick={()=>void run(async()=>{const saved=await downloadWorkspaceArchive(root,secrets,setMessage);if(saved)setMessage('フォルダ全体のバックアップを保存しました。');})}>フォルダ全体の保存先を選ぶ</button></div>
      <div className="space-y-3 rounded border p-4"><h3 className="font-semibold">ZIPから別のフォルダへ復元</h3><label className="block text-sm">バックアップZIPを選択<input type="file" accept=".zip" disabled={busy} className="mt-2 block text-sm" onChange={e=>{const file=e.target.files?.[0];if(file)void run(async()=>{setArchive(await readWorkspaceArchive(file));setMessage('復元内容を確認して、復元先を選んでください。');});e.target.value='';}}/></label>{archive&&<><p className="text-sm">{Object.keys(archive).filter(p=>!p.endsWith('/')).length}ファイル</p><ul className="max-h-32 overflow-auto text-xs text-slate-600">{Object.keys(archive).slice(0,30).map(path=><li key={path}>{path}</li>)}</ul><button className={button} disabled={busy} onClick={()=>void run(async()=>{const destination=await pickRootDirectory();const result=await restoreWorkspaceArchive(archive,destination,setMessage);setMessage(`${result.created}ファイルを復元しました。同名の既存ファイル${result.skipped}件は保持しました。`);if(await destination.isSameEntry(root))onRefresh();})}>復元先フォルダを選択</button></>}</div>
      <div className="space-y-3 rounded border p-4"><h3 className="font-semibold">この端末のシート履歴</h3><button className={button} disabled={busy} onClick={()=>void run(async()=>{await flushAllSaves();await createManualBackup(owner,useSheet.getState().workbook);await load();setMessage('現在の全シートを履歴へ保存しました。');})}>今の全シートを履歴に保存</button><label className="block text-sm">保存日時<select className="ml-2 max-w-full rounded border p-2" value={selectedBackup} onChange={e=>{setSelectedBackup(e.target.value);setSelectedSheets([]);}}><option value="">履歴を選択</option>{backups.map(b=><option key={b.id} value={b.id}>{new Date(b.createdAt).toLocaleString('ja-JP')}・{b.workbook.sheets.length}シート</option>)}</select></label>{backups.find(b=>b.id===selectedBackup)?.workbook.sheets.map(sheet=><label key={sheet.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selectedSheets.includes(sheet.id)} onChange={e=>setSelectedSheets(ids=>e.target.checked?[...ids,sheet.id]:ids.filter(id=>id!==sheet.id))}/>{sheet.name}（{sheet.rows.length}行）</label>)}<button className={button} disabled={busy||!selectedSheets.length} onClick={()=>void run(()=>restoreSheets(backups.find(b=>b.id===selectedBackup)!.workbook,selectedSheets))}>選んだシートを別シートへ復元</button></div>
      <label className="block rounded border p-4 text-sm">全シートJSONから別シートへ復元<input className="mt-2 block" type="file" accept=".json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void run(async()=>restoreSheets(parseWorkbook(await file.text())));e.target.value='';}}/></label>
      <button className={button} disabled={!user||busy} onClick={()=>void run(async()=>{const state=useSheet.getState();const data=await pullWorkbook(user!.uid,state.passphrase);if(!data)throw new Error('クラウドのバックアップがありません。');if(data.hadEncrypted&&!state.passphrase)throw new Error('暗号化の合言葉を設定してから復元してください。');await restoreSheets(data.workbook);})}>クラウドの一覧を別シートへ復元</button>
      <button className={button} disabled={busy} onClick={()=>void run(async()=>{await downloadBlob(new Blob([JSON.stringify(withoutCredentials(useSheet.getState().workbook),null,2)],{type:'application/json'}),'AI就活-現在の一覧-退避.json');})}>保存できない変更をJSONへ退避</button>
    </div>}
    {tab==='backup'&&<button className={button} disabled={busy} onClick={()=>void run(async()=>{if(!await confirmDialog('現在の変更を端末内の履歴へ退避してから、フォルダの一覧を読み直します。現在の変更で外部ファイルは上書きしません。',{title:'外部の変更を読み込む',okLabel:'履歴へ退避して再読み込み'}))return;await createManualBackup(owner,useSheet.getState().workbook);await useSheet.getState().discardLocalChangesAndReload();await load();setMessage('外部の変更を読み込みました。直前の変更はシート履歴から復元できます。');})}>変更を履歴へ退避して一覧を再読み込み</button>}
    {tab==='trash'&&<div className="space-y-3"><p className="text-sm text-slate-600">削除したファイルはこのフォルダのゴミ箱に移動します。クラウドに作成済みのバックアップは保持されます。</p>{!trash.length&&<p>ゴミ箱は空です。</p>}{trash.map(entry=><div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"><div className="min-w-0 text-sm"><p className="break-all">{entry.path.join(' / ')}</p><p className="text-slate-500">{new Date(entry.deletedAt).toLocaleString('ja-JP')}</p></div><button className={button} disabled={busy} onClick={()=>void run(async()=>{await flushAllSaves();await restoreWorkspaceTrash(root,entry);await load();onRefresh();setMessage('元の場所へ復元しました。');})}>元の場所へ復元</button></div>)}</div>}
    {tab==='help'&&<div className="space-y-4 text-sm leading-7"><p>1. 「エントリー一覧」に企業と締切を登録します。表・選考ボード・カレンダーは同じデータを表示します。</p><p>2. 左のフォルダからESや企業研究を開きます。文書は自動保存され、上部で端末とクラウドの保存結果を別々に確認できます。</p><p>3. AIを使うときは、保存先の「{root.name}」フォルダをClaudeやCursorなど、自分で選んだ外部AIへ渡します。このアプリがAIへ自動送信する機能ではありません。ID・パスワードや共有したくない書類を除いて渡してください。</p><p>4. 別端末へ移す前に、フォルダ全体のZIPを作成してください。新しいWebドメインではGoogleログインとフォルダ選択が再度必要です。既存のフォルダを選べば、その中のデータを使えます。</p><p>5. オフラインでも接続済みのフォルダを編集できます。クラウドへの保存や初回Googleログインには接続が必要です。</p><button className={button} onClick={()=>window.dispatchEvent(new Event('aishukatsu-check-update'))}>デスクトップの更新を確認</button></div>}
    {busy&&<p role="status" className="text-sm text-indigo-800">{message||'処理中…'}</p>}{!busy&&message&&<p role="status" className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}{error&&<p role="alert" className="rounded bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
  </Modal>;
}
