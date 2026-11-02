import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { useSheet, getActiveSheet } from '../lib/store';
import { readImportSource, previewImport, exportToCsv, exportToXlsx, exportWorkbook, type ImportSource } from '../lib/importExport';
import { applyFilters } from '../lib/filtering';
import { flushAllSaves } from '../../lib/saveQueue';
import { createManualBackup } from '../lib/persistence';

export function ImportDialog({ file, onClose }: { file: File; onClose: () => void }) {
  const sheet = useSheet(s => getActiveSheet(s));
  const [source,setSource] = useState<ImportSource | null>(null);
  const [name,setName] = useState(''); const [mapping,setMapping] = useState<Record<number,string>>({});
  const [error,setError] = useState(''); const [busy,setBusy] = useState(false);
  const [replace,setReplace] = useState(false);
  useEffect(() => { let cancelled=false; void readImportSource(file).then(data => { if (!cancelled) { setSource(data); setName(data.names[0]); } }).catch(error=>{if(!cancelled)setError(String(error.message));}); return()=>{cancelled=true;}; }, [file]);
  const preview = useMemo(() => {
    if (!source) return null;
    try { return { data: previewImport(source,sheet.columns,name,mapping), error: '' }; }
    catch (error) { return { data: null, error: error instanceof Error ? error.message : '取込内容を確認してください。' }; }
  }, [source,name,mapping,sheet.columns]);
  const headers = useMemo(() => { try { return source ? previewImport(source,[],name).columns.map(c=>c.name) : []; } catch { return []; } },[source,name]);
  const critical = preview?.data?.warnings?.some(w => w.includes('日付') || w.includes('列の対応'));
  const submit = async () => {
    if (!preview?.data || critical || !replace) return;
    setBusy(true); setError('');
    try {
      await flushAllSaves(); const state=useSheet.getState();
      await createManualBackup(state.user?.uid ?? 'local-guest',state.workbook);
      state.replaceActiveSheet(preview.data); onClose();
    } catch (error) { setError(error instanceof Error ? error.message : '取り込めませんでした。'); }
    finally { setBusy(false); }
  };
  return <Modal open onClose={()=>{if(!busy)onClose();}} ariaLabel="エントリーの取込プレビュー" className="max-w-4xl space-y-4">
    <h2 className="text-lg font-semibold">インポート内容の確認</h2>
    <p className="text-sm text-slate-600">{file.name}。列を対応づけ、日付と企業名を確認してください。変更前の全シートを端末内にバックアップします。</p>
    {source && <label className="block text-sm">取込元シート<select className="ml-3 rounded border p-2" value={name} onChange={event=>{setName(event.target.value);setMapping({});}}>{source.names.map(n=><option key={n}>{n}</option>)}</select></label>}
    <div className="grid gap-2 sm:grid-cols-2">{headers.map((header,index)=><label key={index} className="flex items-center gap-2 text-sm"><span className="w-1/2 truncate">{header}</span><select aria-label={`${header}の取込先`} value={mapping[index] ?? sheet.columns.find(c=>c.name===header)?.id ?? 'new'} onChange={event=>setMapping(m=>({...m,[index]:event.target.value}))} className="min-w-0 flex-1 rounded border p-2"><option value="new">新しい列</option><option value="skip">取り込まない</option>{sheet.columns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}</div>
    {preview?.data && <><p className="text-sm">{preview.data.rows.length}行・{preview.data.columns.length}列（先頭5行を表示）</p><div className="max-h-64 overflow-auto rounded border"><table className="min-w-full text-sm"><thead><tr>{preview.data.columns.map(c=><th key={c.id} className="whitespace-nowrap border p-2">{c.name}</th>)}</tr></thead><tbody>{preview.data.rows.slice(0,5).map(r=><tr key={r.id}>{preview.data!.columns.map(c=><td key={c.id} className="max-w-48 truncate border p-2">{c.type==='password' && r.cells[c.id] ? '••••••' : String(r.cells[c.id]??'')}</td>)}</tr>)}</tbody></table></div>{preview.data.warnings?.map(w=><p key={w} className="text-sm text-amber-800">{w}</p>)}<label className="flex gap-2 text-sm"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/>現在のシートの{sheet.rows.length}行を、この内容で置き換える</label></>}
    {(error || preview?.error) && <p role="alert" className="text-sm text-rose-700">{error || preview?.error}</p>}
    <div className="flex justify-end gap-3"><button onClick={onClose} disabled={busy} className="rounded border px-4 py-2">キャンセル</button><button onClick={()=>void submit()} disabled={busy || !preview?.data || !!critical || !replace} className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-40">{busy?'取り込み中…':'取り込む'}</button></div>
  </Modal>;
}

export function ExportDialog({ onClose, initialFormat='xlsx' }: { onClose: () => void; initialFormat?:'xlsx'|'csv' }) {
  const state = useSheet(); const sheet=getActiveSheet(state);
  const [format,setFormat]=useState<'xlsx'|'csv'|'json'>(initialFormat); const [scope,setScope]=useState<'filtered'|'sheet'|'all'>('filtered');
  const [secrets,setSecrets]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const filtered=applyFilters(sheet.rows,sheet.columns,{query:state.searchQuery,industry:state.filterIndustry,status:state.filterStatus,sortColumnId:state.sortColumnId,sortDir:state.sortDir});
  const submit=async()=>{setBusy(true);try{
    await flushAllSaves();
    const rows=scope==='filtered'?filtered:sheet.rows;
    let saved;
    if(scope==='all'||format==='json') saved=await exportWorkbook(scope==='all'?state.workbook:{...state.workbook,sheets:[{...sheet,rows}],activeSheetId:sheet.id},format==='json'?'json':'xlsx',secrets);
    else saved=await (format==='csv'?exportToCsv:exportToXlsx)({columns:sheet.columns,rows},`就活-${sheet.name}.${format}`,secrets);
    if(saved)onClose();
  }catch(error){setError(error instanceof Error?error.message:'書き出せませんでした。');}finally{setBusy(false);}};
  return <Modal open onClose={()=>{if(!busy)onClose();}} ariaLabel="エントリーを書き出す" className="max-w-lg space-y-4"><h2 className="text-lg font-semibold">エントリーを書き出す</h2>
    <label className="block text-sm">対象<select className="ml-3 rounded border p-2" value={scope} onChange={event=>{const value=event.target.value as typeof scope;setScope(value);if(value==='all'&&format==='csv')setFormat('xlsx');}}><option value="filtered">表示中の{filtered.length}行</option><option value="sheet">現在のシート全{sheet.rows.length}行</option><option value="all">全{state.workbook.sheets.length}シート</option></select></label>
    <label className="block text-sm">形式<select className="ml-3 rounded border p-2" value={format} onChange={event=>setFormat(event.target.value as typeof format)}><option value="xlsx">Excel (.xlsx)</option>{scope!=='all'&&<option value="csv">CSV (.csv)</option>}<option value="json">復元用データ (.json)</option></select></label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={secrets} onChange={e=>setSecrets(e.target.checked)}/>ID・パスワードを含める</label>
    {secrets&&<p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-900">このファイルには認証情報が平文で含まれます。共有せず、安全な場所に保存してください。</p>}
    <p className="text-sm text-slate-600">文書・写真なども含むバックアップは「設定とバックアップ」から作成できます。</p>
    {error&&<p role="alert" className="text-rose-700">{error}</p>}<div className="flex justify-end gap-3"><button className="rounded border px-4 py-2" disabled={busy} onClick={onClose}>キャンセル</button><button className="rounded bg-indigo-700 px-4 py-2 text-white" disabled={busy} onClick={()=>void submit()}>{busy?'書き出し中…':'保存先を選ぶ'}</button></div>
  </Modal>;
}
