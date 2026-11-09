import test from 'node:test';
import assert from 'node:assert/strict';
import { researchDeepLink,parseResearchDeepLink,publicArticleUrl } from '../src/lib/researchLinks.mjs';
import { ResearchRequestQueue } from '../src/lib/researchRequests';
import { JSDOM } from 'jsdom';
import { MemoryDirectory } from './test-support/memoryFs';

const slug = 'company-analysis-7203';
const fixture = {slug,status:'published',title:'トヨタ自動車の企業分析｜事業と仕事',category:'company-research',author:'AI就活',description:'事業と仕事を整理',lead:'企業研究の導入',datePublished:'2026-11-01',dateModified:'2026-11-01',tags:['企業研究'],sections:[{id:'business',heading:'事業',blocks:[{type:'paragraph',text:'資料を確認します。'}]}],sources:[]};
test('research URLs round-trip stock codes and unlisted companies without accepting commands, paths or auth callbacks', () => {
  for (const value of [slug,'company-analysis-unlisted-company','es-first-draft']) assert.equal(parseResearchDeepLink(researchDeepLink(value)),value);
  for (const raw of ['https://aishukatsu.net/?article='+slug,'aisyuukatsu://auth-callback?article='+slug,'aisyuukatsu://research?article=../secret','aisyuukatsu://research?article=company-analysis-7203&article=other','aisyuukatsu://research?article='+slug+'&path=/tmp/file','aisyuukatsu://user@research?article='+slug,'aisyuukatsu://research:80?article='+slug,'aisyuukatsu://research/more?article='+slug,'aisyuukatsu://research?article='+slug+'#fragment','aisyuukatsu://research?article=https%3A%2F%2Fevil.test','aisyuukatsu://research?article=a%2Fb']) assert.equal(parseResearchDeepLink(raw),null,raw);
  assert.equal(publicArticleUrl(slug),'https://aishukatsu.net/magazine/articles/company-analysis-7203.json');
  assert.throws(()=>researchDeepLink('../secret'));
});
test('cold and warm duplicate deliveries survive setup and restart without losing a later company', () => {
  const memory = new Map<string,string>();const storage={getItem:(key:string)=>memory.get(key)||null,setItem:(key:string,value:string)=>{memory.set(key,value);}};
  let now=1000;const queue=new ResearchRequestQueue(()=>storage,()=>now);
  queue.enqueue(slug);queue.enqueue(slug);queue.enqueue('company-analysis-6758');assert.equal(queue.pending().length,2);
  const first=queue.current()!;
  const restarted=new ResearchRequestQueue(()=>storage,()=>now);assert.equal(restarted.current()?.slug,slug);
  restarted.complete(first.id);assert.equal(restarted.current()?.slug,'company-analysis-6758');
  restarted.enqueue('company-analysis-7974');assert.notEqual(restarted.pending()[0].id,restarted.pending()[1].id);
  restarted.complete(first.id);assert.equal(restarted.pending().length,2);
  now+=24*60*60*1000+1;assert.equal(restarted.current(),null);
});
test('storage refusal still receives an article in memory, and a full queue preserves earlier requests', () => {
  const queue=new ResearchRequestQueue(()=>{throw Error('Storage disabled');});
  assert(queue.enqueue(slug));for(let n=1;n<10;n++)assert(queue.enqueue('company-analysis-test-'+n));
  assert.equal(queue.enqueue('company-analysis-extra'),false);assert.equal(queue.current()?.slug,slug);
  assert.equal(queue.enqueue('../file'),false);
});
test('native cold-start and running-app delivery share one listener and leave Google auth callbacks alone',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://tauri.localhost'});
  for(const key of ['window','document','localStorage','sessionStorage','HTMLElement','Element','Node','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,key,{value:(dom.window as any)[key],configurable:true});
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,isTauri:true});Object.defineProperty(dom.window,'isTauri',{value:true,configurable:true});
  const {mockIPC}=await import('@tauri-apps/api/mocks');const {emit}=await import('@tauri-apps/api/event');
  let starts=0;
  mockIPC(cmd=>{if(cmd==='plugin:deep-link|get_current'){starts++;return [researchDeepLink(slug)];}if(cmd==='load_public_article')return fixture;},{shouldMockEvents:true});
  const {installDesktopResearch}=await import('../src/lib/desktopResearch');const {researchRequests}=await import('../src/lib/researchRequests');
  await Promise.all([installDesktopResearch(),installDesktopResearch()]);assert.equal(starts,1);assert.equal(researchRequests.current()?.slug,slug);
  await emit('deep-link://new-url',[researchDeepLink(slug),'aisyuukatsu://auth-callback?state=test&idToken=private']);assert.equal(researchRequests.pending().length,1);
  await emit('deep-link://new-url',[researchDeepLink('company-analysis-6758')]);assert.equal(researchRequests.pending().length,2);
  const React=await import('react');const {act}=React;const {createRoot}=await import('react-dom/client');const {ArticleMemoImport}=await import('../src/components/ArticleMemoImport');
  const root=createRoot(document.getElementById('root')!);const directory=new MemoryDirectory('記事用テスト');let opened='';
  const render=()=>React.createElement(ArticleMemoImport,{root:directory.asHandle(),onOpen:async(file:FileSystemFileHandle)=>{opened=await(await file.getFile()).text();}});
  await act(async()=>{root.render(render());await new Promise(resolve=>setTimeout(resolve,30));});
  assert.equal(directory.entriesMap.size,0,'receiving a link never creates files');
  const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='メモを作成・開く')!;assert.ok(button);
  await act(async()=>{button.click();await new Promise(resolve=>setTimeout(resolve,30));});
  assert.ok(opened.includes('トヨタ自動車の企業研究メモ'));assert.ok(opened.includes('https://aishukatsu.net/magazine/'+slug+'/'));
  assert.equal(researchRequests.current()?.slug,'company-analysis-6758','the next company remains pending');
  // Return to the same company and ensure user-written notes are retained.
  await act(async()=>{researchRequests.complete(researchRequests.current()!.id);});
  const memoDir=await directory.getDirectoryHandle('記事メモ');const file=await memoDir.getFileHandle(slug+'.md');const writer=await file.createWritable();await writer.write('# 個人の追記を保持');await writer.close();
  await act(async()=>{researchRequests.enqueue(slug);await new Promise(resolve=>setTimeout(resolve,30));});
  await act(async()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='メモを作成・開く')!.click();await new Promise(resolve=>setTimeout(resolve,30));});
  assert.equal(opened,'# 個人の追記を保持');
  await act(async()=>root.unmount());
});
