import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Mail, Plus, X } from 'lucide-react';
import { useUpdateWork } from '../lib/updateWork';
import { Modal } from '../components/ui/Modal';
import { useSheet } from '../spreadsheet/lib/store';
import { flushAllSaves } from '../lib/saveQueue';
import { localDateKey } from '../lib/cellValues';
import { companyEntries, itemFingerprint, careerItems, newDraft, validateDraft, type CareerDraft } from './planner';
import { previewMail, MAIL_EXAMPLE } from './emailImport';
import { CareerFields } from './CareerFields';
import { connectGoogle, useGoogleConnections } from './googleAuth';
import { readGmail, searchGmail, type MailHeader } from './googleApi';
export function MailImportDialog({onClose,onSaved}:{onClose:()=>void;onSaved:(count:number,skipped:number)=>void}){
 const workbook=useSheet(s=>s.workbook),user=useSheet(s=>s.user);const entries=companyEntries(workbook);const connections=useGoogleConnections();
 const [raw,setRaw]=useState(''),[source,setSource]=useState('メール取り込み'),[step,setStep]=useState<'input'|'review'>('input'),[tab,setTab]=useState<'paste'|'gmail'>('paste');
 const [drafts,setDrafts]=useState<(CareerDraft&{selected:boolean})[]>([]),[warnings,setWarnings]=useState<string[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[query,setQuery]=useState('newer_than:90d (面接 OR 説明会 OR 選考)'),[messages,setMessages]=useState<MailHeader[]|null>(null),[committed,setCommitted]=useState<{ids:string[];skipped:number}|null>(null);
 useUpdateWork('mail-import',busy||!!raw.trim()||step==='review','メールの取り込み');
 const abort=useRef<AbortController|null>(null);useEffect(()=>()=>abort.current?.abort(),[]);
 const run=async(fn:()=>Promise<void>)=>{setError('');setBusy(true);try{await fn();}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'操作を完了できませんでした。');}finally{setBusy(false);}};
 const review=()=>{try{const result=previewMail(raw,localDateKey(new Date()),entries.map(e=>e.company));setDrafts(result.items.map(item=>({...item,source,selected:true})));setWarnings(result.warnings);setStep('review');setError('');}catch(e){setError((e as Error).message);}};
 const save=()=>void run(async()=>{let result=committed;if(!result){const selected=drafts.filter(d=>d.selected);if(!selected.length)throw new Error('登録する項目を選んでください。');selected.forEach(validateDraft);const linked=selected.map(d=>{const matches=entries.filter(e=>e.company===d.company.trim());return matches.length===1&&!d.entryRowId?{...d,entrySheetId:matches[0].sheetId,entryRowId:matches[0].rowId}:d;});result=useSheet.getState().addCareerItems(linked);setCommitted(result);}await flushAllSaves();onSaved(result.ids.length,result.skipped);});
 const existing=new Set(careerItems(workbook).map(itemFingerprint));
 return <Modal open onClose={()=>{if(!busy)onClose();}} ariaLabel="メールから予定とタスクを取り込む" className="career-dialog career-mail-dialog">
  <header className="career-dialog-header"><div><p className="career-eyebrow">MAIL IMPORT · {step==='input'?'01 / 02':'02 / 02'}</p><h2>{step==='input'?'メールから、次の行動へ。':'登録する内容を確認'}</h2><p>{step==='input'?'案内を貼り付けて、予定と対応事項をまとめて整理。':'日付・企業名・確定日か候補日かを確認して登録してください。時刻は日本時間です。'}</p></div><button className="career-icon" aria-label="取り込みを閉じる" disabled={busy} onClick={onClose}><X size={20}/></button></header>
  {error&&<p className="career-error" role="alert">{error}</p>}
  {step==='input'?<>
   <div className="career-tabs" aria-label="メールの取り込み方法"><button aria-pressed={tab==='paste'} onClick={()=>setTab('paste')} disabled={busy}>本文を貼り付ける</button><button aria-pressed={tab==='gmail'} onClick={()=>setTab('gmail')} disabled={busy}>Gmailから選ぶ</button></div>
   {tab==='gmail'&&<section className="career-inbox"><div className="career-section-head"><div><h3>必要なメールを選択</h3><p>検索結果は最大10件。選んだメールの本文だけを開きます。</p></div>{!connections.gmail&&<button className="career-button" disabled={busy} onClick={()=>void run(async()=>{await connectGoogle('gmail',user?.uid);})}>Gmailに接続</button>}</div>{connections.gmail&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{abort.current?.abort();abort.current=new AbortController();setMessages(await searchGmail(query,abort.current.signal));});}} className="career-search"><input aria-label="Gmail内を検索" value={query} onChange={e=>setQuery(e.target.value)} maxLength={500}/><button className="career-button" disabled={busy}>検索</button></form>}{messages&&<div className="career-mail-list">{messages.length?messages.map(m=><button key={m.id} disabled={busy} onClick={()=>void run(async()=>{abort.current?.abort();abort.current=new AbortController();const r=await readGmail(m.id,abort.current.signal);setRaw(r.text);setSource(r.source);setTab('paste');})}><strong>{m.subject}</strong><span>{m.from}</span><small>{m.date}</small><ArrowRight size={16}/></button>):<p>該当するメールはありません。検索条件を変えてください。</p>}</div>}</section>}
   <label className="career-mail-text">メール本文<textarea autoFocus rows={11} maxLength={100000} value={raw} disabled={busy} placeholder="面接案内、説明会の案内、提出物のメールなどを貼り付けてください。" onChange={e=>{setRaw(e.target.value);setSource('メール取り込み');}}/></label>
   <div className="career-between"><span className="career-muted">貼り付けた本文の抽出は、この端末で行います。</span><button className="career-link" disabled={busy} onClick={()=>{setRaw(MAIL_EXAMPLE);setSource('サンプルメール');}}>サンプルを試す</button></div>
   <footer className="career-dialog-footer"><button className="career-button" disabled={busy} onClick={onClose}>キャンセル</button><button className="career-button primary" disabled={busy||!raw.trim()} onClick={review}>内容を確認する <ArrowRight size={16}/></button></footer>
  </>:<>
   {!!warnings.length&&<aside className="career-notice"><strong>登録前に確認してください</strong><ul>{warnings.map(w=><li key={w}>{w}</li>)}</ul></aside>}
   <fieldset disabled={busy||!!committed} className="career-review-list">{drafts.map((d,i)=><section className="career-review-card" key={i}><div className="career-between"><label className="career-check"><input type="checkbox" checked={d.selected} onChange={e=>setDrafts(v=>v.map((x,j)=>j===i?{...x,selected:e.target.checked}:x))}/><span>{d.kind==='event'?'予定':'タスク'} {i+1}</span></label>{existing.has(itemFingerprint(d))&&<span className="career-chip">同じ項目は登録済み</span>}</div><CareerFields value={d} onChange={patch=>setDrafts(v=>v.map((x,j)=>j===i?{...x,...patch}:x))}/><label>関連するエントリー<select value={d.entryRowId?`${d.entrySheetId}/${d.entryRowId}`:''} onChange={e=>{const match=entries.find(x=>`${x.sheetId}/${x.rowId}`===e.target.value);setDrafts(v=>v.map((x,j)=>j===i?{...x,entrySheetId:match?.sheetId??'',entryRowId:match?.rowId??'',...(match?{company:match.company}:{})}:x));}}><option value="">企業名が一致するエントリーへ関連付ける</option>{entries.map(e=><option key={e.sheetId+e.rowId} value={`${e.sheetId}/${e.rowId}`}>{e.company} · {e.status}</option>)}</select></label></section>)}<button className="career-button" onClick={()=>setDrafts(v=>[...v,{...newDraft({company:v[0]?.company??'',source}),selected:true}])}><Plus size={16}/>項目を追加</button></fieldset>
   {committed&&<p role="status">{committed.ids.length}件を保存処理に追加しました。保存に失敗した場合は、下のボタンから再試行してください。</p>}
   <footer className="career-dialog-footer"><button className="career-button" disabled={busy||!!committed} onClick={()=>setStep('input')}><ArrowLeft size={16}/>本文に戻る</button><button className="career-button primary" disabled={busy||(!committed&&!drafts.some(d=>d.selected))} onClick={save}><Check size={16}/>{busy?'保存しています…':committed?'保存を再試行':`${drafts.filter(d=>d.selected).length}件を登録する`}</button></footer>
  </>}
 </Modal>;
}
