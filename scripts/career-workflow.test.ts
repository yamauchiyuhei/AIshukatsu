import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import 'fake-indexeddb/auto';
import {previewMail,MAIL_EXAMPLE} from '../src/career/emailImport';
import {addCareerItems,careerItems,changeCareerItem,newDraft,PLANNER_ID,preparationTasks,validateDraft} from '../src/career/planner';
import {calendarFile,eventRange,googleCalendarLink} from '../src/career/calendar';
import {collectDeadlines} from '../src/lib/deadlines';
import {createPresetColumns} from '../src/spreadsheet/lib/presetColumns';
import {saveToCsv,loadFromCsv} from '../src/spreadsheet/lib/csvStore';
import {MemoryDirectory} from './test-support/memoryFs';
import type {Workbook} from '../src/spreadsheet/types/sheet';
process.env.TZ='Asia/Tokyo';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
for(const k of ['window','document','localStorage','sessionStorage','HTMLElement'])Object.defineProperty(globalThis,k,{value:(dom.window as any)[k],configurable:true});
const wb=():Workbook=>({version:2,activeSheetId:'entry',sheets:[{id:'entry',name:'本選考',columns:createPresetColumns(),rows:[{id:'a',cells:{company:'株式会社みらい',status:'1次面接',password:'keep'}}]}]});
test('one email becomes a meeting, reply deadline and document deadline with separate dates',()=>{
 const result=previewMail(MAIL_EXAMPLE,'2026-11-09',['株式会社みらい']);assert.equal(result.company,'株式会社みらい');assert.equal(result.items.length,3);assert.deepEqual(result.items.map(i=>[i.kind,i.date,i.time,i.endTime]),[['event','2026-11-20','14:00','15:00'],['task','2026-11-15','',''],['task','2026-11-19','23:59','']]);assert.equal(result.items[0].url,'https://meet.google.com/abc-defg-hij');assert.match(result.items[1].title,/返信/);assert.match(result.items[2].title,/履歴書/);
});
test('quoted messages, unsupported relative dates and ambiguous year are not silently trusted',()=>{
 const p=previewMail('株式会社みらい\n日時：11月20日 午後2時30分\n明日までに返信\n>株式会社そら\n>日時：2026年11月10日 09:00','2026-11-09',['株式会社みらい','株式会社そら']);assert.equal(p.company,'株式会社みらい');assert.equal(p.items.length,1);assert.equal(p.items[0].time,'14:30');assert.ok(p.warnings.some(s=>s.includes('年がない')));assert.ok(p.warnings.some(s=>s.includes('相対的')));assert.equal(previewMail('日時：2026年2月30日','2026-11-09').items.length,0);assert.ok(previewMail('日程変更：2026年11月20日 14:00','2026-11-09').warnings.some(s=>s.includes('変更')));
});
test('import is atomic, idempotent and leaves the selection row untouched',()=>{
 const original=wb(),drafts=previewMail(MAIL_EXAMPLE,'2026-11-09',['株式会社みらい']).items;const r=addCareerItems(original,drafts);assert.equal(r.ids.length,3);assert.equal(original.sheets.length,1);assert.deepEqual(r.workbook.sheets[0],original.sheets[0]);assert.equal(addCareerItems(r.workbook,drafts).skipped,3);assert.throws(()=>addCareerItems(original,[drafts[0],newDraft({title:'invalid'})]));assert.equal(original.sheets.length,1);
});
test('tasks and ES submission history survive the existing file-backed save and restore',async()=>{
 const root=new MemoryDirectory();let data=addCareerItems(wb(),[newDraft({company:'株式会社みらい',title:'自己PR',kind:'es',notes:'最初の文章',versions:[{text:'最初の文章',submitted:true,savedAt:'2026-11-09T00:00:00Z'}]}),newDraft({company:'株式会社みらい',title:'返信',date:'2026-11-15'})]).workbook;
 const [es,task]=careerItems(data);data=changeCareerItem(data,es.id,{notes:'次の文章',versions:[...es.versions,{text:'次の文章',submitted:false,savedAt:'2026-11-10T00:00:00Z'}]});data=changeCareerItem(data,task.id,{done:true});await saveToCsv(root.asHandle(),data);const restored=(await loadFromCsv(root.asHandle()))!.workbook;assert.equal(careerItems(restored)[0].versions[0].text,'最初の文章');assert.equal(careerItems(restored)[0].versions[1].text,'次の文章');assert.equal(careerItems(restored)[1].done,true);const sheet=restored.sheets.find(s=>s.id===PLANNER_ID)!;assert.equal(collectDeadlines(sheet.rows,sheet.columns).length,0);assert.equal(restored.sheets[0].rows[0].cells.password,'keep');
});
test('calendar dates preserve Japan time, exclude the next day and do not inject ICS properties',()=>{
 const event={...newDraft({company:'企業',title:'面接',kind:'event',date:'2026-12-31',notes:'hello\nBEGIN:VEVENT\nATTENDEE:evil',time:'23:30',minutes:60}),id:'test',versions:[]};const range=eventRange(event);assert.equal(range.start.dateTime,'2026-12-31T23:30:00+09:00');assert.equal(range.end.dateTime,'2026-12-31T15:30:00.000Z');const file=calendarFile([event]);assert.equal(file.match(/^BEGIN:VEVENT$/gm)?.length,1);assert.ok(!/^ATTENDEE:/m.test(file));const allDay=eventRange({...event,time:''});assert.equal(allDay.end.date,'2027-01-01');assert.match(googleCalendarLink({...event,time:''}),/20261231%2F20270101/);assert.throws(()=>validateDraft({...event,url:'javascript:alert(1)'}));assert.throws(()=>validateDraft({...event,endTime:'23:00'}));assert.equal(preparationTasks(event)[0].date,'2026-12-30');
});
test('Google callback rejects the wrong service, identity, origin, time and nonce',async()=>{
 const {validGoogleCallback}=await import('../src/career/googleAuth');const pending={state:'nonce',service:'gmail' as const,createdAt:1000,uid:'owner'};const raw='aisyuukatsu://google-connect#state=nonce&service=gmail&token=example&uid=owner';assert.ok(validGoogleCallback(raw,pending,2000));for(const value of [raw.replace('nonce','other'),raw.replace('service=gmail','service=calendar'),raw.replace('uid=owner','uid=other'),raw.replace('aisyuukatsu:','https:')])assert.equal(validGoogleCallback(value,pending,2000),null);assert.equal(validGoogleCallback(raw,pending,301001),null);assert.equal(validGoogleCallback(raw,pending,0),null);
});
test('document imports preserve existing files and validate the whole selection before writing',async()=>{
 const {importLibraryFiles}=await import('../src/lib/libraryImport');
 const root=new MemoryDirectory();const old=await root.getFileHandle('ES.md',{create:true});const writer=await old.createWritable();await writer.write('existing');await writer.close();
 assert.deepEqual(await importLibraryFiles(root.asHandle(),[new File(['replace'],'ES.md'),new File(['new document'],'企業研究.md')]),{added:1,skipped:1});
 assert.equal(await (await old.getFile()).text(),'existing');assert.equal(await (await (await root.getFileHandle('企業研究.md')).getFile()).text(),'new document');
 await assert.rejects(importLibraryFiles(root.asHandle(),[new File(['valid'],'valid.md'),new File(['invalid'],'bad/name.md')]));assert.equal(root.entriesMap.has('valid.md'),false);
 await assert.rejects(importLibraryFiles(root.asHandle(),[new File(['hidden'],'.hidden')]));assert.equal(root.entriesMap.has('.hidden'),false);
});
