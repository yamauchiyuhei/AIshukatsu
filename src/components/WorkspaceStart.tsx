import {useState} from 'react';
import {AppShell, type AppSection} from './AppShell';
import {DocumentLibrary} from './DocumentLibrary';
import {CareerWorkspace, type CareerTab} from '../career/CareerWorkspace';
import {SpreadsheetRoot} from '../spreadsheet/SpreadsheetRoot';
import {Modal} from './ui/Modal';
import {ToastHost,ConfirmHost,toast} from '../spreadsheet/components/Toast';
import {useSheet} from '../spreadsheet/lib/store';
import {flushAllSaves} from '../lib/saveQueue';
import {updatePreferences,usePreferences} from '../lib/preferences';

/** Calendar and entries remain usable before a local document folder is attached. */
export function WorkspaceStart({onChooseFolder,onSetup,needsPermission,onReconnect}: {onChooseFolder:()=>Promise<unknown>;onSetup:()=>void;needsPermission:boolean;onReconnect:()=>Promise<void>}) {
 const [section,setSection]=useState<AppSection>('documents');
 const [careerTab,setCareerTab]=useState<CareerTab>('today');
 const [settings,setSettings]=useState(false);
 const preferences=usePreferences();
 const navigate=(next:AppSection)=>{void flushAllSaves().then(()=>{if(next==='calendar')setCareerTab('planner');else if(next==='tasks')setCareerTab('today');else if(next==='connections')setCareerTab(next);setSection(next);}).catch(()=>window.dispatchEvent(new Event('aishukatsu-save-error')));};
 const add=()=>{const state=useSheet.getState();const entry=state.workbook.sheets.find(sheet=>sheet.id!=='career-planner-v1');if(entry)state.switchSheet(entry.id);state.setView('sheet');const id=state.addRow();state.setSelection({rowId:id,colId:'company'});navigate('spreadsheet');};
 return <AppShell section={section} onNavigate={navigate} onSettings={()=>setSettings(true)}>
  <div className="app-feature-view" hidden={section!=='documents'}>{needsPermission&&<div className="document-permission" role="status"><span>前回のフォルダへのアクセス許可が必要です。</span><button className="app-button" onClick={()=>void onReconnect().catch(()=>toast.error('再接続できませんでした。フォルダを選び直してください。'))}>フォルダに再接続</button></div>}<DocumentLibrary workspace={null} onOpenFile={()=>{}} onBrowse={async()=>{}} onChooseFolder={onChooseFolder} onStartSetup={onSetup} onRefresh={async()=>{}} onAddFolder={()=>{}} onAddFile={()=>{}} onAddCompany={()=>{}}/></div>
  <div className="app-feature-view" hidden={section!=='spreadsheet'}><SpreadsheetRoot active={section==='spreadsheet'} shellNavigation/></div>
  <div className="app-feature-view" hidden={section==='documents'||section==='spreadsheet'}><CareerWorkspace embedded activeTab={careerTab} onTabChange={tab=>navigate(tab==='today'?'tasks':tab==='planner'?'calendar':tab==='companies'?'documents':tab)} onSettings={()=>setSettings(true)} onAdd={add} onOpen={(sheetId,rowId)=>{const state=useSheet.getState();state.switchSheet(sheetId);state.setView('sheet');state.setSelection({rowId,colId:'company'});navigate('spreadsheet');}} onOpenDocument={()=>navigate('documents')}/></div>
  {settings&&<Modal open onClose={()=>setSettings(false)} ariaLabel="表示と保存の設定" className="workspace-start-settings"><header><h2>表示と保存の設定</h2><button className="app-button" onClick={()=>setSettings(false)}>閉じる</button></header><label>表示密度<select value={preferences.density} onChange={event=>updatePreferences({density:event.target.value as typeof preferences.density})}><option value="comfortable">標準</option><option value="compact">コンパクト</option></select></label><label>文字サイズ<select value={preferences.textSize} onChange={event=>updatePreferences({textSize:event.target.value as typeof preferences.textSize})}><option value="normal">標準</option><option value="large">大きめ</option></select></label><p>現在、就活表と予定はこのブラウザ・端末内に保存されます。資料フォルダを選ぶと、就活表もそのフォルダへ保存されます。</p><button className="app-button" onClick={()=>{setSettings(false);navigate('documents');}}>資料フォルダを選ぶ</button></Modal>}
  <ToastHost/><ConfirmHost/>
 </AppShell>;
}
