// Promote explicitly reviewed manuscript IDs; deployment remains a separate step.
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateArticle, todayInTokyo } from '../src/magazine/schema.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=async path=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const sources=await read('content/editorial/source-packets.json');
const plan=await read('docs/editorial/2026-10-26-title-plan/titles-1000.json');
const ids=(process.argv[2]||'').split(',').filter(Boolean);
if(!ids.length || ids.some(id=>!/^J\d{4}$/.test(id))) throw new Error('Provide the reviewed article IDs, separated by commas.');
const known=new Map(plan.articles.map(article=>[article.id,article]));
const existing=await Promise.all((await readdir(resolve(root,'content/magazine'))).filter(f=>f.endsWith('.json')).map(file=>read('content/magazine/'+file)));
let log;try{log=await read('content/editorial/publication-log.json');}catch{log={articles:[]};}
const records=[];
for(const id of ids){
 let held=false;
 try { await access(resolve(root,`content/editorial/production-work/${id}-quality-error.json`)); held=true; }
 catch(error) { if(error.code!=='ENOENT') throw error; }
 if(held)throw new Error(id+': unresolved editorial review');
 const record=await read(`content/editorial/manuscripts/${id}.json`),p=known.get(id),a=record.article;
 if(!p||a.id!==id||record.plan.title!==p.title)throw new Error(id+': plan mismatch');
 if(!record.generation?.modelUsage||!record.review?.modelUsage)throw new Error(id+': missing Claude provenance');
 const models=[...new Set([...Object.keys(record.generation.modelUsage),...Object.keys(record.review.modelUsage)])];
 if(models.some(model=>!model.startsWith('claude-')))throw new Error(id+': unexpected author model');
 const text=[a.lead,...a.sections.flatMap(s=>s.blocks.flatMap(b=>b.type==='list'?b.items:[b.text]))].join('\n');
 if(text.length<1500)throw new Error(id+': insufficient body');
 if(/J\d{4}|隣接記事/.test(text))throw new Error(id+': internal editorial reference in public body');
 const previous=log.articles.find(item=>item.id===id);
 const slug=previous?.slug||a.slug;
 if(existing.some(item=>item.slug===slug && item.editorialId!==id))throw new Error(id+': slug collision');
 if(existing.some(item=>item.title===p.title && item.editorialId!==id))throw new Error(id+': title collision');
 const article={slug,title:p.title,description:a.description,category:p.category,tags:a.tags,lead:a.lead,sections:a.sections,status:'published',author:'AI就活編集部',datePublished:previous?.datePublished||todayInTokyo(),dateModified:todayInTokyo(),writingAssistance:'Claude Sonnetを用いて本文を作成し、AIによる校正と編集確認を行っています。文例・練習問題は解説用に作成したものです。',sources:a.sourceIds.map(key=>{if(!sources[key])throw new Error(id+': unknown source');return {title:sources[key].title,url:sources[key].url};}),editorialId:id};
 const priorArticle=existing.find(item=>item.editorialId===id);
 if(priorArticle){
  if(priorArticle.cover)article.cover=priorArticle.cover;
  const {dateModified:oldModified,...oldContent}=priorArticle;
  const {dateModified:currentModified,...newContent}=article;
  if(JSON.stringify(oldContent)===JSON.stringify(newContent))article.dateModified=oldModified;
 }
 const errors=validateArticle(article);if(errors.length)throw new Error(id+': '+errors.join(';'));
 const sha=createHash('sha256').update(JSON.stringify(article)).digest('hex');
 const sourceDates=a.sourceIds.map(key=>sources[key].verified||sources[key].checkedAt).filter(Boolean).sort();
 records.push({article,log:{id,slug,title:p.title,models,datePublished:article.datePublished,dateModified:article.dateModified,sourceIds:a.sourceIds,sourceCheckedAt:sourceDates.at(-1)||null,bodyCharacters:text.length,sha256:sha,editorialCorrections:record.editorialCorrections||[],generation:record.generation,review:record.review,qualityReview:record.qualityReview||null}});
}
if(new Set(records.map(x=>x.article.slug)).size!==records.length)throw new Error('Duplicate slugs in batch');
if(new Set(records.map(x=>x.article.title)).size!==records.length)throw new Error('Duplicate titles in batch');
for(const {article} of records)await writeFile(resolve(root,'content/magazine',article.slug+'.json'),JSON.stringify(article,null,2)+'\n');
log.articles=[...log.articles.filter(a=>!ids.includes(a.id)),...records.map(x=>x.log)].sort((a,b)=>a.id.localeCompare(b.id));
await writeFile(resolve(root,'content/editorial/publication-log.json'),JSON.stringify(log,null,2)+'\n');
console.log(`Prepared ${records.length} manuscripts; total ${log.articles.length}/${plan.titleCount}. Deployment still required.`);
